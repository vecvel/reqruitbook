package domain

import (
	"fmt"
	"math"
	"strings"
)

// Where the major/minor conversion happens, and why it happens exactly here.
//
// The company portal sends and renders major units: a recruiter types 175000 and
// expects to read 175000 back. The database, every comparison and every export
// use minor units, because a float cannot hold 1234.05 and a salary that drifts
// by a cent between the letter and payroll is a dispute rather than a rounding
// artefact.
//
// So the boundary is the JSON edge, and it is crossed in two functions and no
// others:
//
//	inbound   ParseCompensation  — the only caller of majorToMinor
//	outbound  NewOfferView       — the only caller of MinorToMajor
//
// Everything between them — the store, the lifecycle, the event payloads — is in
// minor units without exception. A conversion sprinkled at call sites is how a
// number ends up multiplied twice, and the bug surfaces as a salary a hundred
// times too large in one screen and correct in every other.

// minorUnitExponent is how many decimal places a currency actually has.
//
// Most have two, but JPY has none and KWD has three, so assuming 100 would store
// a Japanese salary a hundred times too high and a Kuwaiti one ten times too low.
// Only currencies that differ from two are listed.
var minorUnitExponent = map[string]int{
	"BIF": 0, "CLP": 0, "DJF": 0, "GNF": 0, "ISK": 0, "JPY": 0, "KMF": 0,
	"KRW": 0, "PYG": 0, "RWF": 0, "UGX": 0, "UYI": 0, "VND": 0, "VUV": 0,
	"XAF": 0, "XOF": 0, "XPF": 0,

	"BHD": 3, "IQD": 3, "JOD": 3, "KWD": 3, "LYD": 3, "OMR": 3, "TND": 3,
}

// maxMinorUnits caps a stored amount well inside int64 while staying far above
// any real package. It exists so a caller cannot overflow the column — or the
// arithmetic on the way to it — by sending 1e30.
const maxMinorUnits = int64(1_000_000_000_000_000)

// NormalizeCurrency validates an ISO 4217 alphabetic code and upper-cases it.
//
// The column is char(3): a shorter code would be space-padded by Postgres and
// read back as something that no longer equals what was written.
func NormalizeCurrency(code string) (string, error) {
	normalized := strings.ToUpper(strings.TrimSpace(code))
	if len(normalized) != 3 {
		return "", Invalid("currency", "Currency must be a three-letter ISO 4217 code, such as USD.")
	}
	for _, r := range normalized {
		if r < 'A' || r > 'Z' {
			return "", Invalid("currency", "Currency must be a three-letter ISO 4217 code, such as USD.")
		}
	}
	return normalized, nil
}

// MinorUnitExponent returns the number of decimal places a currency uses.
func MinorUnitExponent(currency string) int {
	if exponent, listed := minorUnitExponent[strings.ToUpper(currency)]; listed {
		return exponent
	}
	return 2
}

// majorToMinor converts a portal-supplied amount into stored minor units.
//
// Unexported on purpose: ParseCompensation is the only caller, so there is one
// inbound conversion in the service rather than one per money field per handler.
func majorToMinor(amount float64, currency, field string) (int64, error) {
	if math.IsNaN(amount) || math.IsInf(amount, 0) {
		return 0, Invalid(field, "Enter an amount as a number.")
	}
	if amount < 0 {
		return 0, Invalid(field, "An amount cannot be negative.")
	}

	scale := math.Pow(10, float64(MinorUnitExponent(currency)))

	// Rounding before the bounds check, because the check must apply to what
	// would actually be stored.
	minor := math.Round(amount * scale)
	if minor > float64(maxMinorUnits) {
		return 0, Invalid(field, fmt.Sprintf("An amount may not exceed %d.", maxMinorUnits/int64(scale)))
	}
	return int64(minor), nil
}

// MinorToMajor converts stored minor units back into the major units the portal
// renders.
//
// NewOfferView is the only caller; see the note at the top of this file.
func MinorToMajor(minor int64, currency string) float64 {
	scale := math.Pow(10, float64(MinorUnitExponent(currency)))
	return float64(minor) / scale
}

// CompensationInput is the money as the portal sends it: major units, because a
// recruiter types 175000 and not 17500000.
type CompensationInput struct {
	Currency     string
	BaseSalary   float64
	SignOnBonus  float64
	PayFrequency string
	AnnualBonus  string
	EquityShares string
}

// Compensation is the money as this service holds it: minor units throughout.
type Compensation struct {
	Currency     string
	BaseSalary   int64
	SignOnBonus  int64
	PayFrequency string
	AnnualBonus  string
	EquityShares string
}

// PayFrequencies are the cadences a base salary may be quoted at.
var payFrequencies = []string{"annual", "monthly", "biweekly", "weekly", "hourly"}

// PayFrequencies lists the recognized cadences, for validation messages.
func PayFrequencies() []string { return append([]string(nil), payFrequencies...) }

// ParseCompensation validates and converts a submitted package.
//
// It is the service's only inbound money conversion. Every field is checked here
// so a handler never has to decide what a valid salary looks like.
func ParseCompensation(in CompensationInput) (Compensation, error) {
	currency, err := NormalizeCurrency(in.Currency)
	if err != nil {
		return Compensation{}, err
	}

	baseSalary, err := majorToMinor(in.BaseSalary, currency, "baseSalary")
	if err != nil {
		return Compensation{}, err
	}
	signOnBonus, err := majorToMinor(in.SignOnBonus, currency, "signOnBonus")
	if err != nil {
		return Compensation{}, err
	}

	frequency := strings.ToLower(strings.TrimSpace(in.PayFrequency))
	if frequency == "" {
		frequency = "annual"
	}
	if !validPayFrequency(frequency) {
		return Compensation{}, Invalid("payFrequency",
			"Pay frequency must be one of: "+strings.Join(payFrequencies, ", ")+".")
	}

	return Compensation{
		Currency:     currency,
		BaseSalary:   baseSalary,
		SignOnBonus:  signOnBonus,
		PayFrequency: frequency,
		AnnualBonus:  strings.TrimSpace(in.AnnualBonus),
		EquityShares: strings.TrimSpace(in.EquityShares),
	}, nil
}

func validPayFrequency(value string) bool {
	for _, allowed := range payFrequencies {
		if allowed == value {
			return true
		}
	}
	return false
}
