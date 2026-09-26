// Package domain holds the applications service's entities and rules.
package domain

import (
	"errors"
	"strings"
	"time"
)

// StageType is the fixed vocabulary behind a company's editable stage names.
//
// The label is the company's; the type is the platform's, so a report that asks
// "how many candidates reached interview?" keeps working after a company renames
// "Interview" to "Chat with the team".
type StageType string

const (
	StageApplied   StageType = "applied"
	StageScreening StageType = "screening"
	StageInterview StageType = "interview"
	StageOffer     StageType = "offer"
	StageHired     StageType = "hired"
	StageRejected  StageType = "rejected"
)

// Valid reports whether the stage type is one the platform recognizes.
func (t StageType) Valid() bool {
	switch t {
	case StageApplied, StageScreening, StageInterview, StageOffer, StageHired, StageRejected:
		return true
	default:
		return false
	}
}

// Terminal reports whether reaching this type ends the process by definition.
//
// A company may mark other stages terminal too, but hired and rejected always
// are: the status of an application in one of them is no longer "in flight".
func (t StageType) Terminal() bool {
	return t == StageHired || t == StageRejected
}

// Status is where an application stands, independent of which stage holds it.
//
// Stage and status answer different questions. The stage is the company's
// process ("Technical Interview"); the status is the outcome, and it is what the
// candidate sees and what the one-application rule is enforced against.
type Status string

const (
	StatusActive    Status = "active"
	StatusRejected  Status = "rejected"
	StatusWithdrawn Status = "withdrawn"
	StatusHired     Status = "hired"
)

// Open reports whether the application is still moving through the pipeline.
func (s Status) Open() bool { return s == StatusActive }

// Valid reports whether the status is one the pipeline recognizes.
func (s Status) Valid() bool {
	switch s {
	case StatusActive, StatusRejected, StatusWithdrawn, StatusHired:
		return true
	default:
		return false
	}
}

// Source records how an application arrived, for attribution reporting.
type Source string

const (
	SourcePortal   Source = "portal"
	SourceNetwork  Source = "network"
	SourceReferral Source = "referral"
	SourceAgency   Source = "agency"
	SourceSourced  Source = "sourced"
	SourceImported Source = "imported"
	SourceUnknown  Source = "unknown"
)

// Valid reports whether the source is one of the recognized channels.
func (s Source) Valid() bool {
	switch s {
	case SourcePortal, SourceNetwork, SourceReferral, SourceAgency, SourceSourced, SourceImported, SourceUnknown:
		return true
	default:
		return false
	}
}

// Sources lists every recognized channel, for validation messages.
func Sources() []string {
	return []string{
		string(SourcePortal), string(SourceNetwork), string(SourceReferral),
		string(SourceAgency), string(SourceSourced), string(SourceImported), string(SourceUnknown),
	}
}

