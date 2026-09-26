// Package domain holds the offers service's entities and rules.
//
// Nothing here performs I/O. The lifecycle, the money conversion and the
// compensation redaction are all pure functions, which is what makes them
// testable without a database and what keeps the rules in one place rather than
// spread across handlers.
package domain

import (
	"errors"
	"fmt"
	"strings"
	"time"
)

// Status is where an offer stands.
//
// The vocabulary matches the company portal's OfferStatus exactly; a status the
// portal cannot render is a status this service must not invent.
type Status string

const (
	StatusDraft           Status = "draft"
	StatusPendingApproval Status = "pending_approval"
	StatusApproved        Status = "approved"
	StatusSent            Status = "sent"
	StatusAccepted        Status = "accepted"
	StatusDeclined        Status = "declined"
	StatusExpired         Status = "expired"
)

// transitions is the whole lifecycle, written out rather than inferred.
//
// It is a table because the alternative — a condition at each call site — is how
// a service ends up with two handlers that disagree about whether an approved
// offer may be edited. Every mutation in this service asks this map first, so
// adding a state means adding a row here and nothing else.
var transitions = map[Status][]Status{
	// An outstanding offer expires from any state before a response: the
	// candidate withdrawing their application kills a draft just as surely as a
	// sent letter running out of time.
	StatusDraft:           {StatusPendingApproval, StatusExpired},
	StatusPendingApproval: {StatusApproved, StatusExpired},
	StatusApproved:        {StatusSent, StatusExpired},
	StatusSent:            {StatusAccepted, StatusDeclined, StatusExpired},

	// Terminal. A candidate who accepted and then wants to decline is a new
	// conversation, not an edit to the record of what they said.
	StatusAccepted: nil,
	StatusDeclined: nil,
	StatusExpired:  nil,
}

// Valid reports whether the status is one the lifecycle recognizes.
func (s Status) Valid() bool {
	_, known := transitions[s]
	return known
}

// Terminal reports whether the offer has reached a state it never leaves.
func (s Status) Terminal() bool {
	return len(transitions[s]) == 0
}

// Outstanding reports whether the offer is still live — not yet answered and not
// yet expired.
//
// It is what "expire the offers on a withdrawn application" means, and it is
// derived from the transition table so it cannot fall out of step with it.
func (s Status) Outstanding() bool {
	return s.CanTransitionTo(StatusExpired)
}

// CanTransitionTo reports whether moving to next is legal.
func (s Status) CanTransitionTo(next Status) bool {
	for _, allowed := range transitions[s] {
		if allowed == next {
			return true
		}
	}
	return false
}

// Editable reports whether the offer's terms may still be changed in place.
//
// Only a draft. Once a package has gone for approval, the numbers somebody is
// about to sign off on must be the numbers they were shown, and once it has been
// approved, editing it would launder a change past the approver entirely.
func (s Status) Editable() bool { return s == StatusDraft }

// Statuses lists every status, for validation messages.
func Statuses() []string {
	return []string{
		string(StatusDraft), string(StatusPendingApproval), string(StatusApproved),
		string(StatusSent), string(StatusAccepted), string(StatusDeclined), string(StatusExpired),
	}
}

// CustomField is one company-specific clause on an offer.
type CustomField struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// Offer is a compensation package put to one candidate for one application.
//
// It deliberately carries no JSON tags. An Offer is never written to a client
// directly — every response goes through NewOfferView, which is the one place
// that decides whether the caller may see the money. A struct that could be
// marshalled straight out is a redaction waiting to be forgotten.
type Offer struct {
	ID            string
	CompanyID     string
	ApplicationID string
	CandidateID   string

	CandidateName string
	JobTitle      string

	Status Status

	Designation    string
	DepartmentName string
	GradeLevel     string

	// Money in minor units. Conversion to and from the major units the portal
	// speaks happens in money.go and nowhere else.
	BaseSalary   int64
	SignOnBonus  int64
	Currency     string
	PayFrequency string
	AnnualBonus  string
	EquityShares string

	JoiningDate        time.Time
	ReportingManager   string
	WorkLocation       string
	ProbationPeriod    string
	NoticePeriod       string
	BenefitsSummary    string
	TemplateType       string
	CustomFields       []CustomField
	OfferLetterContent string
	ExpiresAt          *time.Time

	CreatedBy    string
	SubmittedBy  string
	SubmittedAt  *time.Time
	ApprovedBy   string
	ApprovedAt   *time.Time
	SelfApproved bool

	SentBy      string
	SentAt      *time.Time
	RespondedAt *time.Time

	DeclineReason string

	CreatedAt time.Time
	UpdatedAt time.Time
}

