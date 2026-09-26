// Package domain holds the messaging service's entities and the rules that need
// no database to decide.
//
// The rules that live here are the ones a reviewer should be able to read
// without tracing a query: what a message may contain, whose object keys may be
// attached to it, and which conversation shapes are coherent. Everything that
// needs a row — who may open a thread, who may see one — lives in store and api,
// where the tenant predicate is written alongside it.
package domain

import (
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
)

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

// SenderType is which side of a conversation a message came from.
type SenderType string

const (
	SenderCompany   SenderType = "company"
	SenderCandidate SenderType = "candidate"
)

// Valid reports whether the sender type is one the schema accepts.
func (s SenderType) Valid() bool {
	return s == SenderCompany || s == SenderCandidate
}

// Opposite returns the side a message is addressed to, which is the side whose
// unread counter moves and whose read receipt clears it.
func (s SenderType) Opposite() SenderType {
	if s == SenderCompany {
		return SenderCandidate
	}
	return SenderCompany
}

// Origin records why a conversation exists.
type Origin string

const (
	// OriginRecruiter is a thread a recruiter opened by hand.
	OriginRecruiter Origin = "recruiter"
	// OriginApproach is a thread opened automatically from a talent-search
	// approach, so the candidate's reply lands somewhere.
	OriginApproach Origin = "approach"
	// OriginApplication is a thread about an application the candidate submitted.
	OriginApplication Origin = "application"
)

// CountsTowardDailyLimit reports whether opening this kind of conversation is
// company-initiated outreach.
//
// An application-scoped thread is a reply to something the candidate started, so
// throttling it would punish responsiveness rather than spam.
func (o Origin) CountsTowardDailyLimit() bool {
	return o == OriginRecruiter || o == OriginApproach
}

/* -------------------------------------------------------------------------- */
/* Entities                                                                   */
/* -------------------------------------------------------------------------- */

// Conversation is one recruiter-to-candidate thread.
type Conversation struct {
	ID        string
	CompanyID string
	// CandidateAccountID is the identity account, not a candidate profile id.
	CandidateAccountID string
	ApplicationID      string
	JobID              string
	Subject            string
	Origin             Origin
	OriginRef          string
	OpenedByAccountID  string

	LastActivityAt     time.Time
	LastMessagePreview string
	LastMessageSender  SenderType

	CompanyUnread   int
	CandidateUnread int

	ClosedAt  *time.Time
	CreatedAt time.Time
	UpdatedAt time.Time
}

// Attachment references a file already in object storage.
//
// The service records the key and never the bytes: per the platform's file
// contract a client uploads under a presigned PUT and then cites the key here.
type Attachment struct {
	ObjectKey   string `json:"objectKey"`
	Filename    string `json:"filename"`
	ContentType string `json:"contentType"`
	SizeBytes   int64  `json:"sizeBytes"`
}

// Message is one entry in a thread.
type Message struct {
	ID                 string
	ConversationID     string
	CompanyID          string
	CandidateAccountID string
	SenderType         SenderType
	SenderAccountID    string
	Body               string
	Attachments        []Attachment
	SentAt             time.Time
	// ReadAt is when the other side read it; nil while unread.
	ReadAt *time.Time
}

/* -------------------------------------------------------------------------- */
/* Limits                                                                     */
/* -------------------------------------------------------------------------- */

const (
	// MaxBodyRunes bounds a message. Generous enough for a real note, small
	// enough that a thread cannot be used as a file transfer channel.
	MaxBodyRunes = 8000
	// MaxSubjectRunes bounds the thread subject.
	MaxSubjectRunes = 200
	// MaxAttachments per message.
	MaxAttachments = 10
	// MaxAttachmentBytes is the largest file a message may cite.
	MaxAttachmentBytes = 25 << 20
	// PreviewRunes is how much of a message is copied onto the conversation row
	// and into the published event. A preview is enough for an inbox line and an
	// email teaser; carrying the whole body would put private correspondence in
	// the event stream, where every consumer and its retention policy can see it.
	PreviewRunes = 280
)

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

