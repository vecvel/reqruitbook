// Package domain holds the interviews service's entities and rules.
//
// Nothing here does I/O. The two decisions that carry the most weight — which
// status changes are legal, and whose scorecard a given caller may read — are
// pure functions for exactly that reason: they are the rules worth testing, and
// a rule that can only be exercised through a database is a rule that stops
// being exercised.
package domain

import (
	"errors"
	"net/url"
	"strings"
	"time"
)

/* -------------------------------------------------------------------------- */
/* Enumerations                                                               */
/* -------------------------------------------------------------------------- */

// Format is how the round is held.
//
// It matters beyond display: a meeting link is meaningful for a video round,
// pointless for an onsite one, and a free-text column would let "vidoe" through
// and produce a round nobody can join.
type Format string

const (
	FormatOnsite Format = "onsite"
	FormatVideo  Format = "video"
	FormatPhone  Format = "phone"
)

// Valid reports whether the format is one the platform recognizes.
func (f Format) Valid() bool {
	switch f {
	case FormatOnsite, FormatVideo, FormatPhone:
		return true
	default:
		return false
	}
}

// Formats lists every recognized format, for validation messages.
func Formats() []string {
	return []string{string(FormatOnsite), string(FormatVideo), string(FormatPhone)}
}

// Status is where a round stands.
type Status string

const (
	StatusScheduled Status = "scheduled"
	StatusCompleted Status = "completed"
	StatusCancelled Status = "cancelled"
	StatusNoShow    Status = "no_show"
)

// Valid reports whether the status is one the pipeline recognizes.
func (s Status) Valid() bool {
	switch s {
	case StatusScheduled, StatusCompleted, StatusCancelled, StatusNoShow:
		return true
	default:
		return false
	}
}

// Statuses lists every recognized status, for validation messages.
func Statuses() []string {
	return []string{
		string(StatusScheduled), string(StatusCompleted),
		string(StatusCancelled), string(StatusNoShow),
	}
}

// Open reports whether the round is still expected to happen.
//
// It is what the application consumer cancels against: rejecting an application
// must clear the rounds that have not yet run and leave the ones that already
// did, because a completed round is a record of something that happened.
func (s Status) Open() bool { return s == StatusScheduled }

// CanTransitionTo reports whether a round may move from this status to next.
//
// The table is written out rather than derived, because each edge is a product
// decision and the ones that are absent are the point:
//
//   - completed is terminal. Scorecards hang off a completed round and reporting
//     counts it; reopening it would retroactively unmake feedback that was given.
//   - cancelled is terminal. Rebooking is a new round, so the history keeps both
//     the cancellation and the replacement rather than overwriting one with the
//     other.
//   - no_show may go back to scheduled, which is the ordinary recovery — the
//     candidate missed the slot and a new one was agreed. It may not go straight
//     to completed: that would claim feedback for a conversation nobody had.
//
// A move to the status a round already holds is not a transition. It is reported
// as illegal rather than ignored so that a double-click on "Cancel" cannot
// quietly overwrite the reason recorded the first time.
func (s Status) CanTransitionTo(next Status) bool {
	if !s.Valid() || !next.Valid() || s == next {
		return false
	}

	switch s {
	case StatusScheduled:
		return next == StatusCompleted || next == StatusCancelled || next == StatusNoShow
	case StatusNoShow:
		return next == StatusScheduled || next == StatusCancelled
	default:
		return false
	}
}

// Recommendation is the interviewer's verdict.
type Recommendation string

const (
	RecommendStrongHire   Recommendation = "strong_hire"
	RecommendHire         Recommendation = "hire"
	RecommendNoHire       Recommendation = "no_hire"
	RecommendStrongNoHire Recommendation = "strong_no_hire"
)

// Valid reports whether the recommendation is one of the four the scale allows.
func (r Recommendation) Valid() bool {
	switch r {
	case RecommendStrongHire, RecommendHire, RecommendNoHire, RecommendStrongNoHire:
		return true
	default:
		return false
	}
}

// Recommendations lists every recognized verdict, for validation messages.
func Recommendations() []string {
	return []string{
		string(RecommendStrongHire), string(RecommendHire),
		string(RecommendNoHire), string(RecommendStrongNoHire),
	}
}

