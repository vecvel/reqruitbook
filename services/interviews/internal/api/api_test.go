package api

import (
	"testing"
	"time"
)

// A date-only upper bound has to mean the day, not its first instant.
//
// The filter applies `to` inclusively, so resolving "2026-03-04" to midnight
// made `?from=2026-03-04&to=2026-03-04` return nothing for a day with four
// rounds booked — which reads as an empty schedule rather than a bad query, and
// is exactly the kind of wrong answer nobody reports as a bug.
func TestADateOnlyUpperBoundCoversTheWholeDay(t *testing.T) {
	to, err := parseDate("2026-03-04", "to", true)
	if err != nil {
		t.Fatalf("parsing a date-only upper bound: %v", err)
	}

	lastRoundOfTheDay := time.Date(2026, 3, 4, 23, 59, 59, 0, time.UTC)
	if to.Before(lastRoundOfTheDay) {
		t.Errorf("to = %s, which excludes a round at %s", to, lastRoundOfTheDay)
	}

	// ...and does not spill into the next day, or a one-day query would show
	// tomorrow's first interview as today's.
	firstRoundOfTheNextDay := time.Date(2026, 3, 5, 0, 0, 0, 0, time.UTC)
	if !to.Before(firstRoundOfTheNextDay) {
		t.Errorf("to = %s, which includes a round at %s", to, firstRoundOfTheNextDay)
	}
}

// The lower bound keeps midnight: "from this date" means from its start.
func TestADateOnlyLowerBoundStaysAtMidnight(t *testing.T) {
	from, err := parseDate("2026-03-04", "from", false)
	if err != nil {
		t.Fatalf("parsing a date-only lower bound: %v", err)
	}

	want := time.Date(2026, 3, 4, 0, 0, 0, 0, time.UTC)
	if !from.Equal(want) {
		t.Errorf("from = %s, want %s", from, want)
	}
}

// Somebody who wrote a time meant that time, on either bound.
func TestAnExplicitTimestampIsLeftAlone(t *testing.T) {
	for _, endOfDay := range []bool{false, true} {
		parsed, err := parseDate("2026-03-04T14:30:00Z", "to", endOfDay)
		if err != nil {
			t.Fatalf("parsing an explicit timestamp: %v", err)
		}
		want := time.Date(2026, 3, 4, 14, 30, 0, 0, time.UTC)
		if !parsed.Equal(want) {
			t.Errorf("endOfDay=%v gave %s, want %s", endOfDay, parsed, want)
		}
	}
}

func TestAnUnparseableDateIsAValidationFailure(t *testing.T) {
	// A 422 naming the field, not a 500 and not a silently ignored filter —
	// an ignored bound would quietly widen the query instead of refusing it.
	if _, err := parseDate("last tuesday", "to", true); err == nil {
		t.Fatal("expected an unparseable date to be refused")
	}
	if got, err := parseDate("  ", "to", true); err != nil || got != nil {
		t.Fatalf("expected a blank filter to be absent, got %v (%v)", got, err)
	}
}
