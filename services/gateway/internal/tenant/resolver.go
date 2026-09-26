// Package tenant resolves a company subdomain into the tenant behind it.
package tenant

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// ErrNotFound means no company owns the slug.
var ErrNotFound = errors.New("tenant: company not found")

// Company is what the gateway needs to know about a tenant.
type Company struct {
	CompanyID         string `json:"companyId"`
	Slug              string `json:"slug"`
	Name              string `json:"name"`
	State             string `json:"state"`
	SubscriptionState string `json:"subscriptionState"`
	PortalAvailable   bool   `json:"portalAvailable"`
}

// Resolver looks up companies by slug, with a short-lived cache.
//
// Every request to a company portal needs this answer, so it is cached in Redis
// for a few seconds: long enough to keep the identity service off the hot path,
// short enough that a suspension takes effect almost immediately.
type Resolver struct {
	identityURL   string
	internalToken string
	cache         *redis.Client
	client        *http.Client
	logger        *slog.Logger
	ttl           time.Duration
	negativeTTL   time.Duration
}

// Config configures the resolver.
type Config struct {
	IdentityURL   string
	InternalToken string
	Cache         *redis.Client
	Logger        *slog.Logger
	TTL           time.Duration
	NegativeTTL   time.Duration
}

// NewResolver builds a tenant resolver.
func NewResolver(cfg Config) *Resolver {
	if cfg.TTL == 0 {
		cfg.TTL = 30 * time.Second
	}
	if cfg.NegativeTTL == 0 {
		// Unknown slugs are cached briefly so a scan for valid subdomains cannot
		// hammer the identity service.
		cfg.NegativeTTL = 10 * time.Second
	}

	return &Resolver{
		identityURL:   strings.TrimRight(cfg.IdentityURL, "/"),
		internalToken: cfg.InternalToken,
		cache:         cfg.Cache,
		client:        &http.Client{Timeout: 3 * time.Second},
		logger:        cfg.Logger,
		ttl:           cfg.TTL,
		negativeTTL:   cfg.NegativeTTL,
	}
}

const missingMarker = "__missing__"

// Resolve returns the company owning a slug.
func (r *Resolver) Resolve(ctx context.Context, slug string) (Company, error) {
	slug = strings.ToLower(strings.TrimSpace(slug))
	if slug == "" {
		return Company{}, ErrNotFound
	}

	cacheKey := "tenant:slug:" + slug

	if r.cache != nil {
		cached, err := r.cache.Get(ctx, cacheKey).Result()
		switch {
		case err == nil && cached == missingMarker:
			return Company{}, ErrNotFound
		case err == nil:
			var company Company
			if json.Unmarshal([]byte(cached), &company) == nil {
				return company, nil
			}
		case !errors.Is(err, redis.Nil):
			// A cache miss is normal; a cache failure is worth knowing about but
			// must not stop the request.
			r.logger.Warn("tenant cache read failed", slog.Any("error", err))
		}
	}

	company, err := r.fetch(ctx, slug)
	if err != nil {
		if errors.Is(err, ErrNotFound) && r.cache != nil {
			r.cache.Set(ctx, cacheKey, missingMarker, r.negativeTTL)
		}
		return Company{}, err
	}

	if r.cache != nil {
		if encoded, marshalErr := json.Marshal(company); marshalErr == nil {
			r.cache.Set(ctx, cacheKey, encoded, r.ttl)
		}
	}

	return company, nil
}

// Invalidate drops a cached tenant, used when a company changes state.
func (r *Resolver) Invalidate(ctx context.Context, slug string) {
	if r.cache == nil {
		return
	}
	r.cache.Del(ctx, "tenant:slug:"+strings.ToLower(slug))
}

func (r *Resolver) fetch(ctx context.Context, slug string) (Company, error) {
	endpoint := fmt.Sprintf("%s/internal/portal/resolve?slug=%s", r.identityURL, slug)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return Company{}, fmt.Errorf("tenant: build request: %w", err)
	}
	req.Header.Set("X-Internal-Token", r.internalToken)

	resp, err := r.client.Do(req)
	if err != nil {
		return Company{}, fmt.Errorf("tenant: resolve %q: %w", slug, err)
	}
	defer func() { _ = resp.Body.Close() }()

	switch resp.StatusCode {
	case http.StatusOK:
		var company Company
		if err := json.NewDecoder(resp.Body).Decode(&company); err != nil {
			return Company{}, fmt.Errorf("tenant: decode response: %w", err)
		}
		return company, nil
	case http.StatusNotFound:
		return Company{}, ErrNotFound
	default:
		return Company{}, fmt.Errorf("tenant: identity returned %d resolving %q", resp.StatusCode, slug)
	}
}
