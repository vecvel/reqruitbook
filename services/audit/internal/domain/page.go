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

// Page is one request for a slice of a trail.
//
// Paging is keyset rather than offset because a trail grows at the top: with an
// offset, an event recorded between two page requests shifts every later row
// down one, and the reader sees one entry twice while another slips past unseen.
// In an audit trail the second half of that sentence is the whole problem.
type Page struct {
	Limit  int
	Cursor Cursor
}

// Cursor is the position of the last row a client received.
//
// It carries the timestamp as well as the id because entries are ordered by
// when the fact happened, and the ids are not this service's to mint: they are
// the publishers' event ids, which carry a dozen different prefixes and do not
// sort against each other in time order. Paging on the id alone would skip rows
// the moment two services published in the same second.
type Cursor struct {
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
// An unparseable cursor is an error rather than a silent reset to the first
// page: a client that gets page one when it asked for page nine has quietly
// lost eight pages of an audit trail and has no way to notice.
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
