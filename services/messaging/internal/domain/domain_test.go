package domain

import (
	"errors"
	"strings"
	"testing"
)

func TestValidateMessage(t *testing.T) {
	const owner = "company/11111111-1111-1111-1111-111111111111/"

	tests := []struct {
		name        string
		body        string
		attachments []Attachment
		wantErr     bool
		wantFields  []string
		wantBody    string
	}{
		{
			name:     "trims a plain message",
			body:     "  hello there  ",
			wantBody: "hello there",
		},
		{
			name:       "an empty message with no attachment is nothing to send",
			body:       "   ",
			wantErr:    true,
			wantFields: []string{"body"},
		},
		{
			name:        "an attachment alone is a message",
			body:        "",
			attachments: []Attachment{{ObjectKey: owner + "cv.pdf", SizeBytes: 10}},
		},
		{
			name:       "a body longer than the limit is refused",
			body:       strings.Repeat("a", MaxBodyRunes+1),
			wantErr:    true,
			wantFields: []string{"body"},
		},
		{
			name:     "a body exactly at the limit is accepted",
			body:     strings.Repeat("a", MaxBodyRunes),
			wantBody: strings.Repeat("a", MaxBodyRunes),
		},
		{
			// The limit counts characters, not bytes: a message in a language
			// that does not fit in one byte per character is not worth a third
			// of the allowance.
			name:     "the limit counts runes rather than bytes",
			body:     strings.Repeat("é", MaxBodyRunes),
			wantBody: strings.Repeat("é", MaxBodyRunes),
		},
		{
			name:        "a file outside the sender's prefix is refused",
			body:        "here you go",
			attachments: []Attachment{{ObjectKey: "company/22222222-2222-2222-2222-222222222222/cv.pdf", SizeBytes: 10}},
			wantErr:     true,
			wantFields:  []string{"attachments.0"},
		},
		{
			name: "the same file attached twice is refused",
			body: "here you go",
			attachments: []Attachment{
				{ObjectKey: owner + "cv.pdf", SizeBytes: 10},
				{ObjectKey: owner + "cv.pdf", SizeBytes: 10},
			},
			wantErr:    true,
			wantFields: []string{"attachments.1"},
		},
		{
			name:        "a zero-byte attachment is refused",
			body:        "here you go",
			attachments: []Attachment{{ObjectKey: owner + "cv.pdf", SizeBytes: 0}},
			wantErr:     true,
			wantFields:  []string{"attachments.0"},
		},
		{
			name:        "an oversized attachment is refused",
			body:        "here you go",
			attachments: []Attachment{{ObjectKey: owner + "cv.pdf", SizeBytes: MaxAttachmentBytes + 1}},
			wantErr:     true,
			wantFields:  []string{"attachments.0"},
		},
		{
			// One round trip should report everything wrong with a request, not
			// the first thing wrong with it.
			name:        "every problem is reported at once",
			body:        strings.Repeat("a", MaxBodyRunes+1),
			attachments: []Attachment{{ObjectKey: "", SizeBytes: 0}},
			wantErr:     true,
			wantFields:  []string{"body", "attachments.0"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			message, err := ValidateMessage(tc.body, tc.attachments, owner)

			if !tc.wantErr {
				if err != nil {
					t.Fatalf("ValidateMessage() error = %v, want nil", err)
				}
				if tc.wantBody != "" && message.Body != tc.wantBody {
					t.Errorf("body = %q, want %q", message.Body, tc.wantBody)
				}
				if message.Attachments == nil {
					t.Error("attachments should never be nil, so the column is never written as NULL")
				}
				return
			}

			var validation *ValidationError
			if !errors.As(err, &validation) {
				t.Fatalf("ValidateMessage() error = %v, want a ValidationError", err)
			}
			for _, field := range tc.wantFields {
				if _, found := validation.Fields[field]; !found {
					t.Errorf("no failure reported for %q, got %v", field, validation.Fields)
				}
			}
		})
	}
}

func TestValidateMessageWithoutAnOwnerPrefix(t *testing.T) {
	// An empty owner means "the caller could not establish a prefix"; the keys
	// are then accepted as given rather than silently matched against "".
	message, err := ValidateMessage("hi", []Attachment{{ObjectKey: "anything/at/all", SizeBytes: 1}}, "")
	if err != nil {
		t.Fatalf("ValidateMessage() error = %v, want nil", err)
	}
	if len(message.Attachments) != 1 {
		t.Fatalf("attachments = %d, want 1", len(message.Attachments))
	}
}

