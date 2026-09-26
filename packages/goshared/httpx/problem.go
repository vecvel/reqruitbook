// Package httpx holds the platform's HTTP server, middleware, and error format.
//
// Errors are returned as RFC 9457 problem documents so every service — Go or
// TypeScript — reports failures in one shape that clients can branch on.
package httpx

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
)

// Problem is an RFC 9457 "problem details" document.
type Problem struct {
	Type     string `json:"type"`
	Title    string `json:"title"`
	Status   int    `json:"status"`
	Detail   string `json:"detail,omitempty"`
	Instance string `json:"instance,omitempty"`
	// Code is a stable, machine-readable identifier clients can switch on.
	Code string `json:"code,omitempty"`
	// Errors carries field-level validation failures.
	Errors map[string][]string `json:"errors,omitempty"`
	// RequestID lets a caller quote a failure back to support.
	RequestID string `json:"requestId,omitempty"`
}

// Error implements error so a Problem can be returned from service code.
func (p *Problem) Error() string {
	if p.Detail != "" {
		return p.Detail
	}
	return p.Title
}

// NewProblem builds a problem document.
func NewProblem(status int, code, title, detail string) *Problem {
	return &Problem{
		Type:   "about:blank",
		Title:  title,
		Status: status,
		Detail: detail,
		Code:   code,
	}
}

// Common problem constructors.

func BadRequest(detail string) *Problem {
	return NewProblem(http.StatusBadRequest, "bad_request", "Bad Request", detail)
}

func Unauthorized(detail string) *Problem {
	return NewProblem(http.StatusUnauthorized, "unauthenticated", "Unauthorized", detail)
}

func Forbidden(detail string) *Problem {
	return NewProblem(http.StatusForbidden, "forbidden", "Forbidden", detail)
}

func NotFound(detail string) *Problem {
	return NewProblem(http.StatusNotFound, "not_found", "Not Found", detail)
}

func Conflict(code, detail string) *Problem {
	return NewProblem(http.StatusConflict, code, "Conflict", detail)
}

func TooManyRequests(detail string) *Problem {
	return NewProblem(http.StatusTooManyRequests, "rate_limited", "Too Many Requests", detail)
}

func Internal(detail string) *Problem {
	return NewProblem(http.StatusInternalServerError, "internal_error", "Internal Server Error", detail)
}

// ValidationFailed builds a 422 carrying field-level errors.
func ValidationFailed(fields map[string][]string) *Problem {
	p := NewProblem(http.StatusUnprocessableEntity, "validation_failed", "Validation Failed",
		"One or more fields are invalid.")
	p.Errors = fields
	return p
}

// WriteJSON writes a JSON response.
func WriteJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)

	if body == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.Default().Error("httpx: failed to encode response", slog.Any("error", err))
	}
}

// WriteProblem writes an error as a problem document.
//
// Unrecognized errors are reported as a generic 500: internal messages are
// logged, never returned, so a stack trace or SQL error can't leak to a client.
func WriteProblem(w http.ResponseWriter, r *http.Request, err error) {
	problem := AsProblem(err)
	problem.Instance = r.URL.Path
	problem.RequestID = RequestIDFromContext(r.Context())

	if problem.Status >= http.StatusInternalServerError {
		slog.Default().Error("request failed",
			slog.String("path", r.URL.Path),
			slog.String("method", r.Method),
			slog.String("request_id", problem.RequestID),
			slog.Any("error", err),
		)
	}

	w.Header().Set("Content-Type", "application/problem+json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(problem.Status)

	if encodeErr := json.NewEncoder(w).Encode(problem); encodeErr != nil {
		slog.Default().Error("httpx: failed to encode problem", slog.Any("error", encodeErr))
	}
}

// AsProblem converts an error into a problem document.
func AsProblem(err error) *Problem {
	if err == nil {
		return Internal("An unexpected error occurred.")
	}

	var problem *Problem
	if errors.As(err, &problem) {
		return problem
	}

	return Internal("An unexpected error occurred.")
}

// NoContent writes a 204.
func NoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}
