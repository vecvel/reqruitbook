package domain

import (
	"strings"
	"time"
)

// Filter narrows a trail listing. The same shape serves both the company and
// the platform endpoints, and it contains no company field on purpose: the
// tenant is supplied separately, by the store, from the verified principal. A
// company id that could travel in a filter is a company id a handler could
// forget to overwrite.
type Filter struct {
	Action     string
	EntityType string
	EntityID   string
	ActorID    string
	// From and To bound occurred_at inclusively at both ends.
	From *time.Time
	To   *time.Time
	Page Page
}

// NewFilter validates and normalises the query parameters all three trails
// accept.
//
// Validation happens here rather than in each handler so the list, the export
// and the platform feed cannot drift apart: an export that silently ignored a
// filter the list honoured would produce a CSV that does not match the screen it
// was downloaded from, and nothing about the file would say so.
func NewFilter(action, entityType, entityID, actorID, from, to string, page Page) (Filter, error) {
	filter := Filter{
		Action:     strings.TrimSpace(action),
		EntityType: strings.TrimSpace(entityType),
		EntityID:   strings.TrimSpace(entityID),
		ActorID:    strings.TrimSpace(actorID),
		Page:       page,
	}

	// An action may be given either way round. A caller chasing something
	// specific copies the value out of the `subject` field of an event as often
	// as out of the `action` field of a row, and answering the first with an
	// empty trail is a bug report, not a lesson.
	filter.Action = ActionOf(filter.Action)

	parsedFrom, err := parseBoundary(from, "from", false)
	if err != nil {
		return Filter{}, err
	}
	filter.From = parsedFrom

	parsedTo, err := parseBoundary(to, "to", true)
	if err != nil {
		return Filter{}, err
	}
	filter.To = parsedTo

	// An inverted range matches nothing, and an empty audit trail reads as "this
	// never happened" rather than "you asked the wrong question".
	if filter.From != nil && filter.To != nil && filter.To.Before(*filter.From) {
		return Filter{}, Invalid("to", "The end of the range is before its start.")
	}

	return filter, nil
}

// parseBoundary reads one end of the date range.
//
// A bare date is accepted because that is what a date picker sends, and it is
// read as UTC so two people in different timezones asking for the same day get
// the same rows — a trail whose boundaries move with the reader cannot be quoted
// in an argument.
//
// On the upper bound a bare date means the end of that day, not its midnight.
// `from=2026-01-05&to=2026-01-05` is a request for one day's activity, and
// answering it with the single instant at 00:00:00 would return nothing while
// looking like it had searched. The end is a microsecond short of the next
// midnight because that is the resolution Postgres stores, so nothing can fall
// between this bound and the start of the following day.
func parseBoundary(raw, field string, endOfDay bool) (*time.Time, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, nil
	}

	if parsed, err := time.Parse(time.RFC3339, trimmed); err == nil {
		utc := parsed.UTC()
		return &utc, nil
	}

	parsed, err := time.Parse(time.DateOnly, trimmed)
	if err != nil {
		return nil, Invalid(field, "Use a date in YYYY-MM-DD form or a full RFC 3339 timestamp.")
	}
	if endOfDay {
		parsed = parsed.AddDate(0, 0, 1).Add(-time.Microsecond)
	}
	return &parsed, nil
}
