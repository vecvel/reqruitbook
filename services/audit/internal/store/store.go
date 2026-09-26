// Package store is the audit service's persistence layer.
//
// Every company-scoped query takes the tenant as an explicit argument and puts
// it in the WHERE clause rather than loading rows and checking them afterwards.
// In this service that is not merely the platform convention: an audit trail
// that can be made to show another tenant's activity is worse than no audit
// trail at all, because it is believed.
package store

import (
	"github.com/jackc/pgx/v5/pgxpool"
)

// Store owns the connection pool.
type Store struct {
	pool *pgxpool.Pool
}

// New builds a store over an existing pool.
func New(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// Pool exposes the underlying pool for health checks.
func (s *Store) Pool() *pgxpool.Pool { return s.pool }

// nullableUUID renders an empty company id as SQL NULL.
//
// Platform-wide events belong to no tenant, and NULL is what keeps them out of
// every company's trail: `company_id = $1` never matches it.
func nullableUUID(value string) any {
	if value == "" {
		return nil
	}
	return value
}
