package domain

import "time"

// The compensation redaction.
//
// `offers.view_compensation` gates the money, not the offer. Somebody holding
// `offers.read` without it must still see the offer — who it is for, which role,
// what state it is in, when it lapses — with every compensation field absent from
// the JSON. Absent, not zeroed and not null: a `"baseSalary": 0` is a lie a
// client will render, and a `"baseSalary": null` still tells the reader an offer
// they may not price exists at this shape.
//
// The redaction is structural rather than conditional. CompensationView is an
// embedded pointer: when it is nil, encoding/json omits every promoted field at
// once, so a money field added to CompensationView later is redacted by
// construction. Nothing has to remember it, which is the point — a redaction you
// have to remember is one you will eventually forget at the seventh call site.
//
// NewOfferView is the only place an Offer becomes something a client can see.
// Offer itself carries no JSON tags, so a handler that tried to write one
// directly would emit an object of Go field names and be obviously wrong in
// review, rather than quietly correct-looking and leaking salaries.

// CompensationView is the money on an offer, in the major units the portal
// speaks.
type CompensationView struct {
	BaseSalary   float64 `json:"baseSalary"`
	SignOnBonus  float64 `json:"signOnBonus"`
	Currency     string  `json:"currency"`
	PayFrequency string  `json:"payFrequency"`
	AnnualBonus  string  `json:"annualBonus,omitempty"`
	EquityShares string  `json:"equityShares,omitempty"`

	// The letter and the custom fields live here, with the numbers, because
	// that is where the numbers actually are.
	//
	// Redacting the six structured fields and shipping the rendered letter is
	// redacting nothing: the portal composes that letter out of these very
	// figures — "Base Compensation: $175,000", "Sign-On Bonus: $25,000" — and a
	// custom field is free text a recruiter types, which is exactly where a
	// relocation allowance or a retention bonus ends up. A reader with
	// `offers.read` alone was getting the whole package in prose from an
	// endpoint that believed it had withheld it.
	//
	// Structured or prose, it is the same secret, so it is gated by the same
	// pointer.
	CustomFields       []CustomField `json:"customFields"`
	OfferLetterContent string        `json:"offerLetterContent,omitempty"`
}

// OfferView is an offer as a client sees it.
//
// The field names match the company portal's OfferRow interface, so the portal
// consumes this response without a translation layer that could drift.
type OfferView struct {
	ID            string `json:"id"`
	ApplicationID string `json:"applicationId"`
	CandidateID   string `json:"candidateId"`

	// Null rather than empty when unknown: the portal's OfferRow types these as
	// `string | null`, and an empty string would render as a blank name instead
	// of a placeholder.
	CandidateName *string `json:"candidateName"`
	JobTitle      *string `json:"jobTitle"`

	Status Status `json:"status"`

	Designation    string `json:"designation"`
	DepartmentName string `json:"departmentName"`
	GradeLevel     string `json:"gradeLevel,omitempty"`

	// A calendar date, not an instant: a joining date of the 1st is the 1st in
	// the office's own timezone, and an RFC 3339 timestamp would render as the
	// day before for anyone west of it.
	JoiningDate      string     `json:"joiningDate"`
	ReportingManager string     `json:"reportingManager,omitempty"`
	WorkLocation     string     `json:"workLocation,omitempty"`
	ProbationPeriod  string     `json:"probationPeriod,omitempty"`
	NoticePeriod     string     `json:"noticePeriod,omitempty"`
	BenefitsSummary  string     `json:"benefitsSummary,omitempty"`
	TemplateType     string     `json:"templateType,omitempty"`
	ExpiresAt        *time.Time `json:"expiresAt"`

	SubmittedBy  string     `json:"submittedBy,omitempty"`
	SubmittedAt  *time.Time `json:"submittedAt,omitempty"`
	ApprovedBy   string     `json:"approvedBy,omitempty"`
	ApprovedAt   *time.Time `json:"approvedAt,omitempty"`
	SelfApproved bool       `json:"selfApproved,omitempty"`
	SentBy       string     `json:"sentBy,omitempty"`
	SentAt       *time.Time `json:"sentAt,omitempty"`
	RespondedAt  *time.Time `json:"respondedAt,omitempty"`
	// The candidate's own words, shown to the recruiter who has to decide what
	// to do next.
	DeclineReason string `json:"declineReason,omitempty"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`

	// Nil for a caller without `offers.view_compensation`; see the note above.
	*CompensationView
}

// NewOfferView renders one offer for a caller.
//
// includeCompensation is the caller's `offers.view_compensation`, resolved once
// per request from the principal. It is passed in rather than read here because
// the domain does not know about HTTP principals — and because a single boolean
// at the edge is easier to audit than a permission lookup buried in a mapper.
func NewOfferView(offer Offer, includeCompensation bool) OfferView {
	view := OfferView{
		ID:            offer.ID,
		ApplicationID: offer.ApplicationID,
		CandidateID:   offer.CandidateID,
		CandidateName: optional(offer.CandidateName),
		JobTitle:      optional(offer.JobTitle),
		Status:        offer.Status,

		Designation:    offer.Designation,
		DepartmentName: offer.DepartmentName,
		GradeLevel:     offer.GradeLevel,

		JoiningDate:      offer.JoiningDate.Format(time.DateOnly),
		ReportingManager: offer.ReportingManager,
		WorkLocation:     offer.WorkLocation,
		ProbationPeriod:  offer.ProbationPeriod,
		NoticePeriod:     offer.NoticePeriod,
		BenefitsSummary:  offer.BenefitsSummary,
		TemplateType:     offer.TemplateType,
		ExpiresAt:        offer.ExpiresAt,

		SubmittedBy:   offer.SubmittedBy,
		SubmittedAt:   offer.SubmittedAt,
		ApprovedBy:    offer.ApprovedBy,
		ApprovedAt:    offer.ApprovedAt,
		SelfApproved:  offer.SelfApproved,
		SentBy:        offer.SentBy,
		SentAt:        offer.SentAt,
		RespondedAt:   offer.RespondedAt,
		DeclineReason: offer.DeclineReason,

		CreatedAt: offer.CreatedAt,
		UpdatedAt: offer.UpdatedAt,
	}

	if includeCompensation {
		fields := offer.CustomFields
		// An empty slice rather than nil, so a client iterates over `[]` instead
		// of having to guard against a JSON null.
		if fields == nil {
			fields = []CustomField{}
		}
		view.CompensationView = &CompensationView{
			BaseSalary:         MinorToMajor(offer.BaseSalary, offer.Currency),
			SignOnBonus:        MinorToMajor(offer.SignOnBonus, offer.Currency),
			Currency:           offer.Currency,
			PayFrequency:       offer.PayFrequency,
			AnnualBonus:        offer.AnnualBonus,
			EquityShares:       offer.EquityShares,
			CustomFields:       fields,
			OfferLetterContent: offer.OfferLetterContent,
		}
	}

	return view
}

// NewOfferViews renders a page of offers under one permission decision.
func NewOfferViews(offers []Offer, includeCompensation bool) []OfferView {
	views := make([]OfferView, 0, len(offers))
	for _, offer := range offers {
		views = append(views, NewOfferView(offer, includeCompensation))
	}
	return views
}

func optional(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
