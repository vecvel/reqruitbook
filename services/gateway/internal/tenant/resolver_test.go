package tenant

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

const (
	acmeID   = "11111111-1111-4111-8111-111111111111"
	globexID = "22222222-2222-4222-8222-222222222222"
)

func discardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

// fakeIdentity stands in for the identity service's internal resolve endpoint.
type fakeIdentity struct {
	*httptest.Server

	mu       sync.Mutex
	tenants  map[string]Company
	slugs    []string
	tokens   []string
	forceErr int
}

func startFakeIdentity(t *testing.T, tenants map[string]Company) *fakeIdentity {
	t.Helper()

	f := &fakeIdentity{tenants: tenants}
	f.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		slug := r.URL.Query().Get("slug")

		f.mu.Lock()
		f.slugs = append(f.slugs, slug)
		f.tokens = append(f.tokens, r.Header.Get("X-Internal-Token"))
		status := f.forceErr
		company, known := f.tenants[slug]
		f.mu.Unlock()

		if status != 0 {
			w.WriteHeader(status)
			return
		}
		if !known {
			w.WriteHeader(http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(company)
	}))
	t.Cleanup(f.Close)

	return f
}

func (f *fakeIdentity) requested() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]string(nil), f.slugs...)
}

func (f *fakeIdentity) lastToken() string {
	f.mu.Lock()
	defer f.mu.Unlock()
	if len(f.tokens) == 0 {
		return ""
	}
	return f.tokens[len(f.tokens)-1]
}

func (f *fakeIdentity) failWith(status int) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.forceErr = status
}

func acme() Company {
	return Company{
		CompanyID:         acmeID,
		Slug:              "acme",
		Name:              "Acme Inc",
		State:             "active",
		SubscriptionState: "active",
		PortalAvailable:   true,
	}
}

func newResolver(t *testing.T, identity *fakeIdentity, cache *fakeRedis) *Resolver {
	t.Helper()

	cfg := Config{
		IdentityURL: identity.URL,
		Logger:      discardLogger(),
	}
	if cache != nil {
		cfg.Cache = cache.client(t)
	}

	return NewResolver(cfg)
}

func TestResolveFetchesAndCaches(t *testing.T) {
	identity := startFakeIdentity(t, map[string]Company{"acme": acme()})
	cache := startFakeRedis(t)
	resolver := newResolver(t, identity, cache)

	company, err := resolver.Resolve(context.Background(), "acme")
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if company.CompanyID != acmeID {
		t.Errorf("company id = %q, want %q", company.CompanyID, acmeID)
	}
	if company.PortalAvailable != true {
		t.Errorf("portalAvailable = false, want true")
	}

	cached, ok := cache.get("tenant:slug:acme")
	if !ok {
		t.Fatal("resolved tenant was not written to the cache")
	}

	var decoded Company
	if err := json.Unmarshal([]byte(cached), &decoded); err != nil {
		t.Fatalf("cached value is not a company document: %v", err)
	}
	if decoded.CompanyID != acmeID {
		t.Errorf("cached company id = %q, want %q", decoded.CompanyID, acmeID)
	}
}

// TestResolveServesFromCache is the whole point of the cache: every request to
// a company portal needs this answer, and none of them should reach identity.
func TestResolveServesFromCache(t *testing.T) {
	identity := startFakeIdentity(t, map[string]Company{"acme": acme()})
	cache := startFakeRedis(t)
	resolver := newResolver(t, identity, cache)

	for i := range 5 {
		company, err := resolver.Resolve(context.Background(), "acme")
		if err != nil {
			t.Fatalf("Resolve #%d: %v", i, err)
		}
		if company.CompanyID != acmeID {
			t.Fatalf("Resolve #%d company id = %q, want %q", i, company.CompanyID, acmeID)
		}
	}

	if got := len(identity.requested()); got != 1 {
		t.Errorf("identity was called %d times, want 1", got)
	}
}

// TestResolveCachesNegativeLookups keeps a scan for valid subdomains from
// turning into one identity request per guess.
func TestResolveCachesNegativeLookups(t *testing.T) {
	identity := startFakeIdentity(t, map[string]Company{"acme": acme()})
	cache := startFakeRedis(t)
	resolver := newResolver(t, identity, cache)

	for i := range 4 {
		_, err := resolver.Resolve(context.Background(), "nobody")
		if !errors.Is(err, ErrNotFound) {
			t.Fatalf("Resolve #%d error = %v, want ErrNotFound", i, err)
		}
	}

	if got := len(identity.requested()); got != 1 {
		t.Errorf("identity was called %d times for an unknown slug, want 1", got)
	}
	if _, ok := cache.get("tenant:slug:nobody"); !ok {
		t.Error("unknown slug was not negatively cached")
	}
}

