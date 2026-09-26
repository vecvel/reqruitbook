package domain

import (
	"errors"
	"testing"
	"time"
)

/* -------------------------------------------------------------------------- */
/* Scorecard visibility                                                       */
/* -------------------------------------------------------------------------- */

// These are the tests that matter most in this service.
//
// `interviews.submit_scorecard` lets an interviewer record and re-read their own
// verdict. `interviews.view_scorecards` is what lets anybody read somebody
// else's. If the two ever collapse into one, panel feedback stops being
// independent — an interviewer who reads three "strong hire" cards before
// writing theirs is no longer a fourth opinion — and nothing else in the system
// would notice. So the decision is a pure function, and this is where it is
// pinned.

func TestMayReadScorecardKeepsPanelFeedbackIndependent(t *testing.T) {
	const (
		me        = "usr_me"
		colleague = "usr_colleague"
	)

	tests := []struct {
		name   string
		viewer Viewer
		author string
		want   bool
	}{
		{
			name:   "an interviewer reads their own card back",
			viewer: Viewer{AccountID: me, Submit: true},
			author: me,
			want:   true,
		},
		{
			name:   "an interviewer may not read a colleague's card",
			viewer: Viewer{AccountID: me, Submit: true},
			author: colleague,
			want:   false,
		},
		{
			name:   "view_scorecards reads the whole panel",
			viewer: Viewer{AccountID: me, ViewAll: true},
			author: colleague,
			want:   true,
		},
		{
			name:   "view_scorecards also covers the holder's own card",
			viewer: Viewer{AccountID: me, ViewAll: true},
			author: me,
			want:   true,
		},
		{
			name:   "holding neither key reads nothing, not even one's own",
			viewer: Viewer{AccountID: me},
			author: me,
			want:   false,
		},
		{
			// A principal with no subject would otherwise match an empty
			// author_id and read whatever was written without one.
			name:   "an unidentified viewer matches no author",
			viewer: Viewer{Submit: true},
			author: "",
			want:   false,
		},
		{
			// The mirror image: a row whose author is somehow blank must not
			// become readable by whoever asks first.
			name:   "an unattributed card is not anybody's own",
			viewer: Viewer{AccountID: me, Submit: true},
			author: "",
			want:   false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := MayReadScorecard(tc.viewer, tc.author); got != tc.want {
				t.Fatalf("MayReadScorecard(%+v, %q) = %v, want %v", tc.viewer, tc.author, got, tc.want)
			}
		})
	}
}

func TestVisibleScorecardsHidesColleaguesFromASubmitOnlyInterviewer(t *testing.T) {
	cards := []Scorecard{
		{ID: "scr_1", AuthorID: "usr_me", Recommendation: RecommendHire},
		{ID: "scr_2", AuthorID: "usr_colleague", Recommendation: RecommendStrongNoHire},
		{ID: "scr_3", AuthorID: "usr_third", Recommendation: RecommendStrongHire},
	}

	visible := VisibleScorecards(Viewer{AccountID: "usr_me", Submit: true}, cards)

	if len(visible) != 1 {
		t.Fatalf("expected an interviewer to see only their own card, got %d", len(visible))
	}
	if visible[0].ID != "scr_1" {
		t.Fatalf("expected scr_1, got %s", visible[0].ID)
	}

	all := VisibleScorecards(Viewer{AccountID: "usr_me", ViewAll: true}, cards)
	if len(all) != len(cards) {
		t.Fatalf("expected view_scorecards to see all %d cards, got %d", len(cards), len(all))
	}
}

func TestVisibleScorecardsReturnsAnEmptyListNotNil(t *testing.T) {
	// A JSON null would make the portal branch on it; "nobody's feedback is
	// visible to you" is an empty list.
	visible := VisibleScorecards(Viewer{AccountID: "usr_me"}, nil)
	if visible == nil {
		t.Fatal("expected an empty slice, got nil")
	}
	if len(visible) != 0 {
		t.Fatalf("expected no visible cards, got %d", len(visible))
	}
}

