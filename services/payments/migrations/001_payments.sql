-- Payments service schema.
--
-- The payments service owns *what a company was charged and what the provider
-- said about it*. It does not own plans or entitlements — those belong to
-- subscriptions — and it holds no card data of any kind. What is kept here is
-- the minimum needed to reconcile money against a provider and to answer
-- "what did this tenant pay, and for what".
--
-- Every amount is a bigint in the currency's minor unit (cents, pence, paise)
-- alongside an ISO-4217 code. Floating point cannot represent 0.1 exactly, so a
-- float total silently drifts by a cent across a few thousand invoices, and
-- reconciliation against the provider then fails for reasons nobody can trace.

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------
-- The payment lifecycle as this service models it, not as any one provider
-- names it. A provider's vocabulary is translated at the provider boundary so
-- that swapping Stripe for someone else does not rewrite every query.
CREATE TYPE payment_state AS ENUM (
    'pending',              -- checkout created, the customer has not paid yet
    'processing',           -- the provider has the money but has not settled
    'succeeded',
    'failed',
    'refunded',             -- fully refunded
    'partially_refunded',
    'cancelled'             -- checkout abandoned or expired
);

CREATE TYPE refund_state AS ENUM ('pending', 'succeeded', 'failed');

CREATE TYPE webhook_status AS ENUM (
    'received',             -- claimed, not yet finished — a crash leaves this
    'processed',
    'ignored',              -- understood and deliberately not acted on
    'failed'
);

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
-- One row per attempt to take money from a company. The row is created when a
-- checkout is opened, so an abandoned checkout is visible rather than absent —
-- "nothing happened" and "the customer bounced off the card form" are different
-- facts and support needs to tell them apart.
--
-- No card number, no CVV and no PAN is stored here or anywhere else in this
-- service. The provider's opaque identifiers are enough to refund, reconcile
-- and support a payment; card_brand and card_last4 exist only so an invoice can
-- say "Visa ending 4242" without a round trip to the provider, and they are the
-- only instrument details that ever leave the provider's systems. Storing more
-- would drag this database into PCI-DSS scope for no product benefit.
CREATE TABLE payments (
    id                    text PRIMARY KEY,
    company_id            uuid NOT NULL,
    -- Which provider produced the ids in this row. Kept per row, not read from
    -- configuration, because a refund must go back to the provider that took
    -- the money even after the platform has switched providers.
    provider              text NOT NULL,
    provider_checkout_id  text,
    provider_payment_id   text,
    plan_id               text NOT NULL,
    -- Filled in once subscriptions has created or extended the subscription
    -- this payment bought. Not a foreign key: subscriptions is another service
    -- and another database.
    subscription_id       text,
    amount_minor          bigint NOT NULL CHECK (amount_minor >= 0),
    currency              char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    refunded_minor        bigint NOT NULL DEFAULT 0 CHECK (refunded_minor >= 0),
    state                 payment_state NOT NULL DEFAULT 'pending',
    -- A provider's decline message, already sanitised at the provider boundary.
    failure_reason        text NOT NULL DEFAULT '',
    card_brand            text NOT NULL DEFAULT '',
    card_last4            text NOT NULL DEFAULT '' CHECK (card_last4 = '' OR card_last4 ~ '^[0-9]{4}$'),
    -- Client-supplied Idempotency-Key for the checkout that created this row.
    -- A recruiter double-clicking "Upgrade" on a flaky connection must not open
    -- two checkouts and pay twice.
    idempotency_key       text NOT NULL DEFAULT '',
    metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    -- Refunding more than was charged is a data-integrity failure, not a
    -- business decision; the database refuses it even if application code slips.
    CONSTRAINT payments_refund_within_amount CHECK (refunded_minor <= amount_minor)
);

-- Leading with company_id: every tenant-scoped read filters on it first, and an
-- index that does not lead with the tenant makes the isolation predicate free
-- only by accident.
CREATE INDEX payments_company_idx ON payments (company_id, created_at DESC, id DESC);

-- The platform-wide list is the one legitimate cross-tenant read in this
-- service, and it pages by the same (created_at, id) key.
CREATE INDEX payments_created_idx ON payments (created_at DESC, id DESC);

