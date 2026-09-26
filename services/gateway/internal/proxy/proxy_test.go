package proxy

import (
	"io"
	"log/slog"
	"net/http/httptest"
	"testing"
)

func TestStripAPIPrefix(t *testing.T) {
	tests := []struct {
		name string
		path string
		want string
	}{
		{name: "versioned resource", path: "/api/v1/jobs", want: "/v1/jobs"},
		{name: "nested resource", path: "/api/v1/jobs/job_1/applications", want: "/v1/jobs/job_1/applications"},
		{name: "trailing slash", path: "/api/v1/jobs/", want: "/v1/jobs/"},

		// Only the gateway's own prefix is removed, and only once: a resource
		// whose id happens to contain "/api/" must arrive intact.
		{name: "prefix appears twice", path: "/api/v1/proxy/api/v1/jobs", want: "/v1/proxy/api/v1/jobs"},

		{name: "not the api surface", path: "/.well-known/jwks.json", want: "/.well-known/jwks.json"},
		{name: "prefix without separator", path: "/apiv1/jobs", want: "/apiv1/jobs"},
		{name: "bare prefix", path: "/api", want: "/api"},
		{name: "root", path: "/", want: "/"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest("GET", "http://acme.example.test"+tc.path, nil)

			StripAPIPrefix(r)

			if r.URL.Path != tc.want {
				t.Errorf("path = %q, want %q", r.URL.Path, tc.want)
			}
		})
	}
}

// TestStripAPIPrefixKeepsEscapedPathInSync: RawPath holds the original encoding
// when it differs from Path, and a mismatch between the two makes the forwarded
// URL nonsense.
func TestStripAPIPrefixKeepsEscapedPathInSync(t *testing.T) {
	r := httptest.NewRequest("GET", "http://acme.example.test/api/v1/jobs/job%2F1", nil)

	if r.URL.RawPath == "" {
		t.Skip("this Go version did not retain a RawPath for the escaped segment")
	}

	StripAPIPrefix(r)

	if r.URL.Path != "/v1/jobs/job/1" {
		t.Errorf("path = %q, want %q", r.URL.Path, "/v1/jobs/job/1")
	}
	if r.URL.RawPath != "/v1/jobs/job%2F1" {
		t.Errorf("raw path = %q, want %q", r.URL.RawPath, "/v1/jobs/job%2F1")
	}
}

// TestPoolReusesProxyPerTarget: a fresh proxy per request would mean a fresh
// TCP connection per request, which is the difference between a pooled hop and
// a handshake on every call.
func TestPoolReusesProxyPerTarget(t *testing.T) {
	pool := NewPool(slog.New(slog.NewTextHandler(io.Discard, nil)))

	first, err := pool.For("http://jobs.internal:8085")
	if err != nil {
		t.Fatalf("For: %v", err)
	}
	second, err := pool.For("http://jobs.internal:8085")
	if err != nil {
		t.Fatalf("For: %v", err)
	}
	if first != second {
		t.Error("the same target produced two proxies")
	}

	other, err := pool.For("http://candidates.internal:8087")
	if err != nil {
		t.Fatalf("For: %v", err)
	}
	if other == first {
		t.Error("two targets share one proxy")
	}
}

func TestPoolRejectsInvalidTarget(t *testing.T) {
	pool := NewPool(slog.New(slog.NewTextHandler(io.Discard, nil)))

	if _, err := pool.For("://not a url"); err == nil {
		t.Error("an unparseable target was accepted")
	}
}
