package store

import (
	"strings"
	"testing"
	"time"
)

// The difference between `messaging.read` and `messaging.read_all` has to be in
// the SQL, not in a later filtering step. These tests hold that line: they read
// the query text the store builds and assert that the narrow scope joins through
// conversation_participants while the wide one does not.
func TestCompanyScopeDecidesTheJoin(t *testing.T) {
	tests := []struct {
		name     string
		scope    CompanyScope
		wantJoin bool
	}{
		{
			name:     "a recruiter without read_all is limited to their own threads",
			scope:    CompanyScope{CompanyID: "c1", ActorAccountID: "usr_1"},
			wantJoin: true,
		},
		{
			name:     "read_all widens the scope to the whole company",
			scope:    CompanyScope{CompanyID: "c1", ActorAccountID: "usr_1", All: true},
			wantJoin: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			join := tc.scope.participantJoin()

			if tc.wantJoin {
				if !strings.Contains(join, "conversation_participants") {
					t.Fatalf("join = %q, want a join through conversation_participants", join)
				}
				// The participant filter is tenant-scoped in its own right; a
				// join matching on account_id alone would trust the conversation
				// row's tenancy instead of restating it.
				if !strings.Contains(join, "p.company_id = c.company_id") {
					t.Error("the participant join must be tenant-scoped")
				}
				if !strings.Contains(join, "p.account_id = $2") {
					t.Error("the participant join must filter by the acting recruiter")
				}
				return
			}

			if join != "" {
				t.Errorf("join = %q, want no join for a read_all scope", join)
			}
		})
	}
}

// Both scopes must take the same parameter list, or the two variants could be
// called with arguments meant for the other.
func TestBothScopesTakeTheSameParameters(t *testing.T) {
	narrow := CompanyScope{CompanyID: "c1", ActorAccountID: "usr_1"}
	wide := CompanyScope{CompanyID: "c1", ActorAccountID: "usr_1", All: true}

	if strings.Contains(wide.participantJoin(), "$") {
		t.Error("the read_all variant must not reference a parameter the narrow one supplies elsewhere")
	}
	if placeholders := strings.Count(narrow.participantJoin(), "$2"); placeholders != 1 {
		t.Errorf("the acting recruiter should appear once as $2, found %d", placeholders)
	}
}

func TestCursorTimeAlwaysYieldsAConcreteValue(t *testing.T) {
	// The keyset predicate is one parameterised expression guarded by a boolean,
	// so the timestamp parameter must have an unambiguous type even when no
	// cursor was supplied.
	tests := []struct {
		name string
		set  bool
		at   time.Time
	}{
		{name: "no cursor", set: false, at: time.Time{}},
		{name: "a cursor", set: true, at: time.Date(2026, 3, 14, 15, 9, 26, 0, time.UTC)},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			value, ok := cursorTime(tc.set, tc.at).(time.Time)
			if !ok {
				t.Fatalf("cursorTime() = %T, want time.Time", cursorTime(tc.set, tc.at))
			}
			if value.IsZero() {
				t.Error("cursorTime() returned the zero time, which Postgres cannot type")
			}
			if tc.set && !value.Equal(tc.at) {
				t.Errorf("cursorTime() = %v, want %v", value, tc.at)
			}
		})
	}
}

func TestNullableKeepsEmptyValuesOutOfColumns(t *testing.T) {
	tests := []struct {
		name  string
		value string
		want  any
	}{
		{name: "an empty string is NULL", value: "", want: nil},
		{name: "a value is itself", value: "app_1", want: "app_1"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := nullable(tc.value); got != tc.want {
				t.Errorf("nullable(%q) = %v, want %v", tc.value, got, tc.want)
			}
			if got := nullableUUID(tc.value); got != tc.want {
				t.Errorf("nullableUUID(%q) = %v, want %v", tc.value, got, tc.want)
			}
		})
	}
}

func TestVisibilityBlocksCompany(t *testing.T) {
	visibility := Visibility{
		AccountID:         "acct_1",
		Discoverable:      true,
		HideFromCompanies: []string{"11111111-1111-1111-1111-111111111111"},
	}

	tests := []struct {
		name      string
		companyID string
		want      bool
	}{
		{name: "a blocked company", companyID: "11111111-1111-1111-1111-111111111111", want: true},
		{name: "another company", companyID: "22222222-2222-2222-2222-222222222222", want: false},
		{name: "no company", companyID: "", want: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := visibility.BlocksCompany(tc.companyID); got != tc.want {
				t.Errorf("BlocksCompany(%q) = %v, want %v", tc.companyID, got, tc.want)
			}
		})
	}
}

func TestTruncateBoundsAnErrorMessage(t *testing.T) {
	// A publish failure's text goes into a column; an unbounded broker error
	// should not be able to grow the outbox row without limit.
	if got := truncate(strings.Repeat("e", 900), 500); len(got) != 500 {
		t.Errorf("length = %d, want 500", len(got))
	}
	if got := truncate("short", 500); got != "short" {
		t.Errorf("truncate() = %q, want %q", got, "short")
	}
}
