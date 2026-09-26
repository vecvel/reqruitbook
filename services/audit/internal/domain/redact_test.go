package domain

import (
	"encoding/json"
	"strings"
	"testing"
)

// Redaction is the only thing between an arbitrary event payload and a table
// that every administrator of every tenant can read through a portal. The rule
// it applies is written out at the top of redact.go; these tests are that rule
// stated as behaviour, so a later edit that widens what survives has to argue
// with a failing test rather than with a comment.

func TestRedactRemovesSecretsAtEveryDepth(t *testing.T) {
	payload := map[string]any{
		"refreshToken": "rt_live_abcdef",
		"nested": map[string]any{
			"webhookSignature": "sha256=deadbeef",
			"deeper": map[string]any{
				"api_key": "sk_live_1234",
			},
		},
		"items": []any{
			map[string]any{"passwordHash": "$2a$10$abcdef"},
		},
	}

	clean := Redact(payload)

	if clean["refreshToken"] != RedactedMarker {
		t.Fatalf("top-level token survived: %v", clean["refreshToken"])
	}

	nested := clean["nested"].(map[string]any)
	if nested["webhookSignature"] != RedactedMarker {
		t.Fatalf("nested signature survived: %v", nested["webhookSignature"])
	}

	deeper := nested["deeper"].(map[string]any)
	if deeper["api_key"] != RedactedMarker {
		t.Fatalf("snake_case api key survived: %v", deeper["api_key"])
	}

	item := clean["items"].([]any)[0].(map[string]any)
	if item["passwordHash"] != RedactedMarker {
		t.Fatalf("secret inside an array survived: %v", item["passwordHash"])
	}

	// The strongest statement the test can make: no spelling of the secret
	// appears anywhere in what would be written to the database.
	encoded, err := json.Marshal(clean)
	if err != nil {
		t.Fatalf("redacted payload does not encode: %v", err)
	}
	for _, secret := range []string{"rt_live_abcdef", "deadbeef", "sk_live_1234", "$2a$10$abcdef"} {
		if strings.Contains(string(encoded), secret) {
			t.Fatalf("secret %q survived redaction in %s", secret, encoded)
		}
	}
}

// A key named "credentials" holding a map must not survive because the map's own
// keys happened to look innocent.
func TestRedactReplacesAWholeSecretObject(t *testing.T) {
	clean := Redact(map[string]any{
		"credentials": map[string]any{"username": "ada", "value": "hunter2"},
	})

	if clean["credentials"] != RedactedMarker {
		t.Fatalf("secret object survived as %#v", clean["credentials"])
	}
}

// Free text belongs to the service that owns it, behind that service's own
// permission. `company_audit.read` is not `messaging.read`.
func TestRedactDropsAnotherServicesFreeText(t *testing.T) {
	tests := []string{
		"note", "notes", "internalNote", "internal_notes", "body",
		"messageBody", "message", "content", "answers", "coverLetter",
		"feedback", "comment", "comments", "scorecard", "transcript",
	}

	for _, key := range tests {
		t.Run(key, func(t *testing.T) {
			clean := Redact(map[string]any{key: "something a recruiter typed"})
			if clean[key] != OmittedMarker {
				t.Fatalf("Redact kept %q as %#v, want %q", key, clean[key], OmittedMarker)
			}
		})
	}
}

// The deny-list has to be narrow enough that the trail stays readable. A rule
// that redacted everything would pass every security test and fail the product.
func TestRedactKeepsTheFieldsATrailIsReadFor(t *testing.T) {
	payload := map[string]any{
		"applicationId": "app_01",
		"jobId":         "job_01",
		"stageKey":      "technical-interview",
		"key":           "screening",
		"status":        "rejected",
		"reason":        "Salary expectations",
		"rating":        float64(4),
		"published":     true,
		"salaryMinor":   float64(4500000),
		"currency":      "USD",
	}

	clean := Redact(payload)

	for key, want := range payload {
		if clean[key] != want {
			t.Fatalf("Redact changed %q from %#v to %#v", key, want, clean[key])
		}
	}
}

