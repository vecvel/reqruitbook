package domain

import (
	"errors"
	"testing"
)

func TestCompensationIsStoredInTheCurrencysOwnMinorUnits(t *testing.T) {
	// The bug this pins: assuming every currency has two decimal places stores a
	// Japanese salary a hundred times too high and a Kuwaiti one ten times too
	// low, and both look plausible until payroll reads them.
	tests := []struct {
		name     string
		currency string
		major    float64
		want     int64
	}{
		{name: "a two-decimal currency", currency: "USD", major: 175000, want: 17_500_000},
		{name: "cents survive", currency: "USD", major: 1234.05, want: 123_405},
		{name: "a zero-decimal currency", currency: "JPY", major: 8_000_000, want: 8_000_000},
		{name: "a three-decimal currency", currency: "KWD", major: 25_000, want: 25_000_000},
		{name: "an unlisted currency defaults to two", currency: "ZAR", major: 100, want: 10_000},
		{name: "a lower-case code is normalized", currency: "eur", major: 90_000, want: 9_000_000},
		{name: "a fraction below the minor unit rounds", currency: "USD", major: 0.005, want: 1},
		{name: "zero is allowed", currency: "USD", major: 0, want: 0},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := ParseCompensation(CompensationInput{Currency: tc.currency, BaseSalary: tc.major})
			if err != nil {
				t.Fatalf("ParseCompensation() error = %v", err)
			}
			if got.BaseSalary != tc.want {
				t.Errorf("BaseSalary = %d, want %d", got.BaseSalary, tc.want)
			}
		})
	}
}

func TestMoneySurvivesTheRoundTrip(t *testing.T) {
	// The portal sends major units and renders what comes back, so a value that
	// changed on the way through would be a salary that edited itself.
	for _, currency := range []string{"USD", "JPY", "KWD", "INR"} {
		for _, major := range []float64{0, 1, 999.99, 175_000, 8_000_000} {
			if currency == "JPY" && major == 999.99 {
				// A currency with no minor unit cannot hold a fraction, and
				// rounding it is the documented behaviour rather than a loss.
				continue
			}

			parsed, err := ParseCompensation(CompensationInput{Currency: currency, BaseSalary: major})
			if err != nil {
				t.Fatalf("ParseCompensation(%s, %v) error = %v", currency, major, err)
			}
			if back := MinorToMajor(parsed.BaseSalary, currency); back != major {
				t.Errorf("round trip of %v %s = %v", major, currency, back)
			}
		}
	}
}

func TestCompensationRejectsWhatCannotBeAnAmount(t *testing.T) {
	tests := []struct {
		name  string
		input CompensationInput
		field string
	}{
		{name: "a negative salary",
			input: CompensationInput{Currency: "USD", BaseSalary: -1}, field: "baseSalary"},
		{name: "a negative bonus",
			input: CompensationInput{Currency: "USD", BaseSalary: 1, SignOnBonus: -5}, field: "signOnBonus"},
		{name: "an amount beyond the column",
			input: CompensationInput{Currency: "USD", BaseSalary: 1e18}, field: "baseSalary"},
		{name: "a two-letter currency",
			input: CompensationInput{Currency: "US", BaseSalary: 1}, field: "currency"},
		{name: "a currency with a digit in it",
			input: CompensationInput{Currency: "US1", BaseSalary: 1}, field: "currency"},
		{name: "a missing currency",
			input: CompensationInput{BaseSalary: 1}, field: "currency"},
		{name: "an unknown pay frequency",
			input: CompensationInput{Currency: "USD", BaseSalary: 1, PayFrequency: "fortnightly"},
			field: "payFrequency"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := ParseCompensation(tc.input)

			var validationErr *ValidationError
			if !errors.As(err, &validationErr) {
				t.Fatalf("ParseCompensation() error = %v, want a *ValidationError", err)
			}
			if validationErr.Field != tc.field {
				t.Errorf("field = %q, want %q", validationErr.Field, tc.field)
			}
		})
	}
}

func TestPayFrequencyDefaultsToAnnual(t *testing.T) {
	// The portal's own default, and the only reading of a bare "175000" that a
	// recruiter would recognize.
	got, err := ParseCompensation(CompensationInput{Currency: "USD", BaseSalary: 175_000})
	if err != nil {
		t.Fatalf("ParseCompensation() error = %v", err)
	}
	if got.PayFrequency != "annual" {
		t.Errorf("PayFrequency = %q, want %q", got.PayFrequency, "annual")
	}
}

func TestCurrencyIsNormalizedToThreeUpperCaseLetters(t *testing.T) {
	// The column is char(3): a code that is not exactly three characters would
	// be space-padded by Postgres and read back as something else.
	got, err := NormalizeCurrency("  gbp ")
	if err != nil {
		t.Fatalf("NormalizeCurrency() error = %v", err)
	}
	if got != "GBP" {
		t.Errorf("NormalizeCurrency() = %q, want %q", got, "GBP")
	}
}
