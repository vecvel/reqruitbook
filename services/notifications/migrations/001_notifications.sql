-- Notifications service schema.
--
-- This service owns *who was told what, on which channel, and whether they have
-- seen it*. It holds no accounts, no applications and no conversations: every
-- fact it reacts to arrives as an event, and the only foreign identifiers it
-- stores are an account id minted by identity and a company_id minted by the
-- companies service. Neither carries a foreign key — they live in other
-- databases.
--
-- The notification types are plain text rather than an enum. A new platform
-- event should be routable by adding a constant in Go and a row here, not by an
-- ALTER TYPE that has to be deployed before the service that emits it.

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
CREATE TABLE notifications (
    id              text PRIMARY KEY,

    -- The recipient. A notification is always addressed to one account: there
    -- is no "everyone at this company" row, because a broadcast would need its
    -- own per-person read state and the two would drift apart.
    principal_type  text NOT NULL CHECK (principal_type IN ('company', 'candidate', 'platform')),
    account_id      text NOT NULL,
    -- Set for every company notification and for a candidate notification whose
    -- subject is a company (an application, an offer). It is context for the
    -- candidate and a hard filter for the company.
    company_id      uuid,

    type            text NOT NULL,
    title           text NOT NULL,
    body            text NOT NULL DEFAULT '',
    -- A portal-relative path. Storing an absolute URL would bake today's
    -- hostname into a row that outlives it.
    link            text NOT NULL DEFAULT '',
    -- Identifiers the front end needs to deep-link or group. Never a token, a
    -- password, a message body or a signed URL: this row is read back over the
    -- API and rendered into an email.
    payload         jsonb NOT NULL DEFAULT '{}'::jsonb,

    read_at         timestamptz,

    -- The platform event this notification came from. It is what makes a
    -- JetStream redelivery a no-op instead of a second buzz in someone's
    -- pocket.
    event_id        text NOT NULL DEFAULT '',

    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    -- A company notification without a tenant could be listed by any company
    -- principal whose account id matched, so the schema refuses to store one.
    CONSTRAINT notifications_company_scoped CHECK (
        principal_type <> 'company' OR company_id IS NOT NULL)
);

-- The inbox query: one recipient, newest first, keyset paginated on
-- (created_at, id).
CREATE INDEX notifications_inbox_idx
    ON notifications (principal_type, account_id, created_at DESC, id DESC);

-- Unread badge counts, which every portal asks for on every page load.
CREATE INDEX notifications_unread_idx
    ON notifications (principal_type, account_id)
    WHERE read_at IS NULL;

-- One event notifies one recipient once. The predicate keeps the index off the
-- rows a future API might create without an originating event.
CREATE UNIQUE INDEX notifications_event_recipient_idx
    ON notifications (event_id, principal_type, account_id)
    WHERE event_id <> '';

-- ---------------------------------------------------------------------------
-- Per-recipient channel preferences
-- ---------------------------------------------------------------------------
--
-- Preferences are keyed by tenant as well as account: the same person may
-- recruit for two companies and want a mail for every application at one and
-- none at the other. Postgres treats NULLs as distinct in a unique key, so a
-- nullable company_id would let a candidate accumulate a new preference row on
-- every write; the nil-UUID sentinel gives the tenant-less principals exactly
-- one row each.
CREATE TABLE notification_preferences (
    principal_type  text NOT NULL CHECK (principal_type IN ('company', 'candidate', 'platform')),
    account_id      text NOT NULL,
    company_id      uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',

    -- {"application.submitted": {"inApp": true, "email": false}, ...}
    -- Only the types the recipient has actually changed are stored; everything
    -- absent falls back to the defaults in Go, so shipping a new notification
    -- type does not require backfilling every row.
    channels        jsonb NOT NULL DEFAULT '{}'::jsonb,

    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (principal_type, account_id, company_id)
);

-- ---------------------------------------------------------------------------
-- The recipient directory
-- ---------------------------------------------------------------------------
--
-- A company-side event ("an application was submitted") names a tenant, not the
-- people in it, and identity exposes no internal endpoint that lists a
-- company's members. So this service keeps its own directory, learned from
-- verified principals: every authenticated request through the gateway carries
-- the account, the tenant, the email and the resolved permission keys, and each
-- one refreshes the row below. Nothing a client sends is trusted here — these
-- are the gateway's own headers, which it sets after verifying a token.
--
-- The consequence is honest and worth stating: a recruiter who has never opened
-- the product gets no fan-out until their first signed-in request. Replacing
-- this with an internal members endpoint on identity would close that gap.
CREATE TABLE notification_recipients (
    principal_type  text NOT NULL CHECK (principal_type IN ('company', 'candidate', 'platform')),
    account_id      text NOT NULL,
    company_id      uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',

    email           text NOT NULL DEFAULT '',
    display_name    text NOT NULL DEFAULT '',
    -- The permission keys the principal held when last seen. Fan-out uses them
    -- to decide who at a company hears about an application, so a coordinator
    -- without applications.read is not mailed about a pipeline they cannot open.
    permissions     text[] NOT NULL DEFAULT '{}',

    last_seen_at    timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (principal_type, account_id, company_id)
);

CREATE INDEX notification_recipients_tenant_idx
    ON notification_recipients (company_id, principal_type);

-- ---------------------------------------------------------------------------
-- The email queue
-- ---------------------------------------------------------------------------
--
-- An SMTP conversation takes seconds and fails often. Doing it inside the event
-- consumer would hold a JetStream ack open until the mail server answered, and
-- a slow relay would stall every other notification behind it. The consumer
-- writes a row here instead and a worker drains it.
CREATE TABLE email_outbox (
    id               text PRIMARY KEY,

    -- Derived from the source event and the recipient, so a redelivered event
    -- collides here instead of sending a second copy.
    dedupe_key       text NOT NULL,
    notification_id  text NOT NULL DEFAULT '',

    company_id       uuid,
    to_address       text NOT NULL,
    to_name          text NOT NULL DEFAULT '',
    subject          text NOT NULL,
    -- The template name; the body is rendered at send time, not stored, so a
    -- copy fix reaches mail that has not gone out yet.
    template         text NOT NULL DEFAULT 'notification',
    data             jsonb NOT NULL DEFAULT '{}'::jsonb,

    attempts         integer NOT NULL DEFAULT 0,
    max_attempts     integer NOT NULL DEFAULT 5,
    next_attempt_at  timestamptz NOT NULL DEFAULT now(),
    last_error       text NOT NULL DEFAULT '',

    sent_at          timestamptz,
    -- Set when attempts ran out. The row is kept rather than deleted: a queue
    -- that silently drops mail is indistinguishable from one that works.
    dead_lettered_at timestamptz,

    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT email_outbox_attempts_bounded CHECK (max_attempts BETWEEN 1 AND 20)
);

CREATE UNIQUE INDEX email_outbox_dedupe_idx ON email_outbox (dedupe_key);

-- The worker's claim query. Partial, so the index stays the size of the backlog
-- rather than the size of everything ever sent.
CREATE INDEX email_outbox_due_idx
    ON email_outbox (next_attempt_at, id)
    WHERE sent_at IS NULL AND dead_lettered_at IS NULL;