func TestMaySubmitScorecardRequiresAPanelSeat(t *testing.T) {
	interview := Interview{PanelMemberIDs: []string{"usr_panelist", "usr_other"}}

	tests := []struct {
		name      string
		accountID string
		canManage bool
		want      bool
	}{
		{name: "a panel member may file feedback", accountID: "usr_panelist", want: true},
		{name: "somebody who was not in the room may not", accountID: "usr_stranger", want: false},
		{
			name:      "the recruiter running the loop may transcribe a verdict",
			accountID: "usr_stranger",
			canManage: true,
			want:      true,
		},
		{name: "an unidentified caller may not, even with interviews.update", canManage: true, want: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := MaySubmitScorecard(interview, tc.accountID, tc.canManage); got != tc.want {
				t.Fatalf("MaySubmitScorecard(%q, canManage=%v) = %v, want %v",
					tc.accountID, tc.canManage, got, tc.want)
			}
		})
	}
}

func TestMaySubmitScorecardRefusesOnceSomebodyIsOffThePanel(t *testing.T) {
	// Replacing the panel has to actually remove the right to file, which is why
	// membership is a row rather than a field on the request.
	interview := Interview{PanelMemberIDs: []string{"usr_a"}}
	if !MaySubmitScorecard(interview, "usr_a", false) {
		t.Fatal("expected the seated panelist to be allowed")
	}

	interview.PanelMemberIDs = []string{"usr_b"}
	if MaySubmitScorecard(interview, "usr_a", false) {
		t.Fatal("expected a removed panelist to lose the right to file feedback")
	}
}

/* -------------------------------------------------------------------------- */
/* Status transitions                                                         */
/* -------------------------------------------------------------------------- */

func TestStatusTransitions(t *testing.T) {
	tests := []struct {
		name string
		from Status
		to   Status
		want bool
	}{
		{name: "a booked round is completed", from: StatusScheduled, to: StatusCompleted, want: true},
		{name: "a booked round is cancelled", from: StatusScheduled, to: StatusCancelled, want: true},
		{name: "a candidate does not turn up", from: StatusScheduled, to: StatusNoShow, want: true},
		{name: "a missed round is rebooked", from: StatusNoShow, to: StatusScheduled, want: true},
		{name: "a missed round is abandoned", from: StatusNoShow, to: StatusCancelled, want: true},

		{
			// Claiming feedback for a conversation nobody had.
			name: "a missed round cannot be marked completed",
			from: StatusNoShow, to: StatusCompleted, want: false,
		},
		{
			// Scorecards hang off a completed round and reporting counts it.
			name: "a completed round is terminal",
			from: StatusCompleted, to: StatusScheduled, want: false,
		},
		{name: "a completed round cannot be cancelled", from: StatusCompleted, to: StatusCancelled, want: false},
		{
			// Rebooking is a new round, so the history keeps both.
			name: "a cancelled round is terminal",
			from: StatusCancelled, to: StatusScheduled, want: false,
		},
		{name: "a cancelled round cannot be completed", from: StatusCancelled, to: StatusCompleted, want: false},

		{
			// A double-click on Cancel must not quietly overwrite the reason
			// recorded the first time.
			name: "a status does not transition to itself",
			from: StatusCancelled, to: StatusCancelled, want: false,
		},
		{name: "scheduled to scheduled is not a change", from: StatusScheduled, to: StatusScheduled, want: false},

		{name: "an unknown target is refused", from: StatusScheduled, to: Status("finished"), want: false},
		{name: "an unknown source is refused", from: Status("pending"), to: StatusCompleted, want: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := tc.from.CanTransitionTo(tc.to); got != tc.want {
				t.Fatalf("%s.CanTransitionTo(%s) = %v, want %v", tc.from, tc.to, got, tc.want)
			}
		})
	}
}

func TestOnlyScheduledRoundsAreOpen(t *testing.T) {
	// The application consumer cancels against Open(). A completed round that
	// answered true here would have its outcome wiped when the application was
	// rejected.
	for _, status := range []Status{StatusCompleted, StatusCancelled, StatusNoShow} {
		if status.Open() {
			t.Fatalf("expected %s not to count as outstanding", status)
		}
	}
	if !StatusScheduled.Open() {
		t.Fatal("expected a scheduled round to count as outstanding")
	}
}