func TestRedactCapsWhatOneEntryMayHold(t *testing.T) {
	t.Run("a long string is truncated on a rune boundary", func(t *testing.T) {
		clean := Redact(map[string]any{"title": strings.Repeat("é", maxStringRunes+50)})

		got := clean["title"].(string)
		if !strings.HasSuffix(got, TruncatedMarker) {
			t.Fatalf("long string was not marked as truncated")
		}
		trimmed := strings.TrimSuffix(got, TruncatedMarker)
		if count := len([]rune(trimmed)); count != maxStringRunes {
			t.Fatalf("kept %d runes, want %d", count, maxStringRunes)
		}
		if !json.Valid(mustEncode(t, clean)) {
			t.Fatalf("truncated string does not survive JSON encoding")
		}
	})

	t.Run("a long array is capped and says so", func(t *testing.T) {
		items := make([]any, maxArrayItems+10)
		for i := range items {
			items[i] = "x"
		}

		clean := Redact(map[string]any{"items": items})

		got := clean["items"].([]any)
		if len(got) != maxArrayItems+1 {
			t.Fatalf("kept %d items, want %d plus a marker", len(got), maxArrayItems)
		}
		if got[len(got)-1] != TruncatedMarker {
			t.Fatalf("capped array did not end with the marker")
		}
	})

	t.Run("nesting beyond the depth cap stops rather than recursing", func(t *testing.T) {
		deep := map[string]any{"leaf": "bottom"}
		for i := 0; i < maxDepth+3; i++ {
			deep = map[string]any{"down": deep}
		}

		clean := Redact(deep)

		encoded := string(mustEncode(t, clean))
		if strings.Contains(encoded, "bottom") {
			t.Fatalf("value below the depth cap survived: %s", encoded)
		}
		if !strings.Contains(encoded, TruncatedMarker) {
			t.Fatalf("depth cap did not mark the payload: %s", encoded)
		}
	})

	t.Run("an oversized payload falls back to its identifying scalars", func(t *testing.T) {
		payload := map[string]any{
			"applicationId": "app_01",
			"published":     true,
		}
		// Enough distinct keys, each holding a capped string, to blow the byte
		// budget without tripping any individual field's cap.
		for i := 0; i < maxObjectKeys; i++ {
			payload["field"+strings.Repeat("x", i%20)+string(rune('a'+i%26))+string(rune('0'+i%10))] =
				strings.Repeat("y", maxStringRunes)
		}

		clean := Redact(payload)

		if clean[TruncatedFlag] != true {
			t.Fatalf("oversized payload was not flagged as truncated")
		}
		if len(mustEncode(t, clean)) > maxPayloadBytes {
			t.Fatalf("fallback payload is still over the byte cap")
		}
	})
}

// Redact must not edit its argument: the consumer still logs the decoded event
// after calling it, and a log line whose contents depend on call order is a log
// line nobody can reason about.
func TestRedactDoesNotMutateItsArgument(t *testing.T) {
	payload := map[string]any{
		"accessToken": "at_live_1",
		"nested":      map[string]any{"secret": "s"},
	}

	Redact(payload)

	if payload["accessToken"] != "at_live_1" {
		t.Fatalf("Redact overwrote the caller's payload")
	}
	if payload["nested"].(map[string]any)["secret"] != "s" {
		t.Fatalf("Redact overwrote a nested value in the caller's payload")
	}
}

func TestRedactHandlesAnEmptyPayload(t *testing.T) {
	if clean := Redact(nil); clean == nil || len(clean) != 0 {
		t.Fatalf("Redact(nil) = %#v, want an empty map", clean)
	}
}

func mustEncode(t *testing.T, value any) []byte {
	t.Helper()
	encoded, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("could not encode: %v", err)
	}
	return encoded
}
