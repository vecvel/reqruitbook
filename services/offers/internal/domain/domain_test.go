package domain

import (
	"errors"
	"testing"
	"time"
)

func TestLifecycleAllowsOnlyTheDocumentedMoves(t *testing.T) {
	// The table is the specification: draft -> pending_approval -> approved ->
	// sent -> accepted|declined, with expiry reachable from anything not yet
	// answered. Anything else is a 409, which is what these cases pin.
	tests := []struct {
		name  string
		from  Status
		to    Status
		legal bool
	}{
		{name: "a draft goes for approval", from: StatusDraft, to: StatusPendingApproval, legal: true},
		{name: "an approval is granted", from: StatusPendingApproval, to: StatusApproved, legal: true},
		{name: "an approved offer is sent", from: StatusApproved, to: StatusSent, legal: true},
		{name: "a sent offer is accepted", from: StatusSent, to: StatusAccepted, legal: true},
		{name: "a sent offer is declined", from: StatusSent, to: StatusDeclined, legal: true},
		{name: "an outstanding offer expires", from: StatusSent, to: StatusExpired, legal: true},
		{name: "a draft expires with its application", from: StatusDraft, to: StatusExpired, legal: true},

		// The move this whole service exists to prevent: a package reaching the
		// candidate without anybody having signed it off.
		{name: "a draft cannot be sent", from: StatusDraft, to: StatusSent, legal: false},
		{name: "an unapproved offer cannot be sent", from: StatusPendingApproval, to: StatusSent, legal: false},
		{name: "an approved offer cannot be accepted before it is sent",
			from: StatusApproved, to: StatusAccepted, legal: false},
		{name: "a sent offer cannot be approved again", from: StatusSent, to: StatusApproved, legal: false},
		{name: "an accepted offer cannot be declined", from: StatusAccepted, to: StatusDeclined, legal: false},
		{name: "a declined offer cannot be reopened", from: StatusDeclined, to: StatusSent, legal: false},
		{name: "an expired offer cannot be accepted", from: StatusExpired, to: StatusAccepted, legal: false},
		{name: "an accepted offer cannot expire", from: StatusAccepted, to: StatusExpired, legal: false},
		{name: "an offer cannot go back to draft", from: StatusPendingApproval, to: StatusDraft, legal: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := tc.from.CanTransitionTo(tc.to); got != tc.legal {
				t.Errorf("CanTransitionTo(%s -> %s) = %v, want %v", tc.from, tc.to, got, tc.legal)
			}

			err := Transition(tc.from, tc.to)
			if tc.legal {
				if err != nil {
					t.Errorf("Transition(%s -> %s) = %v, want nil", tc.from, tc.to, err)
				}
				return
			}

			var transitionErr *TransitionError
			if !errors.As(err, &transitionErr) {
				t.Fatalf("Transition(%s -> %s) = %v, want a *TransitionError", tc.from, tc.to, err)
			}
			if transitionErr.From != tc.from || transitionErr.To != tc.to {
				t.Errorf("error carried %s -> %s, want %s -> %s",
					transitionErr.From, transitionErr.To, tc.from, tc.to)
			}
		})
	}
}

func TestOnlyADraftIsEditable(t *testing.T) {
	// An approved package must be the package that was approved: if any later
	// state were editable, the numbers could be changed after sign-off without
	// anyone seeing a second approval.
	for _, status := range []Status{
		StatusPendingApproval, StatusApproved, StatusSent, StatusAccepted, StatusDeclined, StatusExpired,
	} {
		if status.Editable() {
			t.Errorf("%s reports as editable", status)
		}
	}
	if !StatusDraft.Editable() {
		t.Error("a draft reports as not editable")
	}
}

