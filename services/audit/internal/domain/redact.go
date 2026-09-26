package domain

import (
	"encoding/json"
	"strings"
)

/*
The redaction rule this service applies, stated once so it can be argued with:

 1. An audit entry exists to prove that something happened and to say who did it.
    It is not a replica of the event, and it is not a place to read an event's
    contents from. Anything that is not needed to establish the fact is a cost
    with no matching benefit, because this table is the one copy of every event
    on the platform, it is retained far longer than the stream, and it is read
    through two different portals by people with only `*_audit.read`.

 2. Secrets are removed, not shortened. Any key whose name suggests a credential,
    a token, a signature or a government identifier is replaced with a marker,
    recursively, at every depth. No event is supposed to carry a password hash;
    the point of a deny-list is that it also covers the ones nobody predicted,
    such as a webhook signature copied into a support payload.

 3. Free text that belongs to another service is dropped, not kept. An internal
    note, a message body, a scorecard, a candidate's form answers: the audit
    trail records that a note was written and by whom, which is the auditable
    fact. The note's contents belong to the service that owns them, behind that
    service's own permission. `company_audit.read` is held by administrators who
    may have no `messaging.read` at all, and an audit screen that quietly hands
    them every message body is a permission bypass wearing a different name.

 4. What is left is bounded. Strings, arrays, object widths, nesting depth and
    the encoded payload as a whole are all capped, so one pathological event
    cannot make the table — or the export that reads it — unusable.

The same redacted payload is served to both the company trail and the platform
trail. The platform is not given the unredacted version: a support engineer
reading a cross-tenant feed is the *last* principal who should see a tenant's
private notes, and keeping one stored representation means there is no second
code path that could serve the wrong one.
*/

// Markers a reader sees in place of a removed value. They are distinguishable on
// purpose: "this was a secret" and "this was text you can read elsewhere" lead
// to different next steps.
const (
	RedactedMarker  = "[redacted]"
	OmittedMarker   = "[omitted]"
	TruncatedMarker = "[truncated]"
)

// Caps on what one entry may hold.
const (
	maxDepth        = 6
	maxStringRunes  = 512
	maxArrayItems   = 50
	maxObjectKeys   = 100
	maxPayloadBytes = 32 << 10
)

// TruncatedFlag marks a payload that was cut down to fit.
const TruncatedFlag = "_truncated"

// secretFragments match anywhere in a normalised key name.
//
// Substring matching is deliberate — `refreshToken`, `token`, `tokenHash` and
// `internalServiceToken` are one rule, not four — and the fragments are chosen
// to be specific enough not to catch ordinary fields. "key" alone is absent for
// exactly that reason: a pipeline stage has a `key`, and losing it would make a
// stage rename unreadable in the trail.
var secretFragments = []string{
	"password", "passwd", "secret", "token", "credential",
	"apikey", "privatekey", "signingkey", "signature",
	"authorization", "cookie", "otp", "hash", "salt",
	"ssn", "taxid", "iban", "bankaccount", "cardnumber", "cvv",
}

// freeTextKeys are fields whose contents belong to another service's permission.
var freeTextKeys = map[string]struct{}{
	"note":          {},
	"notes":         {},
	"internalnote":  {},
	"internalnotes": {},
	"privatenote":   {},
	"privatenotes":  {},
	"rejectionnote": {},
	"body":          {},
	"messagebody":   {},
	"message":       {},
	"content":       {},
	"answers":       {},
	"coverletter":   {},
	"feedback":      {},
	"comment":       {},
	"comments":      {},
	"scorecard":     {},
	"transcript":    {},
	"attachments":   {},
}

// Redact returns the payload as it will be stored and served.
//
// It never mutates its argument: the consumer holds the decoded event for
// logging after this returns, and a redaction that edited in place would make
// the log line depend on whether it ran before or after.
func Redact(payload map[string]any) map[string]any {
	clean := redactObject(payload, 0)

	// A last guard on total size. The per-field caps bound a well-shaped event,
	// but not an object with ten thousand short keys, and an audit table that
	// one publisher can fill is an audit table that stops being read.
	encoded, err := json.Marshal(clean)
	if err != nil || len(encoded) > maxPayloadBytes {
		return scalarsOnly(clean)
	}
	return clean
}

func redactObject(value map[string]any, depth int) map[string]any {
	out := make(map[string]any, len(value))
	if value == nil {
		return out
	}

	written := 0
	for key, raw := range value {
		if written >= maxObjectKeys {
			out[TruncatedFlag] = true
			break
		}
		written++

		normalized := normalizeKey(key)
		switch {
		case isSecretKey(normalized):
			// Replaced whatever the value was, including an object: a key named
			// "credentials" holding a map must not survive because the map's own
			// keys happened to look innocent.
			out[key] = RedactedMarker
		case isFreeTextKey(normalized):
			out[key] = OmittedMarker
		default:
			out[key] = redactValue(raw, depth+1)
		}
	}
	return out
}

func redactValue(raw any, depth int) any {
	if depth > maxDepth {
		return TruncatedMarker
	}

	switch value := raw.(type) {
	case map[string]any:
		return redactObject(value, depth)

	case []any:
		limit := len(value)
		truncated := false
		if limit > maxArrayItems {
			limit = maxArrayItems
			truncated = true
		}
		out := make([]any, 0, limit+1)
		for _, item := range value[:limit] {
			out = append(out, redactValue(item, depth+1))
		}
		if truncated {
			out = append(out, TruncatedMarker)
		}
		return out

	case string:
		return truncateString(value, maxStringRunes)

	default:
		// Numbers, booleans and nulls carry no length and no name to judge them
		// by; json.Number and float64 both land here unchanged.
		return raw
	}
}

// scalarsOnly is the fallback for a payload too large to keep.
//
// The top level is where the identifying fields live — ids, statuses, stage
// names — so keeping the scalars there preserves what the entry is about while
// discarding the nested bulk that made it oversized. The flag is set so nobody
// reads the result as the whole story.
func scalarsOnly(value map[string]any) map[string]any {
	const (
		fallbackKeys   = 25
		fallbackString = 128
	)

	out := make(map[string]any, fallbackKeys+1)
	out[TruncatedFlag] = true

	written := 0
	for key, raw := range value {
		if written >= fallbackKeys {
			break
		}
		switch scalar := raw.(type) {
		case string:
			out[key] = truncateString(scalar, fallbackString)
		case bool, float64, json.Number, nil:
			out[key] = raw
		default:
			continue
		}
		written++
	}
	return out
}

func isSecretKey(normalized string) bool {
	for _, fragment := range secretFragments {
		if strings.Contains(normalized, fragment) {
			return true
		}
	}
	return false
}

func isFreeTextKey(normalized string) bool {
	_, found := freeTextKeys[normalized]
	return found
}

// truncateString cuts on a rune boundary so the result is still valid UTF-8 and
// still encodes as JSON — cutting bytes would split a multi-byte character and
// the marshal would replace it, silently, with U+FFFD.
func truncateString(value string, limit int) string {
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit]) + TruncatedMarker
}