func TestTransitionErrorIsMatchable(t *testing.T) {
	err := error(&TransitionError{From: StatusCompleted, To: StatusCancelled})
	if !errors.Is(err, ErrIllegalTransition) {
		t.Fatal("expected a refused transition to match ErrIllegalTransition")
	}

	same := (&TransitionError{From: StatusCancelled, To: StatusCancelled}).Error()
	if same != "this interview is already cancelled." {
		t.Fatalf("expected the repeat case to say so, got %q", same)
	}
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

func strPtr(v string) *string       { return &v }
func intPtr(v int) *int             { return &v }
func slicePtr(v []string) *[]string { return &v }

func TestValidateRoundOnCreate(t *testing.T) {
	start := time.Date(2026, 3, 4, 14, 0, 0, 0, time.UTC)

	valid := RoundInput{
		RoundTitle:      strPtr("Technical deep dive"),
		RoundType:       strPtr("technical"),
		ScheduledStart:  &start,
		DurationMinutes: intPtr(60),
		Format:          strPtr("video"),
		MeetingLink:     strPtr("https://meet.example.com/abc"),
		PanelMemberIDs:  slicePtr([]string{"usr_a", "usr_b"}),
	}
	if problems := ValidateRound(valid, true); len(problems) != 0 {
		t.Fatalf("expected a well-formed round to pass, got %v", problems)
	}

	tests := []struct {
		name    string
		input   RoundInput
		wantKey string
	}{
		{
			name:    "a missing title",
			input:   RoundInput{ScheduledStart: &start},
			wantKey: "roundTitle",
		},
		{
			name:    "a title that is only whitespace",
			input:   RoundInput{RoundTitle: strPtr("   "), ScheduledStart: &start},
			wantKey: "roundTitle",
		},
		{
			name:    "a missing start time",
			input:   RoundInput{RoundTitle: strPtr("Screen")},
			wantKey: "scheduledStart",
		},
		{
			name:    "a round shorter than five minutes",
			input:   RoundInput{RoundTitle: strPtr("Screen"), ScheduledStart: &start, DurationMinutes: intPtr(1)},
			wantKey: "durationMinutes",
		},
		{
			name:    "a round longer than ten hours",
			input:   RoundInput{RoundTitle: strPtr("Screen"), ScheduledStart: &start, DurationMinutes: intPtr(601)},
			wantKey: "durationMinutes",
		},
		{
			name:    "a format nobody holds interviews in",
			input:   RoundInput{RoundTitle: strPtr("Screen"), ScheduledStart: &start, Format: strPtr("telepathy")},
			wantKey: "format",
		},
		{
			// A stored javascript: link becomes a click target in the portal.
			name:    "a meeting link with a script scheme",
			input:   RoundInput{RoundTitle: strPtr("Screen"), ScheduledStart: &start, MeetingLink: strPtr("javascript:alert(1)")},
			wantKey: "meetingLink",
		},
		{
			name:    "a meeting link that is not a url at all",
			input:   RoundInput{RoundTitle: strPtr("Screen"), ScheduledStart: &start, MeetingLink: strPtr("meet.example.com")},
			wantKey: "meetingLink",
		},
		{
			name:    "a panel larger than any real one",
			input:   RoundInput{RoundTitle: strPtr("Screen"), ScheduledStart: &start, PanelMemberIDs: slicePtr(manyMembers(26))},
			wantKey: "panelMemberIds",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			problems := ValidateRound(tc.input, true)
			if len(problems[tc.wantKey]) == 0 {
				t.Fatalf("expected a problem on %q, got %v", tc.wantKey, problems)
			}
		})
	}
}

func TestValidateRoundOnPatchLeavesAbsentFieldsAlone(t *testing.T) {
	// A patch that changes only the meeting link must not be told that a title
	// and a start time are required; they already exist on the row.
	problems := ValidateRound(RoundInput{MeetingLink: strPtr("https://meet.example.com/x")}, false)
	if len(problems) != 0 {
		t.Fatalf("expected an empty patch to pass, got %v", problems)
	}

	// A field that *is* supplied is still checked.
	problems = ValidateRound(RoundInput{RoundTitle: strPtr("")}, false)
	if len(problems["roundTitle"]) == 0 {
		t.Fatalf("expected a blanked title to be refused, got %v", problems)
	}
}

