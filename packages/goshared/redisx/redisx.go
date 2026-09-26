// Package redisx opens the shared Redis client and provides the primitives the
// platform builds on top of it: rate limiting and short-lived caching.
package redisx

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
)

// Connect opens a client and verifies it can reach the server.
func Connect(ctx context.Context, url string, logger *slog.Logger) (*redis.Client, error) {
	opts, err := redis.ParseURL(url)
	if err != nil {
		return nil, fmt.Errorf("redis: parse url: %w", err)
	}

	opts.MaxRetries = 3
	opts.MinRetryBackoff = 50 * time.Millisecond
	opts.MaxRetryBackoff = 500 * time.Millisecond
	opts.DialTimeout = 5 * time.Second
	opts.ReadTimeout = 3 * time.Second
	opts.WriteTimeout = 3 * time.Second

	client := redis.NewClient(opts)

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := client.Ping(pingCtx).Err(); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("redis: ping: %w", err)
	}

	if logger != nil {
		logger.Info("redis connected", slog.String("addr", opts.Addr), slog.Int("db", opts.DB))
	}

	return client, nil
}

// HealthCheck returns a readiness probe for the client.
func HealthCheck(client *redis.Client) func(context.Context) error {
	return func(ctx context.Context) error {
		return client.Ping(ctx).Err()
	}
}

// ErrRateLimited is returned when a caller exceeds its allowance.
var ErrRateLimited = errors.New("rate limit exceeded")

// RateLimitResult describes the outcome of a rate-limit check.
type RateLimitResult struct {
	Allowed    bool
	Limit      int
	Remaining  int
	RetryAfter time.Duration
	ResetAt    time.Time
}

// slidingWindowScript implements a sliding-window counter atomically.
//
// A fixed window lets a caller send 2x the limit across a window boundary; a
// sliding window closes that gap. Running it as a script keeps the read, prune,
// and write in one round trip so concurrent requests cannot race past the limit.
var slidingWindowScript = redis.NewScript(`
local key     = KEYS[1]
local now     = tonumber(ARGV[1])
local window  = tonumber(ARGV[2])
local limit   = tonumber(ARGV[3])
local member  = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)

if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local reset = window
  if oldest[2] then
    reset = (tonumber(oldest[2]) + window) - now
  end
  return {0, count, reset}
end

redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
return {1, count + 1, window}
`)

// RateLimiter enforces sliding-window limits.
type RateLimiter struct {
	client *redis.Client
	prefix string
}

// NewRateLimiter builds a limiter that namespaces its keys under prefix.
func NewRateLimiter(client *redis.Client, prefix string) *RateLimiter {
	if prefix == "" {
		prefix = "ratelimit"
	}
	return &RateLimiter{client: client, prefix: prefix}
}

// Allow records an attempt and reports whether it is within the allowance.
//
// Redis being unavailable fails open: a cache outage should degrade protection,
// not take down sign-in for everyone.
func (r *RateLimiter) Allow(ctx context.Context, key string, limit int, window time.Duration) (RateLimitResult, error) {
	now := time.Now()
	redisKey := fmt.Sprintf("%s:%s", r.prefix, key)
	member := fmt.Sprintf("%d-%d", now.UnixNano(), now.Nanosecond())

	raw, err := slidingWindowScript.Run(ctx, r.client,
		[]string{redisKey},
		now.UnixMilli(),
		window.Milliseconds(),
		limit,
		member,
	).Slice()
	if err != nil {
		return RateLimitResult{Allowed: true, Limit: limit, Remaining: limit}, fmt.Errorf("redis: rate limit: %w", err)
	}

	allowed := toInt(raw[0]) == 1
	count := toInt(raw[1])
	resetMillis := toInt(raw[2])

	remaining := limit - count
	if remaining < 0 {
		remaining = 0
	}

	result := RateLimitResult{
		Allowed:   allowed,
		Limit:     limit,
		Remaining: remaining,
		ResetAt:   now.Add(time.Duration(resetMillis) * time.Millisecond),
	}
	if !allowed {
		result.RetryAfter = time.Duration(resetMillis) * time.Millisecond
	}

	return result, nil
}

func toInt(v any) int {
	switch value := v.(type) {
	case int64:
		return int(value)
	case int:
		return value
	case float64:
		return int(value)
	default:
		return 0
	}
}