var (
	// ErrConversationNotFound is returned both when a thread does not exist and
	// when it belongs to someone else. The caller cannot tell the two apart, and
	// that is the point: a 403 would confirm the id is real.
	ErrConversationNotFound = errors.New("conversation not found")
	// ErrMessageNotFound is returned when a message id resolves to nothing the
	// caller may see.
	ErrMessageNotFound = errors.New("message not found")
	// ErrConversationExists means a thread with this candidate and context is
	// already open.
	ErrConversationExists = errors.New("a conversation with this candidate is already open")
	// ErrConversationClosed means the thread no longer accepts messages.
	ErrConversationClosed = errors.New("this conversation has been closed")
	// ErrCandidateUnreachable covers every reason a company may not open a
	// thread with a candidate: no application, not discoverable, or blocked.
	//
	// The reasons are deliberately not distinguished. Separate messages would
	// turn this endpoint into an oracle for "has this person blocked us?" and
	// "is this person job hunting?", which is exactly the information a
	// candidate's visibility settings exist to withhold.
	ErrCandidateUnreachable = errors.New("this candidate is not accepting messages from your company")
	// ErrCandidateNotFound means no such candidate account exists.
	ErrCandidateNotFound = errors.New("that candidate could not be found")
	// ErrDailyLimitReached means the company has opened as many conversations
	// today as it is allowed.
	ErrDailyLimitReached = errors.New("your company has opened as many new conversations today as it may; existing threads are unaffected")
	// ErrDirectoryUnavailable means the candidates service could not be reached,
	// so eligibility could not be established.
	ErrDirectoryUnavailable = errors.New("candidate details are temporarily unavailable; please try again shortly")
	// ErrInvalidCursor means the page token did not decode.
	ErrInvalidCursor = errors.New("the page cursor is not valid")
)

// ValidationError carries field-level failures for a 422.
type ValidationError struct {
	Fields map[string][]string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("validation failed for %d field(s)", len(e.Fields))
}

// Invalid builds a single-field validation error.
func Invalid(field, message string) error {
	return &ValidationError{Fields: map[string][]string{field: {message}}}
}

// merge folds another field error into this one so a caller sees every problem
// at once rather than fixing them one round trip at a time.
func (e *ValidationError) merge(err error) {
	var other *ValidationError
	if !errors.As(err, &other) {
		return
	}
	if e.Fields == nil {
		e.Fields = map[string][]string{}
	}
	for field, messages := range other.Fields {
		e.Fields[field] = append(e.Fields[field], messages...)
	}
}