// TestNegativeCacheExpiresSoonerThanPositive pins the asymmetry: a suspension
// must take effect quickly, but an unknown slug is safe to remember only long
// enough to absorb a burst.
func TestNegativeCacheExpiresSoonerThanPositive(t *testing.T) {
	identity := startFakeIdentity(t, map[string]Company{"acme": acme()})
	cache := startFakeRedis(t)
	resolver := newResolver(t, identity, cache)

	if _, err := resolver.Resolve(context.Background(), "acme"); err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if _, err := resolver.Resolve(context.Background(), "nobody"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("Resolve unknown slug error = %v, want ErrNotFound", err)
	}

	positive, ok := cache.ttl("tenant:slug:acme")
	if !ok {
		t.Fatal("positive cache entry has no expiry")
	}
	negative, ok := cache.ttl("tenant:slug:nobody")
	if !ok {
		t.Fatal("negative cache entry has no expiry")
	}

	if negative >= positive {
		t.Errorf("negative ttl %v is not shorter than positive ttl %v", negative, positive)
	}
	if positive > time.Minute {
		t.Errorf("positive ttl %v is longer than a minute, which would keep a suspended portal open", positive)
	}
}

func TestResolveIgnoresCorruptCacheEntry(t *testing.T) {
	identity := startFakeIdentity(t, map[string]Company{"acme": acme()})
	cache := startFakeRedis(t)
	resolver := newResolver(t, identity, cache)

	// Something else wrote nonsense under our key; a request must still work.
	client := cache.client(t)
	if err := client.Set(context.Background(), "tenant:slug:acme", "{not json", time.Minute).Err(); err != nil {
		t.Fatalf("seed cache: %v", err)
	}

	company, err := resolver.Resolve(context.Background(), "acme")
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if company.CompanyID != acmeID {
		t.Errorf("company id = %q, want %q", company.CompanyID, acmeID)
	}
	if got := len(identity.requested()); got != 1 {
		t.Errorf("identity was called %d times, want 1", got)
	}
}

// TestResolveToleratesCacheReadFailure: a Redis outage must degrade the cache,
// not close every company portal on the platform.
func TestResolveToleratesCacheReadFailure(t *testing.T) {
	identity := startFakeIdentity(t, map[string]Company{"acme": acme()})
	cache := startFakeRedis(t)
	cache.setFailReads(true)
	resolver := newResolver(t, identity, cache)

	for i := range 3 {
		company, err := resolver.Resolve(context.Background(), "acme")
		if err != nil {
			t.Fatalf("Resolve #%d: %v", i, err)
		}
		if company.CompanyID != acmeID {
			t.Fatalf("Resolve #%d company id = %q, want %q", i, company.CompanyID, acmeID)
		}
	}

	// Every read failed, so every request fell through to identity.
	if got := len(identity.requested()); got != 3 {
		t.Errorf("identity was called %d times, want 3", got)
	}
}

func TestInvalidateDropsCachedTenant(t *testing.T) {
	identity := startFakeIdentity(t, map[string]Company{"acme": acme()})
	cache := startFakeRedis(t)
	resolver := newResolver(t, identity, cache)

	ctx := context.Background()
	if _, err := resolver.Resolve(ctx, "acme"); err != nil {
		t.Fatalf("Resolve: %v", err)
	}

	// Mixed case on the way in: invalidation must hit the same key Resolve wrote.
	resolver.Invalidate(ctx, "ACME")

	if _, ok := cache.get("tenant:slug:acme"); ok {
		t.Fatal("cache entry survived Invalidate")
	}

	if _, err := resolver.Resolve(ctx, "acme"); err != nil {
		t.Fatalf("Resolve after invalidate: %v", err)
	}
	if got := len(identity.requested()); got != 2 {
		t.Errorf("identity was called %d times, want 2", got)
	}
}

func TestResolveNormalizesSlug(t *testing.T) {
	tests := []struct {
		name string
		slug string
	}{
		{name: "uppercase", slug: "ACME"},
		{name: "mixed case", slug: "AcMe"},
		{name: "surrounding whitespace", slug: "  acme  "},
		{name: "both", slug: "\tACME "},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			identity := startFakeIdentity(t, map[string]Company{"acme": acme()})
			cache := startFakeRedis(t)
			resolver := newResolver(t, identity, cache)

			company, err := resolver.Resolve(context.Background(), tc.slug)
			if err != nil {
				t.Fatalf("Resolve(%q): %v", tc.slug, err)
			}
			if company.CompanyID != acmeID {
				t.Errorf("company id = %q, want %q", company.CompanyID, acmeID)
			}

			// A per-casing cache key would multiply the cache and let one
			// spelling serve a tenant the other spelling had invalidated.
			if _, ok := cache.get("tenant:slug:acme"); !ok {
				t.Errorf("Resolve(%q) did not write the normalized cache key", tc.slug)
			}
			if got := identity.requested(); len(got) != 1 || got[0] != "acme" {
				t.Errorf("identity was asked for %v, want [acme]", got)
			}
		})
	}
}

