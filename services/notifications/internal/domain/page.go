package domain

import (
	"encoding/base64"
	"strings"
	"time"
)

// Pagination defaults required by the platform's HTTP contract.
const (
	DefaultPageLimit = 25
	MaxPageLimit     = 100
)

// Page is one request for a slice of an inbox.
//
// Paging is keyset rather than offset because an inbox grows at the top: with
// an offset, a notification that arrived between two page requests shifts every
// later row down one and the reader sees the same item twice while another
// slips past unread.
type Page struct {
	Limit  int
	Cursor Cursor
	// UnreadOnly narrows the inbox to what the recipient has not seen.
	UnreadOnly bool
}

// Cursor is the position of the last row a client received.
type Cursor struct {
	// At is the sort timestamp of that row; ID breaks ties between rows written
	// in the same instant.
	At time.Time
	ID string
}

// Set reports whether a cursor was supplied.
func (c Cursor) Set() bool { return c.ID != "" }

// Encode renders a cursor as the opaque token a client echoes back.
func (c Cursor) Encode() string {
	if !c.Set() {
		return ""
	}
	return base64.RawURLEncoding.EncodeToString(
		[]byte(c.At.UTC().Format(time.RFC3339Nano) + "|" + c.ID))
}

// NewPage normalises a requested limit and decodes a cursor token.
//
// An unparseable cursor is an error rather than a silent reset: a client that
// pages from the top when it asked for page nine has quietly lost data.
func NewPage(limit int, cursor string) (Page, error) {
	page := Page{Limit: limit}

	switch {
	case page.Limit <= 0:
		page.Limit = DefaultPageLimit
	case page.Limit > MaxPageLimit:
		page.Limit = MaxPageLimit
	}

	if cursor == "" {
		return page, nil
	}

	raw, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		return Page{}, ErrInvalidCursor
	}
	at, id, found := strings.Cut(string(raw), "|")
	if !found || id == "" {
		return Page{}, ErrInvalidCursor
	}
	parsed, err := time.Parse(time.RFC3339Nano, at)
	if err != nil {
		return Page{}, ErrInvalidCursor
	}

	page.Cursor = Cursor{At: parsed, ID: id}
	return page, nil
}
