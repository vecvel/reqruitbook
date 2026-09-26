// Package store is the notifications service's persistence layer.
//
// Every read of somebody's inbox takes the recipient as an explicit argument
// and carries it in the WHERE clause. There is no "load the notification, then
// check who it belongs to": a load-then-check can be forgotten at a new call
// site, and a filtered query answers "not found" rather than confirming that a
// row with that id exists in someone else's inbox.
package store

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
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

// InTx runs fn inside a transaction, rolling back on error.
func (s *Store) InTx(ctx context.Context, fn func(pgx.Tx) error) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("store: begin transaction: %w", err)
	}

	if err := fn(tx); err != nil {
		// The rollback must not be cancelled along with the request.
		_ = tx.Rollback(context.WithoutCancel(ctx))
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("store: commit transaction: %w", err)
	}
	return nil
}

// nullableUUID renders an optional tenant for a nullable uuid column.
//
// pgx rejects "" for a uuid, and a company id is genuinely absent for a
// candidate or platform notification rather than empty.
func nullableUUID(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

// truncate bounds text that came from an error message before it is stored.
func truncate(value string, limit int) string {
	if len(value) <= limit {
		return value
	}
	return value[:limit]
}