func TestValidateSubject(t *testing.T) {
	tests := []struct {
		name    string
		subject string
		want    string
		wantErr bool
	}{
		{name: "empty stays empty", subject: "   ", want: ""},
		{name: "trimmed", subject: "  About your application ", want: "About your application"},
		{name: "at the limit", subject: strings.Repeat("s", MaxSubjectRunes), want: strings.Repeat("s", MaxSubjectRunes)},
		{name: "over the limit", subject: strings.Repeat("s", MaxSubjectRunes+1), wantErr: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := ValidateSubject(tc.subject)
			if tc.wantErr {
				if err == nil {
					t.Fatal("ValidateSubject() error = nil, want a validation error")
				}
				return
			}
			if err != nil {
				t.Fatalf("ValidateSubject() error = %v, want nil", err)
			}
			if got != tc.want {
				t.Errorf("subject = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestAttachmentPrefixIsPerOwner(t *testing.T) {
	const company = "11111111-1111-1111-1111-111111111111"
	const account = "acct_01H"

	tests := []struct {
		name   string
		sender SenderType
		want   string
	}{
		{name: "a recruiter owns the company prefix", sender: SenderCompany, want: "company/" + company + "/"},
		{name: "a candidate owns their own prefix", sender: SenderCandidate, want: "candidate/" + account + "/"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := AttachmentPrefix(tc.sender, company, account); got != tc.want {
				t.Errorf("AttachmentPrefix() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestSenderTypeOpposite(t *testing.T) {
	// The unread counter that moves is the recipient's, so this mapping is what
	// keeps a sender from making their own inbox unread.
	tests := []struct {
		sender SenderType
		want   SenderType
		valid  bool
	}{
		{sender: SenderCompany, want: SenderCandidate, valid: true},
		{sender: SenderCandidate, want: SenderCompany, valid: true},
		{sender: SenderType("moderator"), want: SenderCompany, valid: false},
	}

	for _, tc := range tests {
		t.Run(string(tc.sender), func(t *testing.T) {
			if got := tc.sender.Opposite(); got != tc.want {
				t.Errorf("Opposite() = %q, want %q", got, tc.want)
			}
			if got := tc.sender.Valid(); got != tc.valid {
				t.Errorf("Valid() = %v, want %v", got, tc.valid)
			}
		})
	}
}

func TestOriginCountsTowardDailyLimit(t *testing.T) {
	tests := []struct {
		origin Origin
		want   bool
	}{
		// Outreach the company started is what the cap exists to bound.
		{origin: OriginRecruiter, want: true},
		{origin: OriginApproach, want: true},
		// A thread about an application is a reply to something the candidate
		// began; throttling it would punish responsiveness.
		{origin: OriginApplication, want: false},
	}

	for _, tc := range tests {
		t.Run(string(tc.origin), func(t *testing.T) {
			if got := tc.origin.CountsTowardDailyLimit(); got != tc.want {
				t.Errorf("CountsTowardDailyLimit() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestPreviewCollapsesAndTruncates(t *testing.T) {
	tests := []struct {
		name string
		body string
		want string
	}{
		{name: "whitespace is collapsed", body: "hello\n\n  there\tfriend", want: "hello there friend"},
		{name: "empty stays empty", body: "   \n ", want: ""},
		{
			name: "a long body is cut to the preview length",
			body: strings.Repeat("x", PreviewRunes+50),
			want: strings.Repeat("x", PreviewRunes),
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := Preview(tc.body); got != tc.want {
				t.Errorf("Preview() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestPreviewNeverCarriesTheWholeBody(t *testing.T) {
	// The preview travels in the published event, where every consumer and its
	// retention policy can read it. It must stay a teaser.
	body := strings.Repeat("secret ", 500)
	if got := Preview(body); len([]rune(got)) > PreviewRunes {
		t.Errorf("preview length = %d runes, want at most %d", len([]rune(got)), PreviewRunes)
	}
}

func TestValidUUID(t *testing.T) {
	tests := []struct {
		name  string
		value string
		want  bool
	}{
		{name: "a uuid", value: "11111111-2222-3333-4444-555555555555", want: true},
		{name: "uppercase hex", value: "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE", want: true},
		{name: "empty", value: "", want: false},
		{name: "too short", value: "1111-2222", want: false},
		{name: "wrong separators", value: "11111111x2222-3333-4444-555555555555", want: false},
		{name: "not hex", value: "gggggggg-2222-3333-4444-555555555555", want: false},
		{name: "a sql fragment", value: "' OR 1=1 --                         ", want: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := ValidUUID(tc.value); got != tc.want {
				t.Errorf("ValidUUID(%q) = %v, want %v", tc.value, got, tc.want)
			}
		})
	}
}

func TestValidAccountID(t *testing.T) {
	tests := []struct {
		name  string
		value string
		want  bool
	}{
		{name: "a prefixed ulid", value: "acct_01HZX3T9QKD6M0V8B2N4C7E5FG", want: true},
		{name: "empty", value: "", want: false},
		{name: "whitespace only", value: "   ", want: false},
		{name: "padded", value: " acct_01HZX ", want: false},
		{name: "absurdly long", value: strings.Repeat("a", 65), want: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := ValidAccountID(tc.value); got != tc.want {
				t.Errorf("ValidAccountID(%q) = %v, want %v", tc.value, got, tc.want)
			}
		})
	}
}