// Expired reports whether the offer's own deadline has passed.
//
// The sweeper is what eventually writes the status, so a mutation arriving in
// the gap between the deadline and the sweep asks this instead of trusting the
// stored status — otherwise an offer could be accepted an hour after it lapsed
// purely because a background worker had not run yet.
func (o Offer) Expired(now time.Time) bool {
	return o.ExpiresAt != nil && !o.ExpiresAt.After(now)
}

// Errors returned by the offers domain. Handlers map these onto HTTP responses;
// the messages are safe to show a user.
var (
	ErrOfferNotFound = errors.New("offer not found")
	ErrNotEditable   = errors.New("only a draft offer can be edited; an offer that has gone for approval is fixed")
	ErrNotDeletable  = errors.New("an offer that has been sent to the candidate cannot be deleted; it is the record of what they were told")
	ErrExpired       = errors.New("this offer has expired")
	ErrSelfApproval  = errors.New("an offer cannot be approved by the person who submitted it")
	// ErrIdempotencyConflict means the same Idempotency-Key was reused for a
	// different offer, which is a client bug rather than a safe replay.
	ErrIdempotencyConflict = errors.New("that Idempotency-Key has already been used for a different offer")
)

// TransitionError reports a move the lifecycle does not allow.
//
// It carries both ends so the message can say what is actually wrong. An illegal
// transition is a conflict with the record's current state, not a malformed
// request, which is why it becomes a 409 and never a 422.
type TransitionError struct {
	From Status
	To   Status
}

func (e *TransitionError) Error() string {
	return fmt.Sprintf("an offer that is %s cannot become %s", humanStatus(e.From), humanStatus(e.To))
}

// Transition checks a move and returns the error to surface when it is illegal.
func Transition(from, to Status) error {
	if !from.CanTransitionTo(to) {
		return &TransitionError{From: from, To: to}
	}
	return nil
}

func humanStatus(s Status) string {
	return strings.ReplaceAll(string(s), "_", " ")
}

// ValidationError reports a caller mistake: a field that is missing, malformed,
// or not allowed.
//
// It exists so the API layer can answer with a 422 and the offending field
// rather than collapsing every rejected input into a generic 500.
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string { return e.Message }

// Invalid builds a validation error for a field.
func Invalid(field, message string) error {
	return &ValidationError{Field: field, Message: message}
}

// CanSelfApprove reports whether an actor may approve what they submitted.
//
// The decision, and why it is this one:
//
// Separation of duties is the point of having an approval step at all — an
// approval the author grants themselves records nothing. So the default is a
// hard no, and it is enforced here rather than in a handler.
//
// The exception exists because refusing outright would break the single-recruiter
// tenant, which is a large share of this product's customers: with no second
// holder of `offers.approve`, every offer would be stuck in pending_approval
// forever and the product would simply not work for them. So an actor who holds
// `offers.approve` may override, but only by saying so explicitly in the request
// (`selfApprove: true`) — never silently. The override is stored on the row as
// self_approved, so an auditor sees the exception was taken rather than having to
// infer it from two identical account ids.
//
// The permission alone is not enough: everyone who reaches the approve endpoint
// holds `offers.approve`, so a check for it there would allow everything.
// Both the author and the submitter count as "the same person".
//
// Comparing only the submitter left the rule trivially sidestepped: the author
// of a package asks a colleague to press submit, and then approves their own
// numbers with no override and no record that they did. Whoever wrote the
// figures is the person separation of duties is about.
func CanSelfApprove(createdBy, submittedBy, approver string, requested bool) bool {
	if approver == "" {
		return true
	}
	if approver != createdBy && approver != submittedBy {
		return true
	}
	return requested
}
