-- Support service schema.
--
-- One ticket has two audiences. The company that raised it sees the
-- conversation; the platform support desk sees the same conversation plus its
-- own internal notes. Those notes are triage chatter — "this tenant is three
-- invoices overdue, stall them" — and leaking one to the customer is the worst
-- failure this service can have.
--
-- The separation is therefore made in the schema rather than in application
-- code. A view that does not project the `internal` column is the only thing
-- the company-facing repository is allowed to read: a company-side query cannot
-- widen back to an internal note even if a future author forgets the predicate,
-- because the rows are not in the relation it selects from.

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------
-- Enums rather than text plus a CHECK: an invalid state becomes a write error
-- at the boundary instead of a row nothing knows how to render.
CREATE TYPE support_ticket_state AS ENUM (
    'open',
    'awaiting_customer',
    'awaiting_support',
    'resolved',
    'closed'
);

CREATE TYPE support_ticket_priority AS ENUM ('low', 'normal', 'high', 'urgent');

CREATE TYPE support_ticket_category AS ENUM (
    'billing',
    'technical',
    'account',
    'feature_request',
    'other'
);

-- Who wrote a message. Not the same thing as the principal type: a platform
-- agent acting inside a tenant still writes as 'platform', because the audience
-- rules follow the desk, not the session.
CREATE TYPE support_author_kind AS ENUM ('company', 'platform');

