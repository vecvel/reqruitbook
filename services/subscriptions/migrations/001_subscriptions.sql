-- Subscriptions service schema.
--
-- This service answers one question for the rest of the platform: *is this
-- company's portal open, and what may it do while it is?* The gateway already
-- enforces a subscription gate; these tables are what can finally satisfy it.
--
-- Plans are a platform-wide catalogue and therefore carry no company_id.
-- Everything else here is tenant-scoped and leads its indexes with company_id.

-- ---------------------------------------------------------------------------
-- Plans
-- ---------------------------------------------------------------------------
-- The duration model is deliberately richer than "monthly or yearly". Sales
-- needs 14-day pilots, 3-month pilots and one-off lifetime deals, and every one
-- of those was historically faked by hand-editing an expiry date. Making the
-- interval a first-class field is what lets those be ordinary plans instead.
--
-- 'lifetime' means exactly that: no expiry is ever computed, so a lifetime
-- subscription's expires_at stays NULL and the sweep below can never touch it.
CREATE TYPE plan_interval AS ENUM ('month', 'year', 'days', 'lifetime');

-- draft  -- editable, invisible to companies
-- published -- offered on the pricing page and subscribable
-- retired -- withdrawn from sale; existing subscribers keep what they bought
CREATE TYPE plan_state AS ENUM ('draft', 'published', 'retired');

CREATE TABLE plans (
    id              text PRIMARY KEY,
    key             text NOT NULL,
    name            text NOT NULL,
    description     text NOT NULL DEFAULT '',

    -- Money is minor units plus an ISO 4217 code. Never a float: 0.1 + 0.2 is
    -- not 0.3, and a billing system that rounds is a billing system that is
    -- wrong by a cent a few thousand times a day.
    price_amount    bigint NOT NULL,
    price_currency  char(3) NOT NULL,

    interval        plan_interval NOT NULL,
    interval_count  integer NOT NULL DEFAULT 1,
    trial_days      integer NOT NULL DEFAULT 0,

    -- The limits the rest of the platform reads. Kept as JSONB rather than as
    -- columns because entitlements are read as a whole document by services
    -- that do not share this schema, and because adding a limit must not be a
    -- migration in a service that only ever copies the map around.
    -- The shape is validated in application code on every write.
    entitlements    jsonb NOT NULL DEFAULT '{}'::jsonb,

    state           plan_state NOT NULL DEFAULT 'draft',
    -- Display order on the pricing page; ties break on price.
    sort_order      integer NOT NULL DEFAULT 0,

    published_at    timestamptz,
    retired_at      timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT plans_price_non_negative CHECK (price_amount >= 0),
    CONSTRAINT plans_currency_upper CHECK (price_currency = upper(price_currency)),
    CONSTRAINT plans_trial_non_negative CHECK (trial_days >= 0),
    CONSTRAINT plans_interval_count_positive CHECK (interval_count >= 1),
    -- A lifetime plan has no recurrence to count, so a count other than 1 would
    -- be a number nothing reads — the kind of field that later gets believed.
    CONSTRAINT plans_lifetime_count CHECK (interval <> 'lifetime' OR interval_count = 1)
);

-- Keys are how other systems and humans refer to a plan, so they are unique
-- case-insensitively: "Growth" and "growth" being two plans is a support ticket.
CREATE UNIQUE INDEX plans_key_idx ON plans (lower(key));
CREATE INDEX plans_state_idx ON plans (state, sort_order, price_amount);

-- ---------------------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------------------
-- 'pending' is this service's own waiting room: a company has chosen a plan but
-- payment has not reported success. It is never published as a state, because
-- identity's projection has no such value and a pending subscription must not
-- open a portal.
CREATE TYPE subscription_state AS ENUM (
    'pending', 'trialing', 'active', 'past_due', 'cancelled', 'expired'
);

CREATE TABLE subscriptions (
    id                    text PRIMARY KEY,
    company_id            uuid NOT NULL,
    plan_id               text NOT NULL REFERENCES plans (id),

    state                 subscription_state NOT NULL DEFAULT 'pending',

    -- started_at is when the subscription first became live, and never moves
    -- again; current_period_* move on every renewal. Keeping both is what lets
    -- "customer since" and "paid through" be different answers.
    started_at            timestamptz,
    current_period_start  timestamptz,
    current_period_end    timestamptz,
    -- NULL means no expiry: a lifetime plan, or a subscription not yet started.
    expires_at            timestamptz,
    trial_ends_at         timestamptz,

    cancel_at_period_end  boolean NOT NULL DEFAULT false,
    cancelled_at          timestamptz,

    -- The entitlements AS THEY WERE AT PURCHASE, not a pointer to the plan.
    --
    -- This is the single most important column in the service. If the rest of
    -- the platform read plans.entitlements through plan_id, then an operator
    -- lowering the Growth plan's maxJobs from 50 to 20 to reprice next quarter
    -- would silently break every company already on Growth — jobs they had
    -- already published would fall outside their limit, with no purchase and no
    -- notice. Snapshotting means a customer keeps what they actually bought,
    -- and a plan edit only affects who buys it next. Moving an existing
    -- customer onto new terms is then a deliberate act (an override, or a
    -- re-subscribe) rather than an invisible side effect of editing a price.
    entitlements          jsonb NOT NULL,

    -- The price as sold, for the same reason. An invoice must reconcile against
    -- what was agreed, not against what the plan costs today.
    price_amount          bigint NOT NULL,
    price_currency        char(3) NOT NULL,
    plan_interval         plan_interval NOT NULL,
    plan_interval_count   integer NOT NULL DEFAULT 1,

    -- Set by the company-facing subscribe call so a double-submitted checkout
    -- produces one pending subscription rather than two.
    idempotency_key       text,

    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT subscriptions_price_non_negative CHECK (price_amount >= 0),
    CONSTRAINT subscriptions_period_ordered
        CHECK (current_period_end IS NULL
               OR current_period_start IS NULL
               OR current_period_end > current_period_start)
);

