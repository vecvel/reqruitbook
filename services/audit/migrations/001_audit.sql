-- Audit service schema.
--
-- This service writes nothing of its own. Every row here is one platform event,
-- recorded by the consumer as it arrives, so a company can see what happened
-- inside its account and the platform can see what happened across all of them.
--
-- Because the only writer is an event consumer, the table is shaped around the
-- two things that consumer has to guarantee: that a redelivered event leaves one
-- row, and that a tenant's query can never reach another tenant's rows.

CREATE TABLE audit_entries (
    -- The event id is the primary key rather than a fresh identifier.
    --
    -- JetStream redelivers on any nak, on an ack timeout, and whenever a replica
    -- restarts mid-batch; several replicas consume the same durable. Making the
    -- event's own id the key turns every one of those into a no-op INSERT
    -- instead of a duplicate line in an audit trail, which is the one place a
    -- duplicate is not merely untidy — a trail that shows an action twice is a
    -- trail somebody will act on.
    id             text PRIMARY KEY,

    subject        text NOT NULL,
    -- The subject with the platform prefix removed, stored rather than derived
    -- at read time so `?action=` is an indexed equality rather than a LIKE over
    -- every row a tenant owns.
    action         text NOT NULL,

    -- Nullable, deliberately, and the one place this service departs from the
    -- "company_id uuid not null" rule in the service contract.
    --
    -- Platform-wide facts (a plan published, a platform user deactivated) belong
    -- to no tenant and must still be recorded. NULL is the right representation
    -- and it is also the safe one: `WHERE company_id = $1` never matches NULL in
    -- SQL, so a platform event cannot appear in a company's trail even if a
    -- later query forgets to say so explicitly. A sentinel uuid would have had
    -- to be excluded by hand at every call site.
    company_id     uuid,

    actor_id       text NOT NULL DEFAULT '',
    correlation_id text NOT NULL DEFAULT '',

    -- What the event was about, resolved once at ingest from the subject and the
    -- payload, so a reader can filter "everything that happened to this job"
    -- without the database reaching into jsonb on every row.
    entity_type    text NOT NULL DEFAULT '',
    entity_id      text NOT NULL DEFAULT '',

    -- When the fact happened, as the publishing service saw it. This is the sort
    -- key: recorded_at is when this service caught up, which after an outage is
    -- a different and much less useful ordering.
    occurred_at    timestamptz NOT NULL,
    recorded_at    timestamptz NOT NULL DEFAULT now(),

    -- The event body after redaction. Never the raw payload: this table is a
    -- long-lived copy of every event on the platform, read by two portals, so
    -- anything secret that lands here has had its blast radius multiplied.
    payload        jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Every company-scoped read is "this tenant, newest first", paged by keyset on
-- (occurred_at, id). The partial predicate keeps platform rows out of the index
-- entirely, so the tenant index stays small on an installation where most events
-- are platform-wide.
CREATE INDEX audit_entries_company_idx
    ON audit_entries (company_id, occurred_at DESC, id DESC)
    WHERE company_id IS NOT NULL;

-- The three filters a trail is actually read through. Each leads with company_id
-- so the tenant predicate is satisfied by the index rather than by a filter step
-- after a wider scan.
CREATE INDEX audit_entries_company_action_idx
    ON audit_entries (company_id, action, occurred_at DESC, id DESC)
    WHERE company_id IS NOT NULL;

CREATE INDEX audit_entries_company_entity_idx
    ON audit_entries (company_id, entity_type, entity_id, occurred_at DESC, id DESC)
    WHERE company_id IS NOT NULL;

CREATE INDEX audit_entries_company_actor_idx
    ON audit_entries (company_id, actor_id, occurred_at DESC, id DESC)
    WHERE company_id IS NOT NULL;

-- The platform feed spans every tenant and the tenantless rows too, so it needs
-- an index that does not lead with company_id.
CREATE INDEX audit_entries_occurred_idx
    ON audit_entries (occurred_at DESC, id DESC);

CREATE INDEX audit_entries_action_idx
    ON audit_entries (action, occurred_at DESC, id DESC);
