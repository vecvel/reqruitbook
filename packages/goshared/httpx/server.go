package httpx

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

// ServerConfig describes how a service exposes HTTP.
type ServerConfig struct {
	Addr            string
	Handler         http.Handler
	Logger          *slog.Logger
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	IdleTimeout     time.Duration
	ShutdownTimeout time.Duration
}

// Serve runs an HTTP server until the process is asked to stop.
//
// Shutdown is graceful: in-flight requests finish before the process exits, so a
// deploy does not drop a request that is mid-write to the database.
func Serve(ctx context.Context, cfg ServerConfig) error {
	if cfg.ReadTimeout == 0 {
		cfg.ReadTimeout = 15 * time.Second
	}
	if cfg.WriteTimeout == 0 {
		cfg.WriteTimeout = 30 * time.Second
	}
	if cfg.IdleTimeout == 0 {
		cfg.IdleTimeout = 90 * time.Second
	}
	if cfg.ShutdownTimeout == 0 {
		cfg.ShutdownTimeout = 20 * time.Second
	}
	if cfg.Logger == nil {
		cfg.Logger = slog.Default()
	}

	server := &http.Server{
		Addr:              cfg.Addr,
		Handler:           cfg.Handler,
		ReadTimeout:       cfg.ReadTimeout,
		ReadHeaderTimeout: 10 * time.Second,
		WriteTimeout:      cfg.WriteTimeout,
		IdleTimeout:       cfg.IdleTimeout,
		BaseContext:       func(net.Listener) context.Context { return ctx },
	}

	serverErr := make(chan error, 1)
	go func() {
		cfg.Logger.Info("http server listening", slog.String("addr", cfg.Addr))
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-serverErr:
		return err
	case <-ctx.Done():
	case sig := <-stop:
		cfg.Logger.Info("shutdown signal received", slog.String("signal", sig.String()))
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		cfg.Logger.Error("graceful shutdown failed", slog.Any("error", err))
		return err
	}

	cfg.Logger.Info("http server stopped")
	return nil
}

// Health returns a handler for liveness and readiness probes.
//
// Readiness runs the supplied checks (database, cache, broker) so an orchestrator
// only routes traffic once the service's dependencies actually answer.
func Health(checks map[string]func(context.Context) error) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()

		results := make(map[string]string, len(checks))
		healthy := true

		for name, check := range checks {
			if err := check(ctx); err != nil {
				results[name] = "error: " + err.Error()
				healthy = false
				continue
			}
			results[name] = "ok"
		}

		status := http.StatusOK
		if !healthy {
			status = http.StatusServiceUnavailable
		}
		WriteJSON(w, status, map[string]any{"status": statusText(healthy), "checks": results})
	})

	return mux
}

func statusText(healthy bool) string {
	if healthy {
		return "ok"
	}
	return "degraded"
}
