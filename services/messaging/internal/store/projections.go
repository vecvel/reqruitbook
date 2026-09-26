package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

// Projections of facts this service does not own.
//
// Neither table is ever joined to another service's database — there is no such
// join to make. They exist so the eligibility decision can be answered from
// local state in the common case, and so the part of a candidate's visibility
// that no internal endpoint exposes is still knowable here.

/* -------------------------------------------------------------------------- */
/* Visibility                                                                 */
/* -------------------------------------------------------------------------- */

// Visibility is a candidate's contactability as this service last heard it.
type Visibility struct {
	AccountID         string
	Discoverable      bool
	HideFromCompanies []string
	Deleted           bool
	Version           int64
	// Known is false when no event for this candidate has arrived yet.
	Known bool
}

// BlocksCompany reports whether the candidate has excluded a company.
func (v Visibility) BlocksCompany(companyID string) bool {
	for _, blocked := range v.HideFromCompanies {
		if blocked == companyID {
			return true
		}
	}
	return false
}

// FindVisibility reads the projected visibility for a candidate.
//
// An unknown candidate is not an error: the projection may simply not have heard
// about them yet, and the caller decides what an unknown block list means.
func (s *Store) FindVisibility(ctx context.Context, accountID string) (Visibility, error) {
	var v Visibility
	err := s.pool.QueryRow(ctx, `
		SELECT account_id, discoverable, hide_from_companies::text[], deleted, version
		FROM candidate_visibility
		WHERE account_id = $1`, accountID).
		Scan(&v.AccountID, &v.Discoverable, &v.HideFromCompanies, &v.Deleted, &v.Version)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Visibility{AccountID: accountID}, nil
		}
		return Visibility{}, fmt.Errorf("store: find visibility: %w", err)
	}

	v.Known = true
	return v, nil
}

// UpsertVisibility applies a full visibility event.
//
// The version guard is what makes the consumer safe under JetStream's
// out-of-order redelivery: an older delivery must not resurrect a block list the
// candidate has since changed.
func (s *Store) UpsertVisibility(
	ctx context.Context, accountID string, discoverable bool, hideFrom []string, version int64,
) error {
	if hideFrom == nil {
		hideFrom = []string{}
	}

	_, err := s.pool.Exec(ctx, `
		INSERT INTO candidate_visibility (account_id, discoverable, hide_from_companies, version, updated_at)
		VALUES ($1, $2, $3::uuid[], $4, now())
		ON CONFLICT (account_id) DO UPDATE
		SET discoverable = EXCLUDED.discoverable,
		    hide_from_companies = EXCLUDED.hide_from_companies,
		    version = EXCLUDED.version,
		    updated_at = now()
		WHERE candidate_visibility.version <= EXCLUDED.version`,
		accountID, discoverable, hideFrom, version)
	if err != nil {
		return fmt.Errorf("store: upsert visibility: %w", err)
	}
	return nil
}

// UpsertDiscoverability applies a profile-update event.
//
// It deliberately leaves hide_from_companies alone: the profile event does not
// carry the block list, and writing a default would silently un-block every
// company the candidate had excluded.
func (s *Store) UpsertDiscoverability(
	ctx context.Context, accountID string, discoverable, deleted bool, version int64,
) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO candidate_visibility (account_id, discoverable, deleted, version, updated_at)
		VALUES ($1, $2, $3, $4, now())
		ON CONFLICT (account_id) DO UPDATE
		SET discoverable = EXCLUDED.discoverable,
		    deleted = EXCLUDED.deleted,
		    version = EXCLUDED.version,
		    updated_at = now()
		WHERE candidate_visibility.version <= EXCLUDED.version`,
		accountID, discoverable, deleted, version)
	if err != nil {
		return fmt.Errorf("store: upsert discoverability: %w", err)
	}
	return nil
}

/* -------------------------------------------------------------------------- */
/* Application links                                                          */
/* -------------------------------------------------------------------------- */

// HasApplied reports whether a candidate has applied to one of a company's jobs.
//
// This is the first branch of "may this company open a thread?", and the one
// that makes the common case free: a recruiter messaging an applicant needs no
// call to another service at all.
func (s *Store) HasApplied(ctx context.Context, companyID, candidateAccountID string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM candidate_company_links
			WHERE company_id = $1 AND candidate_account_id = $2)`,
		companyID, candidateAccountID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("store: check application link: %w", err)
	}
	return exists, nil
}

// ApplicationLink is one application this service has heard about.
type ApplicationLink struct {
	CompanyID          string
	CandidateAccountID string
	ApplicationID      string
	JobID              string
	JobTitle           string
	SubmittedAt        time.Time
}

// RecordApplication projects an application submission.
//
// Keyed on (company, application) so a redelivered event updates rather than
// duplicates. The application id is the natural key here — the same candidate
// may apply to several of a company's jobs.
func (s *Store) RecordApplication(ctx context.Context, link ApplicationLink) error {
	linkedAt := link.SubmittedAt
	if linkedAt.IsZero() {
		linkedAt = time.Now().UTC()
	}

	_, err := s.pool.Exec(ctx, `
		INSERT INTO candidate_company_links (
			company_id, candidate_account_id, application_id, job_id, job_title, linked_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (company_id, application_id) DO UPDATE
		SET candidate_account_id = EXCLUDED.candidate_account_id,
		    job_id = EXCLUDED.job_id,
		    job_title = EXCLUDED.job_title`,
		link.CompanyID, link.CandidateAccountID, link.ApplicationID,
		link.JobID, link.JobTitle, linkedAt)
	if err != nil {
		return fmt.Errorf("store: record application link: %w", err)
	}
	return nil
}
