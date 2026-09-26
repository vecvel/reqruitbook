package domain

import (
	"errors"
	"testing"
	"time"
)

func TestNewPageLimits(t *testing.T) {
	tests := []struct {
		name  string
		limit int
		want  int
	}{
		{name: "unset falls back to the default", limit: 0, want: DefaultPageLimit},
		{name: "negative falls back to the default", limit: -10, want: DefaultPageLimit},
		{name: "a sane limit is kept", limit: 10, want: 10},
		{name: "the maximum is kept", limit: MaxPageLimit, want: MaxPageLimit},
		// A caller asking for ten thousand rows gets a hundred rather than an
		// error: the cap is a protection, not a rejection.
		{name: "an excessive limit is capped", limit: 5000, want: MaxPageLimit},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			page, err := NewPage(tc.limit, "")
			if err != nil {
				t.Fatalf("NewPage() error = %v, want nil", err)
			}
			if page.Limit != tc.want {
				t.Errorf("limit = %d, want %d", page.Limit, tc.want)
			}
			if page.Cursor.Set() {
				t.Error("no cursor was supplied, so none should be set")
			}
		})
	}
}

func TestCursorRoundTrip(t *testing.T) {
	at := time.Date(2026, 3, 14, 15, 9, 26, 535897932, time.UTC)
	token := Cursor{At: at, ID: "conv_01HZX3T9QKD6M0V8B2N4C7E5FG"}.Encode()

	page, err := NewPage(50, token)
	if err != nil {
		t.Fatalf("NewPage() error = %v, want nil", err)
	}
	if !page.Cursor.At.Equal(at) {
		t.Errorf("cursor time = %v, want %v", page.Cursor.At, at)
	}
	if page.Cursor.ID != "conv_01HZX3T9QKD6M0V8B2N4C7E5FG" {
		t.Errorf("cursor id = %q, want the encoded one", page.Cursor.ID)
	}
}

func TestEmptyCursorEncodesToNothing(t *testing.T) {
	// A cursor is only emitted when there is a next page; an empty one must not
	// encode to a token that looks like a position.
	if got := (Cursor{}).Encode(); got != "" {
		t.Errorf("Encode() = %q, want an empty string", got)
	}
}

func TestNewPageRejectsABadCursor(t *testing.T) {
	// A cursor that silently reset to the first page would hand a client page
	// one when it asked for page nine, quietly losing everything in between.
	tests := []struct {
		name   string
		cursor string
	}{
		{name: "not base64", cursor: "!!!!not-base64!!!!"},
		{name: "no separator", cursor: "MjAyNi0wMy0xNFQxNTowOToyNlo"},
		{name: "no id", cursor: "MjAyNi0wMy0xNFQxNTowOToyNlp8"},
		{name: "unparseable timestamp", cursor: "bm90LWEtdGltZXxjb252XzE"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := NewPage(25, tc.cursor); !errors.Is(err, ErrInvalidCursor) {
				t.Errorf("NewPage() error = %v, want ErrInvalidCursor", err)
			}
		})
	}
}
