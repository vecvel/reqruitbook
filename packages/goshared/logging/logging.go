// Package logging provides the platform's structured logger.
//
// Every service emits the same shape of log line — service name, environment,
// trace and request identifiers — so records from different services can be
// correlated without per-service parsing rules.
package logging

import (
	"context"
	"log/slog"
	"os"
	"strings"
)

type contextKey struct{}

// New builds the logger for a service.
func New(serviceName, environment, level string) *slog.Logger {
	opts := &slog.HandlerOptions{
		Level:     parseLevel(level),
		AddSource: environment != "production",
	}

	var handler slog.Handler
	if environment == "production" {
		handler = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		handler = slog.NewTextHandler(os.Stdout, opts)
	}

	return slog.New(handler).With(
		slog.String("service", serviceName),
		slog.String("env", environment),
	)
}

func parseLevel(level string) slog.Level {
	switch strings.ToLower(strings.TrimSpace(level)) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// WithContext stores a logger on the context so handlers deeper in the stack
// inherit the request's fields.
func WithContext(ctx context.Context, logger *slog.Logger) context.Context {
	return context.WithValue(ctx, contextKey{}, logger)
}

// FromContext returns the request's logger, or the default logger when none is set.
func FromContext(ctx context.Context) *slog.Logger {
	if logger, ok := ctx.Value(contextKey{}).(*slog.Logger); ok && logger != nil {
		return logger
	}
	return slog.Default()
}
