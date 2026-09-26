// Package idgen produces the platform's identifiers.
//
// Identifiers are prefixed and lexicographically sortable by creation time
// (ULID-style), which makes them readable in logs, safe to expose in URLs, and
// naturally ordered as primary keys without a separate timestamp index.
package idgen

import (
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"strings"
	"sync"
	"time"
)

// Crockford base32: no I, L, O, or U, so identifiers cannot be misread aloud.
const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

var (
	mu          sync.Mutex
	lastMillis  int64
	lastEntropy [10]byte
)

// New returns a prefixed, time-sortable identifier such as "usr_01HQ8...".
func New(prefix string) string {
	return fmt.Sprintf("%s_%s", prefix, newULID())
}

// NewRaw returns an identifier without a prefix.
func NewRaw() string {
	return newULID()
}

func newULID() string {
	mu.Lock()
	defer mu.Unlock()

	now := time.Now().UnixMilli()
	if now == lastMillis {
		// Same millisecond: increment the previous entropy so ordering holds.
		increment(&lastEntropy)
	} else {
		lastMillis = now
		if _, err := rand.Read(lastEntropy[:]); err != nil {
			// crypto/rand failing is unrecoverable; identifiers must stay unique.
			panic(fmt.Sprintf("idgen: entropy source unavailable: %v", err))
		}
	}

	var raw [16]byte
	binary.BigEndian.PutUint64(raw[:8], uint64(now)<<16)
	copy(raw[6:], lastEntropy[:])

	return encode(raw)
}

func increment(entropy *[10]byte) {
	for i := len(entropy) - 1; i >= 0; i-- {
		entropy[i]++
		if entropy[i] != 0 {
			return
		}
	}
}

func encode(raw [16]byte) string {
	var sb strings.Builder
	sb.Grow(26)

	var bits, value uint32
	for _, b := range raw {
		value = value<<8 | uint32(b)
		bits += 8
		for bits >= 5 {
			bits -= 5
			sb.WriteByte(alphabet[(value>>bits)&0x1F])
		}
	}
	if bits > 0 {
		sb.WriteByte(alphabet[(value<<(5-bits))&0x1F])
	}

	return sb.String()
}