/* -------------------------------------------------------------------------- */
/* Entities                                                                   */
/* -------------------------------------------------------------------------- */

// Interview is one round booked against an application.
//
// The JSON names match the company portal's InterviewRow, so the screen that
// already exists needs a mapping rather than a translation layer.
type Interview struct {
	ID        string `json:"id"`
	CompanyID string `json:"-"`

	ApplicationID string `json:"applicationId"`
	CandidateID   string `json:"candidateId"`

	// Snapshots kept current by the application consumer. They are display
	// values that a list needs on every row; the owning services remain the
	// applications and candidates services.
	CandidateName string `json:"candidateName"`
	JobTitle      string `json:"jobTitle"`

	RoundTitle      string     `json:"roundTitle"`
	RoundType       string     `json:"roundType"`
	ScheduledStart  time.Time  `json:"scheduledStart"`
	DurationMinutes int        `json:"durationMinutes"`
	Format          Format     `json:"format"`
	MeetingLink     string     `json:"meetingLink,omitempty"`
	Notes           string     `json:"notes,omitempty"`
	Status          Status     `json:"status"`
	OutcomeNote     string     `json:"outcomeNote,omitempty"`
	CancelReason    string     `json:"cancellationReason,omitempty"`
	CompletedAt     *time.Time `json:"completedAt,omitempty"`
	CancelledAt     *time.Time `json:"cancelledAt,omitempty"`

	PanelMemberIDs []string `json:"panelMemberIds"`

	// HasScorecard answers the list view's "is feedback in yet?" without
	// disclosing whose or what: it is visible to anyone who may read the round,
	// including an interviewer who may not read a colleague's verdict.
	HasScorecard bool `json:"hasScorecard"`

	CreatedBy string    `json:"createdBy,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// OnPanel reports whether an account sits on this round's panel.
func (i Interview) OnPanel(accountID string) bool {
	if accountID == "" {
		return false
	}
	for _, member := range i.PanelMemberIDs {
		if member == accountID {
			return true
		}
	}
	return false
}

// Scorecard is one interviewer's written verdict on one round.
type Scorecard struct {
	ID          string `json:"id"`
	CompanyID   string `json:"-"`
	InterviewID string `json:"interviewId"`
	AuthorID    string `json:"authorId"`

	OverallRating  int            `json:"overallRating"`
	Recommendation Recommendation `json:"recommendation"`

	TechnicalScore     *int `json:"technicalScore,omitempty"`
	CommunicationScore *int `json:"communicationScore,omitempty"`
	CultureScore       *int `json:"cultureScore,omitempty"`

	Strengths     string `json:"strengths,omitempty"`
	Concerns      string `json:"concerns,omitempty"`
	FeedbackNotes string `json:"feedbackNotes,omitempty"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

/* -------------------------------------------------------------------------- */
/* Scorecard visibility                                                       */
/* -------------------------------------------------------------------------- */

// Viewer is the part of a principal that decides scorecard access.
//
// It is a value rather than the principal itself so the decision below is a
// pure function over three facts: who you are, whether you may read everyone's
// feedback, and whether you may file your own.
type Viewer struct {
	AccountID string
	// ViewAll is `interviews.view_scorecards`.
	ViewAll bool
	// Submit is `interviews.submit_scorecard`.
	Submit bool
}

// MayReadScorecard decides whether a viewer may read one author's card.
//
// The two permissions are deliberately not the same capability.
// `submit_scorecard` lets an interviewer record and read back *their own*
// verdict; `view_scorecards` is what lets anyone read somebody else's. Keeping
// them apart is the whole reason panel feedback is worth collecting: an
// interviewer who can see that three colleagues already said "strong hire"
// before writing their own is no longer an independent signal, and a debrief
// built on four copies of the first opinion looks like consensus.
//
// An author may always read their own card back, because feedback you cannot
// re-read is feedback you cannot correct.
func MayReadScorecard(viewer Viewer, authorID string) bool {
	if viewer.ViewAll {
		return true
	}
	if !viewer.Submit || viewer.AccountID == "" {
		return false
	}
	return viewer.AccountID == authorID
}

// VisibleScorecards filters a round's feedback down to what a viewer may read.
//
// Filtering rather than refusing is what makes the narrow permission useful: an
// interviewer asking for a round's scorecards gets their own back and simply
// does not learn that the others exist.
func VisibleScorecards(viewer Viewer, cards []Scorecard) []Scorecard {
	visible := make([]Scorecard, 0, len(cards))
	for _, card := range cards {
		if MayReadScorecard(viewer, card.AuthorID) {
			visible = append(visible, card)
		}
	}
	return visible
}

// MaySubmitScorecard decides whether an account may file feedback on a round.
//
// The panel is the authority: feedback from somebody who was not in the room is
// not feedback. The exception is a caller holding `interviews.update` — the
// recruiter running the loop, who transcribes a verdict an interviewer gave
// outside the tool and who can add themselves to the panel anyway, so refusing
// them would buy nothing but a detour.
func MaySubmitScorecard(interview Interview, accountID string, canManage bool) bool {
	if accountID == "" {
		return false
	}
	return canManage || interview.OnPanel(accountID)
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

// Errors returned by the interviews domain. Handlers map these onto HTTP
// responses; the messages are safe to show a user.
var (
	ErrInterviewNotFound = errors.New("interview not found")
	// ErrIdempotencyRace is two retries of the same create arriving at once.
	// The round exists; the caller should simply ask for it again.
	ErrIdempotencyRace   = errors.New("this interview is already being scheduled; try again")
	ErrScorecardNotFound = errors.New("scorecard not found")
	ErrNotOnPanel        = errors.New("only a member of this interview's panel may submit a scorecard for it")
	ErrIllegalTransition = errors.New("this interview cannot move to that status")
)

// TransitionError reports a refused status change and names both ends of it, so
// a client can say "already cancelled" rather than "something went wrong".
type TransitionError struct {
	From Status
	To   Status
}

func (e *TransitionError) Error() string {
	if e.From == e.To {
		return "this interview is already " + string(e.From) + "."
	}
	return "an interview that is " + string(e.From) + " cannot become " + string(e.To) + "."
}

// Unwrap lets callers match any refused transition with errors.Is.
func (e *TransitionError) Unwrap() error { return ErrIllegalTransition }

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

// Field length caps. They exist to keep a single request from becoming a row
// no list query can return in reasonable time, not to express a product rule.
const (
	maxTitleLen    = 200
	maxRoundType   = 80
	maxLinkLen     = 2048
	maxNotesLen    = 5000
	maxPanelSize   = 25
	minDurationMin = 5
	maxDurationMin = 600
)

// RoundInput is a proposed interview round, before it is trusted.
//
// Every field is a pointer where "absent" and "cleared" differ, so one shape
// serves both a create and a partial update.
type RoundInput struct {
	RoundTitle      *string
	RoundType       *string
	ScheduledStart  *time.Time
	DurationMinutes *int
	Format          *string
	MeetingLink     *string
	Notes           *string
	PanelMemberIDs  *[]string
}

// ValidateRound checks a round, reporting every problem at once.
//
// Returning the whole map rather than the first failure is what lets a form
// highlight all of its bad fields in one pass instead of one per round trip.
//
// When creating is true the required fields must be present; on a patch an
// absent field means "leave it alone", and only the fields supplied are checked.
func ValidateRound(in RoundInput, creating bool) map[string][]string {
	problems := map[string][]string{}

	switch {
	case in.RoundTitle != nil:
		title := strings.TrimSpace(*in.RoundTitle)
		if title == "" {
			add(problems, "roundTitle", "A round title is required.")
		} else if len(title) > maxTitleLen {
			add(problems, "roundTitle", "A round title may not exceed 200 characters.")
		}
	case creating:
		add(problems, "roundTitle", "A round title is required.")
	}

	if in.RoundType != nil && len(strings.TrimSpace(*in.RoundType)) > maxRoundType {
		add(problems, "roundType", "A round type may not exceed 80 characters.")
	}

	switch {
	case in.ScheduledStart != nil:
		if in.ScheduledStart.IsZero() {
			add(problems, "scheduledStart", "A start time is required.")
		}
	case creating:
		add(problems, "scheduledStart", "A start time is required.")
	}

	if in.DurationMinutes != nil {
		if *in.DurationMinutes < minDurationMin || *in.DurationMinutes > maxDurationMin {
			add(problems, "durationMinutes", "A round must run between 5 and 600 minutes.")
		}
	}

	if in.Format != nil && !Format(strings.TrimSpace(*in.Format)).Valid() {
		add(problems, "format", "Format must be one of: "+strings.Join(Formats(), ", ")+".")
	}

	if in.MeetingLink != nil {
		if link := strings.TrimSpace(*in.MeetingLink); link != "" {
			if len(link) > maxLinkLen {
				add(problems, "meetingLink", "A meeting link may not exceed 2048 characters.")
			} else if !isHTTPURL(link) {
				// A stored "javascript:" link becomes a click target in the
				// portal, so the scheme is checked here rather than trusted to
				// whatever renders it.
				add(problems, "meetingLink", "A meeting link must be an http or https URL.")
			}
		}
	}

	if in.Notes != nil && len(*in.Notes) > maxNotesLen {
		add(problems, "notes", "Notes may not exceed 5000 characters.")
	}

	if in.PanelMemberIDs != nil {
		if len(NormalizePanel(*in.PanelMemberIDs)) > maxPanelSize {
			add(problems, "panelMemberIds", "A panel may not have more than 25 members.")
		}
	}

	return problems
}

// NormalizePanel cleans a submitted panel list.
//
// Duplicates are dropped rather than rejected: a client that sends the same
// interviewer twice means one interviewer, and the panel is a set — the unique
// primary key on the membership table would refuse the insert otherwise, turning
// a harmless input into a 500.
func NormalizePanel(ids []string) []string {
	seen := make(map[string]struct{}, len(ids))
	normalized := make([]string, 0, len(ids))
	for _, id := range ids {
		trimmed := strings.TrimSpace(id)
		if trimmed == "" {
			continue
		}
		if _, duplicate := seen[trimmed]; duplicate {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	return normalized
}

// ScorecardInput is a proposed scorecard, before it is trusted.
type ScorecardInput struct {
	OverallRating      int
	Recommendation     string
	TechnicalScore     *int
	CommunicationScore *int
	CultureScore       *int
	Strengths          string
	Concerns           string
	FeedbackNotes      string
}

// ValidateScorecard checks a submitted scorecard.
//
// The score ranges are also CHECK constraints. Both exist on purpose: the
// constraint keeps a report that averages the column honest no matter what wrote
// the row, and this function is what turns a bad score into a 422 naming the
// field rather than a 500 from a rejected insert.
func ValidateScorecard(in ScorecardInput) map[string][]string {
	problems := map[string][]string{}

	if in.OverallRating < 1 || in.OverallRating > 5 {
		add(problems, "overallRating", "An overall rating between 1 and 5 is required.")
	}

	if !Recommendation(strings.TrimSpace(in.Recommendation)).Valid() {
		add(problems, "recommendation",
			"Recommendation must be one of: "+strings.Join(Recommendations(), ", ")+".")
	}

	checkScore(problems, "technicalScore", in.TechnicalScore)
	checkScore(problems, "communicationScore", in.CommunicationScore)
	checkScore(problems, "cultureScore", in.CultureScore)

	checkLength(problems, "strengths", in.Strengths)
	checkLength(problems, "concerns", in.Concerns)
	checkLength(problems, "feedbackNotes", in.FeedbackNotes)

	return problems
}

func checkScore(problems map[string][]string, field string, score *int) {
	if score != nil && (*score < 1 || *score > 5) {
		add(problems, field, "A score must be between 1 and 5.")
	}
}

func checkLength(problems map[string][]string, field, value string) {
	if len(value) > maxNotesLen {
		add(problems, field, "This field may not exceed 5000 characters.")
	}
}

func add(problems map[string][]string, field, message string) {
	problems[field] = append(problems[field], message)
}

func isHTTPURL(raw string) bool {
	parsed, err := url.Parse(raw)
	if err != nil {
		return false
	}
	return (parsed.Scheme == "http" || parsed.Scheme == "https") && parsed.Host != ""
}
