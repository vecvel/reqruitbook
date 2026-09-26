package domain

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
	"time"
)

func sampleOffer() Offer {
	sent := time.Date(2026, 3, 1, 9, 0, 0, 0, time.UTC)
	expires := time.Date(2026, 3, 15, 9, 0, 0, 0, time.UTC)

	return Offer{
		ID:            "ofr_01HZX3T9QKD6M0V8B2N4C7E5FG",
		CompanyID:     "11111111-1111-1111-1111-111111111111",
		ApplicationID: "app_01HZX3T9QKD6M0V8B2N4C7E5FG",
		CandidateID:   "cnd_01HZX3T9QKD6M0V8B2N4C7E5FG",
		CandidateName: "Priya Raman",
		JobTitle:      "Staff Engineer",
		Status:        StatusSent,

		Designation:    "Staff Engineer",
		DepartmentName: "Platform",
		GradeLevel:     "L6",

		BaseSalary:   17_500_000,
		SignOnBonus:  2_500_000,
		Currency:     "USD",
		PayFrequency: "annual",
		AnnualBonus:  "15% of base",
		EquityShares: "4,000 RSUs over four years",

		JoiningDate:  time.Date(2026, 4, 6, 0, 0, 0, 0, time.UTC),
		WorkLocation: "Bengaluru",
		// Both of these carry the package in words. The portal composes the
		// letter out of the figures above, and a custom field is free text where
		// a relocation allowance ends up — which is why they are gated with the
		// numbers rather than alongside them.
		CustomFields: []CustomField{{Key: "Relocation allowance", Value: "USD 40,000"}},
		OfferLetterContent: "Your annual base salary will be USD 175,000 " +
			"with a sign-on bonus of USD 25,000.",
		ExpiresAt: &expires,
		SentBy:    "usr_01HZX3T9QKD6M0V8B2N4C7E5FG",
		SentAt:    &sent,
		CreatedAt: sent,
		UpdatedAt: sent,
	}
}

// compensationKeys reads the JSON names off CompensationView rather than listing
// them, so a money field added later is covered by these tests the day it is
// added. A hand-written list is exactly the thing the structural redaction
// exists to avoid depending on.
func compensationKeys(t *testing.T) []string {
	t.Helper()

	viewType := reflect.TypeOf(CompensationView{})
	keys := make([]string, 0, viewType.NumField())
	for i := range viewType.NumField() {
		tag := viewType.Field(i).Tag.Get("json")
		name, _, _ := strings.Cut(tag, ",")
		if name == "" || name == "-" {
			t.Fatalf("CompensationView.%s has no json name", viewType.Field(i).Name)
		}
		keys = append(keys, name)
	}
	return keys
}

func marshalView(t *testing.T, view OfferView) map[string]any {
	t.Helper()

	encoded, err := json.Marshal(view)
	if err != nil {
		t.Fatalf("marshalling the view failed: %v", err)
	}

	var decoded map[string]any
	if err := json.Unmarshal(encoded, &decoded); err != nil {
		t.Fatalf("decoding the view failed: %v", err)
	}
	return decoded
}

func TestCompensationIsAbsentWithoutThePermission(t *testing.T) {
	body := marshalView(t, NewOfferView(sampleOffer(), false))

	// Absent, not zero and not null: a rendered 0 is a wrong salary on a screen,
	// and an explicit null still says "there is a number here you may not see".
	for _, key := range compensationKeys(t) {
		if _, present := body[key]; present {
			t.Errorf("%q is present in a redacted offer", key)
		}
	}
}

func TestARedactedOfferIsStillAWorkableOffer(t *testing.T) {
	// The permission gates the money, not the offer. A coordinator without it
	// still has to run the process, which means seeing who the offer is for,
	// which role, where it stands and when it lapses.
	body := marshalView(t, NewOfferView(sampleOffer(), false))

	for _, key := range []string{
		"id", "applicationId", "candidateId", "candidateName", "jobTitle",
		"status", "designation", "departmentName", "joiningDate", "expiresAt",
	} {
		if _, present := body[key]; !present {
			t.Errorf("%q is missing from a redacted offer", key)
		}
	}
}

