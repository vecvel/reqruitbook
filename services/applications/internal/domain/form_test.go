package domain

import "testing"

// The form validator is the only thing standing between an arbitrary JSON body
// and a stored application. A browser renders the form, but a submission can
// arrive from a script or a replayed request, so every rule the company authored
// has to hold here rather than in the client that was supposed to apply it.

func ptrInt(v int) *int           { return &v }
func ptrFloat(v float64) *float64 { return &v }

// opts builds the published option objects from plain values.
func opts(values ...string) []FieldOption {
	options := make([]FieldOption, 0, len(values))
	for _, value := range values {
		options = append(options, FieldOption{Value: value, Label: value})
	}
	return options
}

func TestValidateAnswersAcceptsAWellFormedSubmission(t *testing.T) {
	form := Form{Fields: []FormField{
		{Key: "name", Label: "Full name", Type: FieldText, Required: true},
		{Key: "email", Label: "Email", Type: FieldEmail, Required: true},
		{Key: "years", Label: "Years", Type: FieldNumber, Validation: &FieldValidation{Min: ptrFloat(0), Max: ptrFloat(50)}},
		{Key: "remote", Label: "Remote?", Type: FieldBoolean},
		{Key: "level", Label: "Level", Type: FieldSelect, Options: opts("junior", "senior")},
	}}

	problems := ValidateAnswers(form, map[string]any{
		"name":   "Ada Lovelace",
		"email":  "ada@example.com",
		"years":  float64(12),
		"remote": true,
		"level":  "senior",
	})

	if len(problems) != 0 {
		t.Fatalf("expected a valid submission to pass, got %v", problems)
	}
}

func TestValidateAnswersRejectsBadInput(t *testing.T) {
	tests := []struct {
		name    string
		field   FormField
		answers map[string]any
		wantKey string
	}{
		{
			name:    "a required field left out",
			field:   FormField{Key: "name", Label: "Full name", Type: FieldText, Required: true},
			answers: map[string]any{},
			wantKey: "name",
		},
		{
			name:    "a required field present but blank",
			field:   FormField{Key: "name", Label: "Full name", Type: FieldText, Required: true},
			answers: map[string]any{"name": "   "},
			wantKey: "name",
		},
		{
			name:    "an address that is not an address",
			field:   FormField{Key: "email", Label: "Email", Type: FieldEmail},
			answers: map[string]any{"email": "not-an-email"},
			wantKey: "email",
		},
		{
			name:    "a url that is not a url",
			field:   FormField{Key: "site", Label: "Website", Type: FieldURL},
			answers: map[string]any{"site": "definitely not a url"},
			wantKey: "site",
		},
		{
			name:    "a number below the floor",
			field:   FormField{Key: "years", Label: "Years", Type: FieldNumber, Validation: &FieldValidation{Min: ptrFloat(2)}},
			answers: map[string]any{"years": float64(1)},
			wantKey: "years",
		},
		{
			name:    "a number above the ceiling",
			field:   FormField{Key: "years", Label: "Years", Type: FieldNumber, Validation: &FieldValidation{Max: ptrFloat(10)}},
			answers: map[string]any{"years": float64(11)},
			wantKey: "years",
		},
		{
			name:    "text under the minimum length",
			field:   FormField{Key: "why", Label: "Why us", Type: FieldTextarea, Validation: &FieldValidation{MinLength: ptrInt(20)}},
			answers: map[string]any{"why": "too short"},
			wantKey: "why",
		},
		{
			name:    "text over the maximum length",
			field:   FormField{Key: "why", Label: "Why us", Type: FieldTextarea, Validation: &FieldValidation{MaxLength: ptrInt(5)}},
			answers: map[string]any{"why": "far too long for this field"},
			wantKey: "why",
		},
		{
			// The decisive case: a client can render only the options it was
			// given, so an out-of-range value means the request did not come
			// from that form.
			name:    "a select value that is not an option",
			field:   FormField{Key: "level", Label: "Level", Type: FieldSelect, Options: opts("junior", "senior")},
			answers: map[string]any{"level": "principal"},
			wantKey: "level",
		},
		{
			name:    "a multi-select containing an unknown option",
			field:   FormField{Key: "skills", Label: "Skills", Type: FieldMultiSelect, Options: opts("go", "sql")},
			answers: map[string]any{"skills": []any{"go", "cobol"}},
			wantKey: "skills",
		},
		{
			name: "more selections than the field allows",
			field: FormField{Key: "skills", Label: "Skills", Type: FieldMultiSelect,
				Options: opts("go", "sql", "ts"), Validation: &FieldValidation{MaxSelections: 2}},
			answers: map[string]any{"skills": []any{"go", "sql", "ts"}},
			wantKey: "skills",
		},
		{
			name: "a file with a disallowed extension",
			field: FormField{Key: "cv", Label: "CV", Type: FieldFile,
				Validation: &FieldValidation{AcceptedFileTypes: []string{"pdf"}}},
			answers: map[string]any{"cv": "candidate/acc_1/resume.exe"},
			wantKey: "cv",
		},
		{
			name:    "a date that is not a date",
			field:   FormField{Key: "start", Label: "Start date", Type: FieldDate},
			answers: map[string]any{"start": "next tuesday"},
			wantKey: "start",
		},
		{
			name:    "a boolean that is a string",
			field:   FormField{Key: "remote", Label: "Remote?", Type: FieldBoolean},
			answers: map[string]any{"remote": "yes please"},
			wantKey: "remote",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			problems := ValidateAnswers(Form{Fields: []FormField{tt.field}}, tt.answers)
			if len(problems[tt.wantKey]) == 0 {
				t.Fatalf("expected a problem on %q, got %v", tt.wantKey, problems)
			}
		})
	}
}