-- ---------------------------------------------------------------------------
-- Tickets
-- ---------------------------------------------------------------------------
CREATE TABLE support_tickets (
    id                     text PRIMARY KEY,
    -- The tenant. Always written from the verified principal, never from a
    -- request body; every company-side statement in this service filters on it.
    company_id             uuid NOT NULL,
    -- Denormalised for the support desk's list view. The desk is cross-tenant
    -- and there are no cross-service joins, so the slug is carried on the row
    -- rather than looked up per ticket.
    company_slug           text NOT NULL DEFAULT '',
    subject                text NOT NULL,
    category               support_ticket_category NOT NULL DEFAULT 'other',
    priority               support_ticket_priority NOT NULL DEFAULT 'normal',
    state                  support_ticket_state NOT NULL DEFAULT 'open',
    opened_by_account_id   text NOT NULL,
    opened_by_email        text NOT NULL DEFAULT '',
    -- The platform account currently handling the ticket. Text, not a foreign
    -- key: staff accounts live in identity and this service owns its own
    -- database.
    assigned_agent_id      text,
    -- Advances on any message, internal notes included, because the desk sorts
    -- its queue by it and a note is work done on the ticket.
    last_activity_at       timestamptz NOT NULL DEFAULT now(),
    resolved_at            timestamptz,
    closed_at              timestamptz,
    -- Replay protection for POST /tickets. A retried create that reaches us
    -- twice must not open two tickets.
    idempotency_key        text,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Leads with company_id: the company-side list is the hot path and it is always
-- tenant-scoped. The trailing (created_at, id) matches the keyset sort exactly,
-- so paging a large tenant never degrades into a sort of the whole tenant.
CREATE INDEX support_tickets_company_idx
    ON support_tickets (company_id, created_at DESC, id DESC);

-- The desk's queue: open work first, newest first, across every tenant.
CREATE INDEX support_tickets_queue_idx
    ON support_tickets (state, created_at DESC, id DESC);

CREATE INDEX support_tickets_agent_idx
    ON support_tickets (assigned_agent_id, created_at DESC)
    WHERE assigned_agent_id IS NOT NULL;

-- Scoped to the tenant: two companies may legitimately send the same key, and a
-- global unique index would let one tenant's retry collide with another's
-- create — a cross-tenant denial of service through a guessable header.
CREATE UNIQUE INDEX support_tickets_idempotency_idx
    ON support_tickets (company_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------
CREATE TABLE support_ticket_messages (
    id                 text PRIMARY KEY,
    ticket_id          text NOT NULL REFERENCES support_tickets (id) ON DELETE CASCADE,
    -- Denormalised from the ticket so a company-side read filters by tenant on
    -- the row it is reading, rather than trusting a join to carry the predicate.
    company_id         uuid NOT NULL,
    author_kind        support_author_kind NOT NULL,
    author_account_id  text NOT NULL,
    author_email       text NOT NULL DEFAULT '',
    body               text NOT NULL,
    -- The whole point of this table's split audience. See the view below.
    internal           boolean NOT NULL DEFAULT false,
    idempotency_key    text,
    created_at         timestamptz NOT NULL DEFAULT now(),

    -- A company can never author an internal note. Without this, a bug in the
    -- company controller that passed `internal: true` would hide the customer's
    -- own message from the customer, and the row would look legitimate.
    CONSTRAINT support_messages_internal_is_platform
        CHECK (NOT internal OR author_kind = 'platform')
);

CREATE INDEX support_messages_thread_idx
    ON support_ticket_messages (ticket_id, created_at, id);

CREATE INDEX support_messages_company_idx
    ON support_ticket_messages (company_id, ticket_id);

CREATE UNIQUE INDEX support_messages_idempotency_idx
    ON support_ticket_messages (ticket_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Attachments
-- ---------------------------------------------------------------------------
-- Bytes live in object storage; this table holds only the key and the metadata
-- needed to render a link. Every key is prefixed company/<companyId>/support/,
-- which the service verifies before it records the row, so a bucket policy can
-- enforce the same boundary the application does.
CREATE TABLE support_ticket_attachments (
    id            text PRIMARY KEY,
    ticket_id     text NOT NULL REFERENCES support_tickets (id) ON DELETE CASCADE,
    -- Attachments hang off a message, not off the ticket, so an attachment on
    -- an internal note inherits that note's audience automatically instead of
    -- through a second flag that could drift out of step with it.
    message_id    text NOT NULL REFERENCES support_ticket_messages (id) ON DELETE CASCADE,
    company_id    uuid NOT NULL,
    object_key    text NOT NULL,
    file_name     text NOT NULL,
    content_type  text NOT NULL,
    size_bytes    bigint NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX support_attachments_ticket_idx
    ON support_ticket_attachments (ticket_id, created_at);

CREATE INDEX support_attachments_company_idx
    ON support_ticket_attachments (company_id, ticket_id);

-- One object is referenced once. A second row pointing at the same key would let
-- a deletion on one ticket break a link on another.
CREATE UNIQUE INDEX support_attachments_key_idx
    ON support_ticket_attachments (object_key);

-- ---------------------------------------------------------------------------
-- The company-facing projection
-- ---------------------------------------------------------------------------
-- Everything the company side reads comes from these two views and never from
-- the base tables. They do not project `internal` at all, so a company-side
-- query cannot select it, cannot filter on it, and cannot accidentally return a
-- row that has it set. Filtering in a serializer would protect the one code
-- path that remembered to do it; this protects every path there will ever be.
CREATE VIEW support_company_messages AS
SELECT
    id,
    ticket_id,
    company_id,
    author_kind,
    author_account_id,
    author_email,
    body,
    created_at
FROM support_ticket_messages
WHERE internal = false;

CREATE VIEW support_company_attachments AS
SELECT
    a.id,
    a.ticket_id,
    a.message_id,
    a.company_id,
    a.object_key,
    a.file_name,
    a.content_type,
    a.size_bytes,
    a.created_at
FROM support_ticket_attachments a
JOIN support_ticket_messages m ON m.id = a.message_id
WHERE m.internal = false;

COMMENT ON VIEW support_company_messages IS
    'Company-facing thread. Internal notes are excluded here, in SQL, because a '
    'filter applied in application code protects only the call site that '
    'remembers it. The company-side repository must read this and never '
    'support_ticket_messages.';

COMMENT ON VIEW support_company_attachments IS
    'Company-facing attachments. An attachment on an internal note is invisible '
    'for the same reason its note is.';
