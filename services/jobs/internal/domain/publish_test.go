package domain

import (
	"errors"
	"testing"
)

// Publishing is where the two visibility surfaces, the permission model and the
// requisition lifecycle meet. Each is simple alone; the combinations are where a
// job ends up on the public board without anyone holding the permission to put
// it there.

func TestPublishPermissionsOnlyChargesForSwitchingASurfaceOn(t *testing.T) {
	tests := []struct {
		name      string
		current   Job
		requested Visibility
		want      []string
	}{
		{
			name:      "a draft going to the company portal",
			current:   Job{Status: StatusDraft},
			requested: Visibility{Portal: true},
			want:      []string{PermissionPublishPortal},
		},
		{
			name:      "a draft going to both boards",
			current:   Job{Status: StatusDraft},
			requested: Visibility{Portal: true, Network: true},
			want:      []string{PermissionPublishPortal, PermissionPublishNetwork},
		},
		{
			// The rule that matters: a recruiter who may not publish to the
			// network must still be able to take a job down from it. Charging
			// for the removal would trap a live listing nobody can retract.
			name:      "taking a job off the network costs nothing",
			current:   Job{Status: StatusOpen, VisibleOnPortal: true, VisibleOnNetwork: true},
			requested: Visibility{Portal: true},
			want:      nil,
		},
		{
			name:      "unpublishing everywhere costs nothing",
			current:   Job{Status: StatusOpen, VisibleOnPortal: true, VisibleOnNetwork: true},
			requested: Visibility{},
			want:      nil,
		},
		{
			name:      "re-asserting a surface already on costs nothing",
			current:   Job{Status: StatusOpen, VisibleOnPortal: true},
			requested: Visibility{Portal: true},
			want:      nil,
		},
		{
			name:      "adding the network to a portal-only job costs only the network",
			current:   Job{Status: StatusOpen, VisibleOnPortal: true},
			requested: Visibility{Portal: true, Network: true},
			want:      []string{PermissionPublishNetwork},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := PublishPermissions(tt.current, tt.requested)
			if len(got) != len(tt.want) {
				t.Fatalf("expected %v, got %v", tt.want, got)
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Fatalf("expected %v, got %v", tt.want, got)
				}
			}
		})
	}
}

func TestCheckPublishRefusesIllegalTransitions(t *testing.T) {
	tests := []struct {
		name      string
		current   Job
		requested Visibility
		wantErr   bool
	}{
		{
			name:      "a closed requisition cannot be republished",
			current:   Job{Status: StatusClosed},
			requested: Visibility{Portal: true},
			wantErr:   true,
		},
		{
			name:      "an archived requisition cannot be republished",
			current:   Job{Status: StatusArchived},
			requested: Visibility{Portal: true},
			wantErr:   true,
		},
		{
			// A job on hold is deliberately paused; quietly relisting it would
			// take applications the company is not reading.
			name:      "a job on hold must be reopened first",
			current:   Job{Status: StatusOnHold},
			requested: Visibility{Portal: true},
			wantErr:   true,
		},
		{
			name:      "unpublishing a job on hold is allowed",
			current:   Job{Status: StatusOnHold, VisibleOnPortal: true},
			requested: Visibility{},
			wantErr:   false,
		},
		{
			name:      "a draft may be published",
			current:   Job{Status: StatusDraft},
			requested: Visibility{Portal: true},
			wantErr:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := CheckPublish(tt.current, tt.requested)
			if tt.wantErr && err == nil {
				t.Fatal("expected the transition to be refused")
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("expected the transition to be allowed, got %v", err)
			}
		})
	}
}

func TestStatusAfterPublishOpensADraftAndLeavesEverythingElseAlone(t *testing.T) {
	if got := StatusAfterPublish(Job{Status: StatusDraft}, Visibility{Portal: true}); got != StatusOpen {
		t.Fatalf("publishing a draft should open it, got %q", got)
	}
	if got := StatusAfterPublish(Job{Status: StatusDraft}, Visibility{}); got != StatusDraft {
		t.Fatalf("publishing nothing should leave a draft alone, got %q", got)
	}
	// An open job taken off both boards stays open: the requisition is still
	// being worked, it is simply not advertised.
	if got := StatusAfterPublish(Job{Status: StatusOpen}, Visibility{}); got != StatusOpen {
		t.Fatalf("unpublishing should not close a job, got %q", got)
	}
}

func TestCheckCloseDistinguishesAlreadyClosedFromGone(t *testing.T) {
	if err := CheckClose(Job{Status: StatusOpen}); err != nil {
		t.Fatalf("an open job should be closeable, got %v", err)
	}
	if err := CheckClose(Job{Status: StatusClosed}); !errors.Is(err, ErrAlreadyClosed) {
		t.Fatalf("expected ErrAlreadyClosed, got %v", err)
	}
	if err := CheckClose(Job{Status: StatusArchived}); !errors.Is(err, ErrJobTerminal) {
		t.Fatalf("expected ErrJobTerminal, got %v", err)
	}
}

func TestDefaultFormIsUsableAndComplete(t *testing.T) {
	form := DefaultForm()

	if len(form.Fields) == 0 {
		t.Fatal("a job created without a form must still have somewhere to apply")
	}

	seen := map[string]struct{}{}
	for _, field := range form.Fields {
		if field.Key == "" {
			t.Fatal("every field needs a key; answers are stored against it")
		}
		if _, duplicate := seen[field.Key]; duplicate {
			t.Fatalf("duplicate field key %q would make one answer overwrite another", field.Key)
		}
		seen[field.Key] = struct{}{}

		if !field.Type.Valid() {
			t.Fatalf("field %q has type %q, which no portal can render", field.Key, field.Type)
		}
	}
}

func TestSlugifyProducesSomethingUsableInAURL(t *testing.T) {
	tests := []struct{ in, want string }{
		{"Senior Go Engineer", "senior-go-engineer"},
		{"  Padded  Title  ", "padded-title"},
		{"C++ Developer (Remote)", "c-developer-remote"},
		{"Ünïcôdé Rôle", "unicode-role"},
		{"Ingénieur Sénior", "ingenieur-senior"},
		{"Straßenbau Architekt", "strassenbau-architekt"},
		{"Software Œuvre", "software-oeuvre"},
		{"multiple---hyphens", "multiple-hyphens"},
	}

	for _, tt := range tests {
		t.Run(tt.in, func(t *testing.T) {
			got := Slugify(tt.in)
			if got != tt.want {
				t.Fatalf("Slugify(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}