CREATE INDEX subscriptions_company_idx ON subscriptions (company_id, created_at DESC, id DESC);
CREATE INDEX subscriptions_plan_idx ON subscriptions (plan_id);

-- One live subscription per company, enforced by the database rather than by a
-- read-then-write in application code: two concurrent subscribe calls would
-- both pass a SELECT and both insert, and the company would be billed twice.
-- 'pending' is included so a double checkout cannot open two carts; terminal
-- states are excluded so a company can subscribe again after cancelling.
CREATE UNIQUE INDEX subscriptions_one_live_per_company
    ON subscriptions (company_id)
    WHERE state IN ('pending', 'trialing', 'active', 'past_due');

-- The sweep's working set: everything that can still lapse. Lifetime rows have
-- a NULL expires_at and are excluded from the index entirely, so they cost
-- nothing to skip.
CREATE INDEX subscriptions_expiry_idx
    ON subscriptions (expires_at)
    WHERE expires_at IS NOT NULL AND state IN ('trialing', 'active', 'past_due');

CREATE UNIQUE INDEX subscriptions_idempotency_idx
    ON subscriptions (company_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Overrides
-- ---------------------------------------------------------------------------
-- A manual grant or extension bypasses billing, which makes it exactly the
-- action an auditor will ask about. Who, when, why, and the before/after of the
-- row are recorded together so the answer does not depend on log retention.
CREATE TABLE subscription_overrides (
    id               text PRIMARY KEY,
    subscription_id  text NOT NULL REFERENCES subscriptions (id) ON DELETE CASCADE,
    company_id       uuid NOT NULL,

    actor_id         text NOT NULL,
    actor_email      text NOT NULL DEFAULT '',
    reason           text NOT NULL,

    before_state     jsonb NOT NULL,
    after_state      jsonb NOT NULL,

    created_at       timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT subscription_overrides_reason_present CHECK (length(btrim(reason)) > 0)
);

CREATE INDEX subscription_overrides_company_idx
    ON subscription_overrides (company_id, created_at DESC, id DESC);
CREATE INDEX subscription_overrides_subscription_idx
    ON subscription_overrides (subscription_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Usage counters
-- ---------------------------------------------------------------------------
-- Entitlements are limits; these are the numbers those limits are checked
-- against. Counters live here rather than in each owning service because the
-- limit and the count have to be compared atomically to mean anything.
--
-- period_start buckets the counter. Metrics that reset monthly get the first of
-- the month; metrics that are a running total (jobs currently open, recruiter
-- seats used) get the sentinel 'epoch' date so they accumulate in one row.
CREATE TABLE usage_counters (
    company_id    uuid NOT NULL,
    metric        text NOT NULL,
    period_start  date NOT NULL,
    used          bigint NOT NULL DEFAULT 0,
    updated_at    timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (company_id, metric, period_start),
    -- A decrement that outruns its increments would otherwise leave a negative
    -- count that reads as free headroom.
    CONSTRAINT usage_counters_non_negative CHECK (used >= 0)
);

-- ---------------------------------------------------------------------------
-- Invoices (projection)
-- ---------------------------------------------------------------------------
-- Invoices are owned by the payments service. This is a read model fed by
-- payment events, not a second source of truth: the company portal asks one
-- service for its billing page, and this service must not join across a
-- boundary or make a synchronous call to render it.
--
-- external_id is the payments service's own identifier and carries the
-- uniqueness, so a redelivered event updates the row it already wrote.
CREATE TABLE invoices (
    id            text PRIMARY KEY,
    company_id    uuid NOT NULL,
    external_id   text NOT NULL,
    subscription_id text,

    number        text NOT NULL DEFAULT '',
    status        text NOT NULL,
    amount        bigint NOT NULL,
    currency      char(3) NOT NULL,

    issued_at     timestamptz NOT NULL DEFAULT now(),
    paid_at       timestamptz,
    hosted_url    text NOT NULL DEFAULT '',

    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX invoices_external_idx ON invoices (external_id);
CREATE INDEX invoices_company_idx ON invoices (company_id, created_at DESC, id DESC);