// The leak that the six structured fields alone did not close.
//
// Redacting baseSalary while shipping a letter that reads "your annual base
// salary will be USD 175,000" redacts nothing. This asserts on the rendered
// JSON rather than on the struct, because the bug was invisible at the struct
// level — every field was assigned, and only the encoding decided what left.
func TestTheLetterDoesNotLeakThePackage(t *testing.T) {
	offer := sampleOffer()
	body := marshalView(t, NewOfferView(offer, false))

	encoded, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("re-encoding the redacted view: %v", err)
	}

	for _, secret := range []string{"175,000", "25,000", "40,000", "Relocation allowance"} {
		if strings.Contains(string(encoded), secret) {
			t.Errorf("a redacted offer still contains %q somewhere in its JSON", secret)
		}
	}

	// And the whole package comes back for somebody who may see it, or the
	// redaction would just be a broken endpoint.
	permitted, err := json.Marshal(marshalView(t, NewOfferView(offer, true)))
	if err != nil {
		t.Fatalf("re-encoding the permitted view: %v", err)
	}
	if !strings.Contains(string(permitted), "175,000") {
		t.Error("the letter is missing for a caller who may read compensation")
	}
}

func TestCompensationIsPresentAndInMajorUnitsWithThePermission(t *testing.T) {
	body := marshalView(t, NewOfferView(sampleOffer(), true))

	for _, key := range compensationKeys(t) {
		if _, present := body[key]; !present {
			t.Errorf("%q is missing from a permitted offer", key)
		}
	}

	// The portal renders what it is given, so the conversion back to major units
	// is the difference between $175,000 and $17,500,000 on screen.
	if got := body["baseSalary"]; got != float64(175_000) {
		t.Errorf("baseSalary = %v, want 175000", got)
	}
	if got := body["signOnBonus"]; got != float64(25_000) {
		t.Errorf("signOnBonus = %v, want 25000", got)
	}
	if got := body["currency"]; got != "USD" {
		t.Errorf("currency = %v, want USD", got)
	}
}

func TestARedactedListLeaksNothing(t *testing.T) {
	// One permission decision covers the whole page. Redacting per row is how a
	// list ends up with one visible salary among twenty hidden ones.
	offers := []Offer{sampleOffer(), sampleOffer(), sampleOffer()}
	views := NewOfferViews(offers, false)

	if len(views) != len(offers) {
		t.Fatalf("rendered %d offers, want %d", len(views), len(offers))
	}

	encoded, err := json.Marshal(views)
	if err != nil {
		t.Fatalf("marshalling the page failed: %v", err)
	}
	for _, key := range compensationKeys(t) {
		if strings.Contains(string(encoded), `"`+key+`"`) {
			t.Errorf("%q appears in a redacted page", key)
		}
	}
}

func TestAnUnknownNameIsNullRatherThanEmpty(t *testing.T) {
	// The portal's OfferRow types these as `string | null` and renders a
	// placeholder for null; an empty string renders as a blank cell.
	offer := sampleOffer()
	offer.CandidateName = ""
	offer.JobTitle = ""

	body := marshalView(t, NewOfferView(offer, true))

	for _, key := range []string{"candidateName", "jobTitle"} {
		value, present := body[key]
		if !present {
			t.Errorf("%q is missing entirely", key)
			continue
		}
		if value != nil {
			t.Errorf("%q = %v, want null", key, value)
		}
	}
}

func TestAJoiningDateIsACalendarDate(t *testing.T) {
	// An RFC 3339 instant would render as the previous day for anyone west of
	// the office, which is the wrong start date on a legal document.
	body := marshalView(t, NewOfferView(sampleOffer(), true))

	if got := body["joiningDate"]; got != "2026-04-06" {
		t.Errorf("joiningDate = %v, want 2026-04-06", got)
	}
}

func TestCustomFieldsAreAlwaysAnArray(t *testing.T) {
	offer := sampleOffer()
	offer.CustomFields = nil

	body := marshalView(t, NewOfferView(offer, true))

	if _, ok := body["customFields"].([]any); !ok {
		t.Errorf("customFields = %#v, want an array", body["customFields"])
	}
}