func TestResolveRejectsEmptySlug(t *testing.T) {
	tests := []struct {
		name string
		slug string
	}{
		{name: "empty", slug: ""},
		{name: "spaces", slug: "   "},
		{name: "tab", slug: "\t"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			identity := startFakeIdentity(t, map[string]Company{"acme": acme()})
			cache := startFakeRedis(t)
			resolver := newResolver(t, identity, cache)

			_, err := resolver.Resolve(context.Background(), tc.slug)
			if !errors.Is(err, ErrNotFound) {
				t.Fatalf("Resolve(%q) error = %v, want ErrNotFound", tc.slug, err)
			}

			// An empty slug is not a lookup; it must not reach identity at all.
			if got := identity.requested(); len(got) != 0 {
				t.Errorf("identity was called %v for an empty slug", got)
			}
			if gets, _, _ := cache.counts(); gets != 0 {
				t.Errorf("cache was read %d times for an empty slug", gets)
			}
		})
	}
}

func TestResolveUpstreamFailureIsNotCached(t *testing.T) {
	identity := startFakeIdentity(t, map[string]Company{"acme": acme()})
	cache := startFakeRedis(t)
	resolver := newResolver(t, identity, cache)

	identity.failWith(http.StatusInternalServerError)

	_, err := resolver.Resolve(context.Background(), "acme")
	if err == nil {
		t.Fatal("Resolve succeeded against a failing identity service")
	}
	// A 500 is not "no such tenant": reporting it as ErrNotFound would turn a
	// transient identity outage into a 404 for a real company portal.
	if errors.Is(err, ErrNotFound) {
		t.Error("an identity outage was reported as ErrNotFound")
	}
	if _, ok := cache.get("tenant:slug:acme"); ok {
		t.Error("a failed lookup was cached")
	}

	identity.failWith(0)

	if _, err := resolver.Resolve(context.Background(), "acme"); err != nil {
		t.Fatalf("Resolve after recovery: %v", err)
	}
}

func TestResolveSendsInternalToken(t *testing.T) {
	identity := startFakeIdentity(t, map[string]Company{"acme": acme()})
	resolver := NewResolver(Config{
		IdentityURL:   identity.URL,
		InternalToken: "s3cret",
		Logger:        discardLogger(),
	})

	if _, err := resolver.Resolve(context.Background(), "acme"); err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if got := identity.lastToken(); got != "s3cret" {
		t.Errorf("X-Internal-Token = %q, want %q", got, "s3cret")
	}
}

// TestResolveWithoutCache covers the degraded wiring: no Redis configured at
// all must still resolve, just without the saving.
func TestResolveWithoutCache(t *testing.T) {
	identity := startFakeIdentity(t, map[string]Company{
		"acme":   acme(),
		"globex": {CompanyID: globexID, Slug: "globex", PortalAvailable: false},
	})
	resolver := NewResolver(Config{IdentityURL: identity.URL, Logger: discardLogger()})

	ctx := context.Background()
	for range 3 {
		if _, err := resolver.Resolve(ctx, "acme"); err != nil {
			t.Fatalf("Resolve: %v", err)
		}
	}

	lapsed, err := resolver.Resolve(ctx, "globex")
	if err != nil {
		t.Fatalf("Resolve globex: %v", err)
	}
	if lapsed.PortalAvailable {
		t.Error("portalAvailable = true, want false for a lapsed tenant")
	}

	if got := len(identity.requested()); got != 4 {
		t.Errorf("identity was called %d times, want 4", got)
	}

	// Invalidate without a cache must be a no-op rather than a panic.
	resolver.Invalidate(ctx, "acme")
}

func TestResolveTrailingSlashInIdentityURL(t *testing.T) {
	identity := startFakeIdentity(t, map[string]Company{"acme": acme()})
	resolver := NewResolver(Config{IdentityURL: identity.URL + "/", Logger: discardLogger()})

	if _, err := resolver.Resolve(context.Background(), "acme"); err != nil {
		t.Fatalf("Resolve: %v", err)
	}
}