func TestValidateRoundAcceptsAnEmptyMeetingLink(t *testing.T) {
	// An onsite round has no link, and clearing one must not look like a bad URL.
	problems := ValidateRound(RoundInput{
		RoundTitle:     strPtr("Onsite"),
		ScheduledStart: timePtr(time.Now()),
		Format:         strPtr("onsite"),
		MeetingLink:    strPtr(""),
	}, true)
	if len(problems) != 0 {
		t.Fatalf("expected an onsite round with no link to pass, got %v", problems)
	}
}

func TestNormalizePanelIsASet(t *testing.T) {
	// A duplicate would hit the panel table's primary key and turn a harmless
	// input into a 500.
	got := NormalizePanel([]string{"usr_a", " usr_b ", "usr_a", "", "   "})

	want := []string{"usr_a", "usr_b"}
	if len(got) != len(want) {
		t.Fatalf("expected %v, got %v", want, got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("expected %v, got %v", want, got)
		}
	}
}

func TestValidateScorecard(t *testing.T) {
	valid := ScorecardInput{OverallRating: 4, Recommendation: "hire", TechnicalScore: intPtr(5)}
	if problems := ValidateScorecard(valid); len(problems) != 0 {
		t.Fatalf("expected a well-formed scorecard to pass, got %v", problems)
	}

	tests := []struct {
		name    string
		input   ScorecardInput
		wantKey string
	}{
		{
			// The zero value of an int is 0, so an omitted rating has to be
			// refused rather than stored as a silent "worse than 1".
			name:    "an omitted overall rating",
			input:   ScorecardInput{Recommendation: "hire"},
			wantKey: "overallRating",
		},
		{
			name:    "a rating above the scale",
			input:   ScorecardInput{OverallRating: 6, Recommendation: "hire"},
			wantKey: "overallRating",
		},
		{
			name:    "a missing recommendation",
			input:   ScorecardInput{OverallRating: 3},
			wantKey: "recommendation",
		},
		{
			name:    "a recommendation off the four-point scale",
			input:   ScorecardInput{OverallRating: 3, Recommendation: "maybe"},
			wantKey: "recommendation",
		},
		{
			name:    "a sub-score below the scale",
			input:   ScorecardInput{OverallRating: 3, Recommendation: "hire", CultureScore: intPtr(0)},
			wantKey: "cultureScore",
		},
		{
			name:    "a sub-score above the scale",
			input:   ScorecardInput{OverallRating: 3, Recommendation: "hire", CommunicationScore: intPtr(9)},
			wantKey: "communicationScore",
		},
		{
			name: "feedback longer than the column is meant to hold",
			input: ScorecardInput{
				OverallRating: 3, Recommendation: "hire", FeedbackNotes: longString(5001)},
			wantKey: "feedbackNotes",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			problems := ValidateScorecard(tc.input)
			if len(problems[tc.wantKey]) == 0 {
				t.Fatalf("expected a problem on %q, got %v", tc.wantKey, problems)
			}
		})
	}
}

func TestValidateScorecardLeavesOptionalScoresUnset(t *testing.T) {
	// Not every round scores every axis; an unset sub-score is not a zero.
	problems := ValidateScorecard(ScorecardInput{OverallRating: 1, Recommendation: "strong_no_hire"})
	if len(problems) != 0 {
		t.Fatalf("expected omitted sub-scores to pass, got %v", problems)
	}
}

/* -------------------------------------------------------------------------- */

func timePtr(v time.Time) *time.Time { return &v }

func manyMembers(n int) []string {
	members := make([]string, 0, n)
	for i := 0; i < n; i++ {
		members = append(members, "usr_"+string(rune('a'+i%26))+string(rune('0'+i/26)))
	}
	return members
}

func longString(n int) string {
	buf := make([]byte, n)
	for i := range buf {
		buf[i] = 'x'
	}
	return string(buf)
}