func TestOutstandingMatchesWhatExpiryShouldCatch(t *testing.T) {
	tests := []struct {
		status Status
		want   bool
	}{
		{status: StatusDraft, want: true},
		{status: StatusPendingApproval, want: true},
		{status: StatusApproved, want: true},
		{status: StatusSent, want: true},
		{status: StatusAccepted, want: false},
		{status: StatusDeclined, want: false},
		{status: StatusExpired, want: false},
	}

	for _, tc := range tests {
		t.Run(string(tc.status), func(t *testing.T) {
			if got := tc.status.Outstanding(); got != tc.want {
				t.Errorf("Outstanding() = %v, want %v", got, tc.want)
			}
			if got := tc.status.Terminal(); got == tc.want {
				t.Errorf("Terminal() = %v, want %v", got, !tc.want)
			}
		})
	}
}

func TestUnknownStatusIsNotValid(t *testing.T) {
	// The list filter compares this against an enum column; an unrecognized
	// value has to be a 422 rather than an invalid enum literal reaching
	// Postgres and surfacing as a 500.
	if Status("signed").Valid() {
		t.Error("an invented status reports as valid")
	}
	for _, status := range Statuses() {
		if !Status(status).Valid() {
			t.Errorf("%s is listed but does not report as valid", status)
		}
	}
}

func TestSelfApprovalIsRefusedUnlessItIsAskedFor(t *testing.T) {
	const author = "usr_01HZX3T9QKD6M0V8B2N4C7E5FG"
	const colleague = "usr_01HZX3T9QKD6M0V8B2N4C7E5FH"

	tests := []struct {
		name        string
		createdBy   string
		submittedBy string
		approver    string
		requested   bool
		want        bool
	}{
		{name: "a colleague approves",
			createdBy: author, submittedBy: author, approver: colleague, want: true},
		{name: "the author approves silently",
			createdBy: author, submittedBy: author, approver: author, want: false},
		{name: "the author approves deliberately",
			createdBy: author, submittedBy: author, approver: author, requested: true, want: true},

		// The sidestep the rule exists to close: the author writes the numbers,
		// a colleague presses submit, and the author then approves their own
		// package. Comparing the approver against the submitter alone let this
		// through silently.
		{name: "the author approves what a colleague submitted",
			createdBy: author, submittedBy: colleague, approver: author, want: false},
		{name: "  ...and may still do it deliberately",
			createdBy: author, submittedBy: colleague, approver: author, requested: true, want: true},

		// The mirror case: the submitter is not the author, and approving is
		// somebody else's judgement on work they did not write.
		{name: "the submitter approves what the author wrote",
			createdBy: colleague, submittedBy: author, approver: author, want: false},

		// Nothing to separate: an offer with neither recorded is not evidence
		// that the approver wrote it.
		{name: "nobody was recorded", createdBy: "", submittedBy: "", approver: author, want: true},
		{name: "an unidentified approver", createdBy: author, submittedBy: author, approver: "", want: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := CanSelfApprove(tc.createdBy, tc.submittedBy, tc.approver, tc.requested); got != tc.want {
				t.Errorf("CanSelfApprove() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestExpiredReadsTheDeadlineAndNotTheStatus(t *testing.T) {
	now := time.Date(2026, 3, 1, 12, 0, 0, 0, time.UTC)
	past := now.Add(-time.Second)
	future := now.Add(time.Second)

	tests := []struct {
		name      string
		expiresAt *time.Time
		want      bool
	}{
		{name: "no deadline never expires", expiresAt: nil, want: false},
		{name: "a deadline in the future is live", expiresAt: &future, want: false},
		// The boundary is the point of the test: an offer expiring exactly now
		// is expired, so the sweeper and a mutation arriving in the same second
		// cannot disagree about it.
		{name: "a deadline exactly now has passed", expiresAt: &now, want: true},
		{name: "a deadline in the past has passed", expiresAt: &past, want: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			offer := Offer{Status: StatusSent, ExpiresAt: tc.expiresAt}
			if got := offer.Expired(now); got != tc.want {
				t.Errorf("Expired() = %v, want %v", got, tc.want)
			}
		})
	}
}