func TestValidateAnswersRejectsAnswersTheFormDidNotAskFor(t *testing.T) {
	// Rejecting rather than dropping is the deliberate choice: a key the form
	// does not define is either a client working from a stale version of the
	// form or someone probing what the server will store. Silently discarding it
	// would answer the prober and hide the stale form from whoever edited it.
	form := Form{Fields: []FormField{{Key: "name", Label: "Full name", Type: FieldText}}}

	problems := ValidateAnswers(form, map[string]any{
		"name":              "Ada Lovelace",
		"salaryExpectation": "a great deal",
	})

	if len(problems["salaryExpectation"]) == 0 {
		t.Fatalf("expected an unknown answer to be refused, got %v", problems)
	}
	if len(problems["name"]) != 0 {
		t.Fatalf("the valid answer should not have been faulted: %v", problems)
	}
}

func TestValidateAnswersAllowsOptionalFieldsToBeAbsent(t *testing.T) {
	form := Form{Fields: []FormField{
		{Key: "portfolio", Label: "Portfolio", Type: FieldURL},
		{Key: "years", Label: "Years", Type: FieldNumber, Validation: &FieldValidation{Min: ptrFloat(1)}},
	}}

	if problems := ValidateAnswers(form, map[string]any{}); len(problems) != 0 {
		t.Fatalf("optional fields should not be required: %v", problems)
	}
}

func TestValidateAnswersBoundsTextEvenWithoutAMaximum(t *testing.T) {
	// A form authored without limits must not become a way to store megabytes
	// per row.
	long := make([]byte, defaultMaxTextLength+1)
	for i := range long {
		long[i] = 'a'
	}

	form := Form{Fields: []FormField{{Key: "why", Label: "Why us", Type: FieldTextarea}}}

	problems := ValidateAnswers(form, map[string]any{"why": string(long)})
	if len(problems["why"]) == 0 {
		t.Fatalf("expected an unbounded text answer to be capped, got %v", problems)
	}
}