func (e *ValidationError) orNil() error {
	if len(e.Fields) == 0 {
		return nil
	}
	return e
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

// NewMessage is a validated request to post into a thread.
type NewMessage struct {
	Body        string
	Attachments []Attachment
}

// ValidateMessage checks a message and normalises it.
//
// owner is the object-key prefix the sender is allowed to cite — see
// AttachmentPrefix. It is derived from the verified principal, never from the
// request, so a recruiter cannot attach a file from another tenant's bucket
// prefix by naming its key.
func ValidateMessage(body string, attachments []Attachment, owner string) (NewMessage, error) {
	failures := &ValidationError{Fields: map[string][]string{}}

	trimmed := strings.TrimSpace(body)
	switch {
	case trimmed == "" && len(attachments) == 0:
		failures.merge(Invalid("body", "A message needs text or at least one attachment."))
	case utf8.RuneCountInString(trimmed) > MaxBodyRunes:
		failures.merge(Invalid("body", fmt.Sprintf("A message may be at most %d characters.", MaxBodyRunes)))
	}

	cleaned, err := ValidateAttachments(attachments, owner)
	if err != nil {
		failures.merge(err)
	}

	if err := failures.orNil(); err != nil {
		return NewMessage{}, err
	}
	return NewMessage{Body: trimmed, Attachments: cleaned}, nil
}

// ValidateAttachments checks that every cited object belongs to the sender.
func ValidateAttachments(attachments []Attachment, owner string) ([]Attachment, error) {
	if len(attachments) == 0 {
		return []Attachment{}, nil
	}

	failures := &ValidationError{Fields: map[string][]string{}}
	if len(attachments) > MaxAttachments {
		failures.merge(Invalid("attachments",
			fmt.Sprintf("A message may carry at most %d attachments.", MaxAttachments)))
	}

	cleaned := make([]Attachment, 0, len(attachments))
	seen := make(map[string]struct{}, len(attachments))

	for i, attachment := range attachments {
		field := fmt.Sprintf("attachments.%d", i)

		key := strings.TrimSpace(attachment.ObjectKey)
		switch {
		case key == "":
			failures.merge(Invalid(field, "An attachment needs an object key."))
			continue
		case owner != "" && !strings.HasPrefix(key, owner):
			// The prefix is the tenant boundary that also exists in the bucket
			// policy. Citing a key outside it would be an attempt to read
			// somebody else's object through a message body.
			failures.merge(Invalid(field, "That file does not belong to you."))
			continue
		}

		if _, duplicate := seen[key]; duplicate {
			failures.merge(Invalid(field, "That file is attached more than once."))
			continue
		}
		seen[key] = struct{}{}

		if attachment.SizeBytes <= 0 || attachment.SizeBytes > MaxAttachmentBytes {
			failures.merge(Invalid(field, fmt.Sprintf("An attachment must be between 1 byte and %d MB.",
				MaxAttachmentBytes>>20)))
			continue
		}

		cleaned = append(cleaned, Attachment{
			ObjectKey:   key,
			Filename:    truncateRunes(strings.TrimSpace(attachment.Filename), 255),
			ContentType: truncateRunes(strings.TrimSpace(attachment.ContentType), 128),
			SizeBytes:   attachment.SizeBytes,
		})
	}

	if err := failures.orNil(); err != nil {
		return nil, err
	}
	return cleaned, nil
}

// ValidateSubject normalises an optional thread subject.
func ValidateSubject(subject string) (string, error) {
	trimmed := strings.TrimSpace(subject)
	if utf8.RuneCountInString(trimmed) > MaxSubjectRunes {
		return "", Invalid("subject", fmt.Sprintf("A subject may be at most %d characters.", MaxSubjectRunes))
	}
	return trimmed, nil
}

// AttachmentPrefix returns the object-storage prefix a principal owns.
//
// It mirrors the platform's file contract: `company/<companyId>/...` for a
// recruiter and `candidate/<accountId>/...` for a candidate.
func AttachmentPrefix(sender SenderType, companyID, accountID string) string {
	if sender == SenderCompany {
		return "company/" + companyID + "/"
	}
	return "candidate/" + accountID + "/"
}

// Preview trims a body down to what an inbox line and an event may carry.
func Preview(body string) string {
	return truncateRunes(strings.Join(strings.Fields(body), " "), PreviewRunes)
}

func truncateRunes(value string, limit int) string {
	if utf8.RuneCountInString(value) <= limit {
		return value
	}
	runes := []rune(value)
	return string(runes[:limit])
}

/* -------------------------------------------------------------------------- */
/* Identifiers                                                                */
/* -------------------------------------------------------------------------- */

// ValidUUID reports whether a value has the shape of a uuid.
//
// Company ids are uuids minted elsewhere; checking the shape before it reaches a
// query turns a malformed tenant into a refusal rather than a cast error
// surfacing to a client as a 500.
func ValidUUID(value string) bool {
	if len(value) != 36 {
		return false
	}
	for i, r := range value {
		switch i {
		case 8, 13, 18, 23:
			if r != '-' {
				return false
			}
		default:
			if !isHexDigit(r) {
				return false
			}
		}
	}
	return true
}

func isHexDigit(r rune) bool {
	return (r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')
}

// ValidAccountID bounds an account identifier before it reaches a query.
//
// Identity mints prefixed ULIDs; anything wildly outside that shape is a
// malformed request, and rejecting it early keeps a 500 out of the logs.
func ValidAccountID(value string) bool {
	trimmed := strings.TrimSpace(value)
	return trimmed != "" && len(trimmed) <= 64 && trimmed == value
}
