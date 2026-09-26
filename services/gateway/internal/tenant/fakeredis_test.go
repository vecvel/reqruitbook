package tenant

import (
	"bufio"
	"fmt"
	"io"
	"net"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
)

// fakeRedis is an in-process stand-in for Redis speaking just enough RESP for
// the resolver's GET/SET/DEL.
//
// The resolver's cache is not a detail: a stale entry keeps a suspended tenant's
// portal open, and a missing negative entry lets a subdomain scan hammer
// identity. Testing that against a real server would make `go test ./...`
// depend on infrastructure, and a mocking library would only assert that calls
// were made rather than that the values round-trip.
type fakeRedis struct {
	listener net.Listener

	mu     sync.Mutex
	values map[string]entry
	gets   int
	sets   int
	dels   int
	// failReads makes every GET answer with an error, standing in for a cache
	// that is up enough to accept connections but not to serve reads.
	failReads bool
}

type entry struct {
	value     string
	expiresAt time.Time
}

func startFakeRedis(t *testing.T) *fakeRedis {
	t.Helper()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}

	f := &fakeRedis{listener: listener, values: make(map[string]entry)}
	go f.serve()
	t.Cleanup(func() { _ = listener.Close() })

	return f
}

// client returns a go-redis client wired to the fake.
func (f *fakeRedis) client(t *testing.T) *redis.Client {
	t.Helper()

	client := redis.NewClient(&redis.Options{Addr: f.listener.Addr().String()})
	t.Cleanup(func() { _ = client.Close() })

	return client
}

func (f *fakeRedis) serve() {
	for {
		conn, err := f.listener.Accept()
		if err != nil {
			return
		}
		go f.handle(conn)
	}
}

func (f *fakeRedis) handle(conn net.Conn) {
	defer func() { _ = conn.Close() }()

	reader := bufio.NewReader(conn)
	for {
		args, err := readCommand(reader)
		if err != nil {
			return
		}
		if len(args) == 0 {
			continue
		}
		if _, err := conn.Write(f.reply(args)); err != nil {
			return
		}
	}
}

func (f *fakeRedis) reply(args []string) []byte {
	switch strings.ToUpper(args[0]) {
	case "HELLO", "CLIENT":
		// go-redis reads an error here as "this server predates the command"
		// and carries on over RESP2, which is all this fake speaks.
		return []byte("-ERR unknown command\r\n")

	case "PING":
		return []byte("+PONG\r\n")

	case "GET":
		f.mu.Lock()
		defer f.mu.Unlock()
		f.gets++
		if f.failReads {
			return []byte("-ERR cache unavailable\r\n")
		}
		value, ok := f.lookupLocked(args[1])
		if !ok {
			return []byte("$-1\r\n")
		}
		return fmt.Appendf(nil, "$%d\r\n%s\r\n", len(value), value)

	case "SET":
		f.mu.Lock()
		defer f.mu.Unlock()
		f.sets++
		f.values[args[1]] = entry{value: args[2], expiresAt: setExpiry(args)}
		return []byte("+OK\r\n")

	case "DEL":
		f.mu.Lock()
		defer f.mu.Unlock()
		removed := 0
		for _, key := range args[1:] {
			if _, ok := f.values[key]; ok {
				delete(f.values, key)
				removed++
			}
		}
		f.dels += removed
		return fmt.Appendf(nil, ":%d\r\n", removed)
	}

	return []byte("-ERR unknown command\r\n")
}

func (f *fakeRedis) lookupLocked(key string) (string, bool) {
	held, ok := f.values[key]
	if !ok {
		return "", false
	}
	if !held.expiresAt.IsZero() && time.Now().After(held.expiresAt) {
		delete(f.values, key)
		return "", false
	}
	return held.value, true
}

// get reads a key the way a test asserts on it, bypassing the wire protocol.
func (f *fakeRedis) get(key string) (string, bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.lookupLocked(key)
}

// ttl reports the remaining lifetime a SET recorded, so a test can prove the
// negative cache is shorter-lived than a positive one.
func (f *fakeRedis) ttl(key string) (time.Duration, bool) {
	f.mu.Lock()
	defer f.mu.Unlock()

	held, ok := f.values[key]
	if !ok || held.expiresAt.IsZero() {
		return 0, false
	}
	return time.Until(held.expiresAt), true
}

func (f *fakeRedis) counts() (gets, sets, dels int) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.gets, f.sets, f.dels
}

func (f *fakeRedis) setFailReads(fail bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.failReads = fail
}

// setExpiry reads the optional EX/PX argument of a SET command.
func setExpiry(args []string) time.Time {
	for i := 3; i < len(args)-1; i++ {
		amount, err := strconv.Atoi(args[i+1])
		if err != nil {
			continue
		}
		switch strings.ToUpper(args[i]) {
		case "EX":
			return time.Now().Add(time.Duration(amount) * time.Second)
		case "PX":
			return time.Now().Add(time.Duration(amount) * time.Millisecond)
		}
	}
	return time.Time{}
}

// readCommand parses one RESP array of bulk strings.
func readCommand(r *bufio.Reader) ([]string, error) {
	line, err := r.ReadString('\n')
	if err != nil {
		return nil, err
	}
	line = strings.TrimRight(line, "\r\n")

	if !strings.HasPrefix(line, "*") {
		// Inline commands, which go-redis never sends but redis-cli might.
		return strings.Fields(line), nil
	}

	count, err := strconv.Atoi(line[1:])
	if err != nil || count < 0 {
		return nil, fmt.Errorf("fakeredis: bad array header %q", line)
	}

	args := make([]string, 0, count)
	for range count {
		header, err := r.ReadString('\n')
		if err != nil {
			return nil, err
		}
		header = strings.TrimRight(header, "\r\n")
		if !strings.HasPrefix(header, "$") {
			return nil, fmt.Errorf("fakeredis: bad bulk header %q", header)
		}
		size, err := strconv.Atoi(header[1:])
		if err != nil || size < 0 {
			return nil, fmt.Errorf("fakeredis: bad bulk length %q", header)
		}

		// +2 consumes the trailing CRLF along with the payload.
		buf := make([]byte, size+2)
		if _, err := io.ReadFull(r, buf); err != nil {
			return nil, err
		}
		args = append(args, string(buf[:size]))
	}

	return args, nil
}