-- A provider identifier must map to exactly one payment row. Without this a
-- retried webhook that arrives before the first has committed could mint a
-- second payment for the same charge — the database, not a code path, is what
-- makes that impossible.
CREATE UNIQUE INDEX payments_provider_payment_idx
    ON payments (provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE UNIQUE INDEX payments_provider_checkout_idx
    ON payments (provider, provider_checkout_id) WHERE provider_checkout_id IS NOT NULL;

-- Scoped to the tenant: one company's key must never collide with another's,
-- and a key is only ever replayed by the client that sent it.
CREATE UNIQUE INDEX payments_idempotency_idx
    ON payments (company_id, idempotency_key) WHERE idempotency_key <> '';

-- ---------------------------------------------------------------------------
-- Refunds
-- ---------------------------------------------------------------------------
-- Separate rows rather than a column on payments, because a payment may be
-- refunded in several parts and each part has its own provider id and its own
-- settlement outcome.
CREATE TABLE refunds (
    id                   text PRIMARY KEY,
    payment_id           text NOT NULL REFERENCES payments (id) ON DELETE RESTRICT,
    -- Denormalised from the payment so that a tenant-scoped refund query needs
    -- no join, and so the tenant predicate cannot be lost in one.
    company_id           uuid NOT NULL,
    provider             text NOT NULL,
    provider_refund_id   text,
    amount_minor         bigint NOT NULL CHECK (amount_minor > 0),
    currency             char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    state                refund_state NOT NULL DEFAULT 'pending',
    reason               text NOT NULL DEFAULT '',
    -- Who ordered it. A platform account id, recorded because refunds are the
    -- one action in this service that moves money back out.
    requested_by         text NOT NULL DEFAULT '',
    -- The provider interface takes no idempotency key, so the guard against a
    -- retried refund request lives here instead: same key, same payment, same
    -- refund row.
    idempotency_key      text NOT NULL DEFAULT '',
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX refunds_company_idx ON refunds (company_id, created_at DESC, id DESC);
CREATE INDEX refunds_payment_idx ON refunds (payment_id, created_at DESC);
CREATE UNIQUE INDEX refunds_provider_refund_idx
    ON refunds (provider, provider_refund_id) WHERE provider_refund_id IS NOT NULL;
CREATE UNIQUE INDEX refunds_idempotency_idx
    ON refunds (payment_id, idempotency_key) WHERE idempotency_key <> '';

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------
-- Issued when a payment succeeds. Lines are stored as JSON rather than as a
-- child table because an invoice is immutable once issued: it is a record of
-- what was billed at a moment in time, and it must not change when a plan is
-- later renamed or repriced.
CREATE TABLE invoices (
    id              text PRIMARY KEY,
    -- Human-facing document number. Unique across the platform, not per tenant,
    -- so a number quoted in a support ticket identifies one document.
    number          text NOT NULL UNIQUE,
    company_id      uuid NOT NULL,
    payment_id      text REFERENCES payments (id) ON DELETE SET NULL,
    lines           jsonb NOT NULL DEFAULT '[]'::jsonb,
    subtotal_minor  bigint NOT NULL CHECK (subtotal_minor >= 0),
    tax_minor       bigint NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
    total_minor     bigint NOT NULL CHECK (total_minor >= 0),
    currency        char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    issued_at       timestamptz NOT NULL DEFAULT now(),
    -- Object storage key for the rendered PDF. The bytes never live in this
    -- database; the key is prefixed with the owning tenant so a bucket policy
    -- can enforce what application code also enforces.
    pdf_key         text NOT NULL DEFAULT '',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invoices_company_idx ON invoices (company_id, created_at DESC, id DESC);

-- One invoice per payment. A webhook redelivery that slipped past the event
-- ledger still cannot produce a second invoice for the same charge.
CREATE UNIQUE INDEX invoices_payment_idx ON invoices (payment_id) WHERE payment_id IS NOT NULL;

-- Invoice numbers come from a sequence rather than from count(*) + 1: two
-- concurrent successes would otherwise compute the same number, and the unique
-- index would turn a billing event into a failed webhook. A sequence may skip a
-- value on rollback, which is acceptable — numbers must be unique and ascending,
-- not gapless.
CREATE SEQUENCE invoice_number_seq AS bigint START WITH 1 INCREMENT BY 1;

-- ---------------------------------------------------------------------------
-- Webhook event ledger
-- ---------------------------------------------------------------------------
-- The idempotency record. Providers retry on any non-2xx response and
-- occasionally deliver the same event twice even after a 200, so "have I seen
-- this event id" must be answered by a uniqueness constraint rather than by a
-- lookup that races. Double-crediting a subscription is a financial bug, not a
-- cosmetic one.
--
-- There is no company_id here on purpose: an event arrives before the tenant is
-- known, and the tenant is resolved from the payment the event refers to. A
-- company_id copied off an untrusted payload would be exactly the cross-tenant
-- write this platform's rules exist to prevent.
CREATE TABLE webhook_events (
    id                 text PRIMARY KEY,
    provider           text NOT NULL,
    provider_event_id  text NOT NULL UNIQUE,
    type               text NOT NULL,
    status             webhook_status NOT NULL DEFAULT 'received',
    -- The verified payload as the provider sent it, kept for reconciliation and
    -- for replaying a delivery that failed downstream.
    payload            jsonb NOT NULL DEFAULT '{}'::jsonb,
    ignored_reason     text NOT NULL DEFAULT '',
    -- Set when the ledger committed but a downstream effect (event publish,
    -- subscription activation) did not. Rows with a delivery error are what a
    -- reconciliation job replays.
    delivery_error     text NOT NULL DEFAULT '',
    received_at        timestamptz NOT NULL DEFAULT now(),
    processed_at       timestamptz
);

CREATE INDEX webhook_events_received_idx ON webhook_events (received_at DESC);
-- Partial index over the small set a reconciliation job cares about.
CREATE INDEX webhook_events_unsettled_idx
    ON webhook_events (received_at) WHERE processed_at IS NULL OR delivery_error <> '';

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payments_touch BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER refunds_touch BEFORE UPDATE ON refunds
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER invoices_touch BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