// Stage is one step in a company's pipeline.
type Stage struct {
	ID         string    `json:"id"`
	CompanyID  string    `json:"-"`
	Key        string    `json:"key"`
	Name       string    `json:"name"`
	Order      int       `json:"order"`
	Type       StageType `json:"type"`
	IsTerminal bool      `json:"isTerminal"`
	Color      string    `json:"color"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

// RejectionReason is a company-managed reason an application can be closed with.
type RejectionReason struct {
	ID        string    `json:"id"`
	CompanyID string    `json:"-"`
	Label     string    `json:"label"`
	Order     int       `json:"order"`
	IsActive  bool      `json:"isActive"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// Application links a candidate to a job, once.
type Application struct {
	ID          string `json:"id"`
	CompanyID   string `json:"-"`
	JobID       string `json:"jobId"`
	CandidateID string `json:"candidateId"`

	CandidateName  string `json:"candidateName"`
	CandidateEmail string `json:"candidateEmail"`
	JobTitle       string `json:"jobTitle"`
	CompanyName    string `json:"companyName"`

	Answers   map[string]any `json:"answers"`
	ResumeKey string         `json:"resumeKey,omitempty"`
	Source    Source         `json:"source"`

	StageID string `json:"stageId"`
	Status  Status `json:"status"`
	Rating  *int   `json:"rating,omitempty"`

	RejectionReasonID string     `json:"rejectionReasonId,omitempty"`
	RejectionNote     string     `json:"rejectionNote,omitempty"`
	RejectedBy        string     `json:"rejectedBy,omitempty"`
	RejectedAt        *time.Time `json:"rejectedAt,omitempty"`
	WithdrawnAt       *time.Time `json:"withdrawnAt,omitempty"`
	JobClosedAt       *time.Time `json:"jobClosedAt,omitempty"`

	SubmittedAt time.Time `json:"submittedAt"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`

	// Resolved by joining the stage and reason tables in the same database.
	// They are display values, not stored columns: a renamed stage must read as
	// its new name everywhere, including on applications that entered it before.
	StageName            string    `json:"stageName,omitempty"`
	StageType            StageType `json:"stageType,omitempty"`
	StageColor           string    `json:"stageColor,omitempty"`
	RejectionReasonLabel string    `json:"rejectionReasonLabel,omitempty"`
}

// EventType is what happened to an application.
type EventType string

const (
	EventSubmitted    EventType = "submitted"
	EventStageChanged EventType = "stage_changed"
	EventRejected     EventType = "rejected"
	EventWithdrawn    EventType = "withdrawn"
	EventHired        EventType = "hired"
	EventJobClosed    EventType = "job_closed"
	EventUpdated      EventType = "updated"
)

// Event is one immutable entry in an application's history.
type Event struct {
	ID            string    `json:"id"`
	ApplicationID string    `json:"applicationId"`
	Type          EventType `json:"type"`
	ActorID       string    `json:"actorId,omitempty"`
	ActorType     string    `json:"actorType"`
	FromStageID   string    `json:"fromStageId,omitempty"`
	ToStageID     string    `json:"toStageId,omitempty"`
	ReasonID      string    `json:"reasonId,omitempty"`
	Note          string    `json:"note,omitempty"`
	CreatedAt     time.Time `json:"createdAt"`

	FromStageName string `json:"fromStageName,omitempty"`
	ToStageName   string `json:"toStageName,omitempty"`
}

// Errors returned by the applications domain. Handlers map these onto HTTP
// responses; the messages are safe to show a user.
var (
	ErrApplicationNotFound = errors.New("application not found")
	ErrAlreadyApplied      = errors.New("you have already applied to this job; an application cannot be submitted twice, even after withdrawing")
	ErrNotWithdrawable     = errors.New("this application can no longer be withdrawn")
	ErrAlreadyClosed       = errors.New("this application has already been closed")
	ErrStageNotFound       = errors.New("pipeline stage not found")
	ErrStageInUse          = errors.New("this stage still holds applications; choose a stage to move them to")
	ErrStageKeyTaken       = errors.New("a stage with this key already exists")
	ErrLastStage           = errors.New("a pipeline must keep at least one stage")
	ErrReasonNotFound      = errors.New("rejection reason not found")
	ErrReasonInUse         = errors.New("this reason is recorded against existing applications; deactivate it instead of deleting it")
	ErrReasonLabelTaken    = errors.New("a rejection reason with this label already exists")
	ErrReasonInactive      = errors.New("this rejection reason is no longer active")
	ErrJobNotFound         = errors.New("job not found")
	ErrJobNotAccepting     = errors.New("this job is no longer accepting applications")
)

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

// StageKey derives a stable key from a stage name.
//
// The key is what integrations and reports reference, so it is generated once
// from the original name and left alone when the name is edited later.
func StageKey(name string) string {
	var b strings.Builder
	lastDash := true
	for _, r := range strings.ToLower(strings.TrimSpace(name)) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
			lastDash = false
		default:
			if !lastDash {
				b.WriteByte('-')
				lastDash = true
			}
		}
	}
	return strings.Trim(b.String(), "-")
}

// DefaultStages is the pipeline a company starts with.
//
// Seeding something usable matters more than seeding something neutral: a
// company that opens an empty pipeline has to design a process before it can
// read its first application.
func DefaultStages() []Stage {
	return []Stage{
		{Key: "applied", Name: "Applied", Order: 1, Type: StageApplied, Color: "#64748b"},
		{Key: "screening", Name: "Screening", Order: 2, Type: StageScreening, Color: "#0ea5e9"},
		{Key: "interview", Name: "Interview", Order: 3, Type: StageInterview, Color: "#6366f1"},
		{Key: "offer", Name: "Offer", Order: 4, Type: StageOffer, Color: "#f59e0b"},
		{Key: "hired", Name: "Hired", Order: 5, Type: StageHired, IsTerminal: true, Color: "#16a34a"},
		{Key: "rejected", Name: "Rejected", Order: 6, Type: StageRejected, IsTerminal: true, Color: "#dc2626"},
	}
}

// DefaultRejectionReasons is the reason list a company starts with.
func DefaultRejectionReasons() []RejectionReason {
	labels := []string{
		"Not enough relevant experience",
		"Skills did not match the role",
		"Compensation expectations",
		"Stronger candidate selected",
		"Position closed or filled",
		"Unsuccessful at interview",
		"Candidate unresponsive",
		"Other",
	}

	reasons := make([]RejectionReason, 0, len(labels))
	for i, label := range labels {
		reasons = append(reasons, RejectionReason{Label: label, Order: i + 1, IsActive: true})
	}
	return reasons
}

// StatusForStage derives the application's status from the stage it moved into.
//
// Moving a candidate to a stage typed "hired" is the hire: requiring a separate
// status change would let the two drift apart, and the pipeline board would then
// disagree with the candidate's own view of their application.
func StatusForStage(current Status, stage Stage) Status {
	switch stage.Type {
	case StageHired:
		return StatusHired
	case StageRejected:
		return StatusRejected
	default:
		// A move back out of a terminal stage reopens the application; that is
		// what "I rejected the wrong person" has to be able to undo.
		if current == StatusHired || current == StatusRejected {
			return StatusActive
		}
		return current
	}
}

// CanWithdraw reports whether a candidate may still retract an application.
//
// Withdrawing after a hire or a rejection changes nothing that matters and
// rewrites a record the company acted on, so the door closes once either side
// has finished.
func CanWithdraw(status Status) bool { return status == StatusActive }
