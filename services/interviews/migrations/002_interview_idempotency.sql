-- Idempotency for scheduling a round.
--
-- Scheduling publishes `interview.scheduled`, which notifications turns into a
-- message to the candidate and the panel. A create retried after a timeout —
-- which is what a client does — therefore booked a second round and sent a
-- second set of invitations for a conversation that was already on the calendar.
--
-- Partial, so the many rows that carry no key do not collide with each other,
-- and scoped to the company because a key is only unique within the tenant that
-- issued it.
ALTER TABLE interviews ADD COLUMN idempotency_key text;

CREATE UNIQUE INDEX interviews_idempotency_idx
    ON interviews (company_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
