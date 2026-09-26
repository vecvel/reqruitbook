-- Identity service schema.
--
-- The identity service owns *who can sign in and what they may do*. Company
-- profiles, jobs, and applications live in their own services; what is kept here
-- is the minimum needed to authenticate a request and authorize it.

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------
-- A realm separates the three sign-in surfaces. The same person may hold a
-- candidate account on jobs.{host} and a recruiter account at their employer
-- without the two colliding, so email is unique per realm rather than globally.
CREATE TYPE account_realm AS ENUM ('platform', 'company', 'candidate');
CREATE TYPE account_status AS ENUM ('pending', 'active', 'suspended', 'deactivated');

CREATE TABLE accounts (
    id                   text PRIMARY KEY,
    realm                account_realm NOT NULL,
    email                text NOT NULL,
    password_hash        text,
    full_name            text NOT NULL DEFAULT '',
    status               account_status NOT NULL DEFAULT 'pending',
    email_verified_at    timestamptz,
    -- Lockout state lives with the account so a brute-force attempt against one
    -- login cannot be spread across application instances.
    failed_login_count   integer NOT NULL DEFAULT 0,
    locked_until         timestamptz,
    last_login_at        timestamptz,
    last_login_ip        text,
    metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX accounts_realm_email_idx ON accounts (realm, lower(email));
CREATE INDEX accounts_status_idx ON accounts (status);

-- ---------------------------------------------------------------------------
-- Company projection
-- ---------------------------------------------------------------------------
-- A read model maintained from events published by the companies and
-- subscriptions services. Identity needs the slug to route a login and the
-- subscription state to decide whether a portal may be entered at all; it does
-- not need — and must not hold — the company's profile.
CREATE TYPE company_state AS ENUM ('pending_review', 'active', 'suspended', 'closed');
CREATE TYPE subscription_state AS ENUM ('none', 'trialing', 'active', 'past_due', 'expired', 'cancelled');

CREATE TABLE companies (
    id                       text PRIMARY KEY,
    slug                     text NOT NULL,
    name                     text NOT NULL,
    state                    company_state NOT NULL DEFAULT 'pending_review',
    subscription_state       subscription_state NOT NULL DEFAULT 'none',
    subscription_expires_at  timestamptz,
    -- Entitlements the active plan grants (seat counts, feature flags).
    entitlements             jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX companies_slug_idx ON companies (lower(slug));
CREATE INDEX companies_state_idx ON companies (state);

-- ---------------------------------------------------------------------------
-- Roles and permissions
-- ---------------------------------------------------------------------------
-- A role with company_id = NULL is platform-scoped (root console staff).
-- A role with a company_id belongs to that company and can never be seen,
-- assigned, or edited from another tenant.
CREATE TABLE roles (
    id               text PRIMARY KEY,
    company_id       text REFERENCES companies (id) ON DELETE CASCADE,
    realm            account_realm NOT NULL,
    slug             text NOT NULL,
    name             text NOT NULL,
    description      text,
    badge            text DEFAULT 'Custom',
    -- Permission keys in the platform's `<feature>.<action>` form.
    permissions      jsonb NOT NULL DEFAULT '[]'::jsonb,
    -- Unrestricted within its scope; exactly one per scope, never editable.
    is_super_admin   boolean NOT NULL DEFAULT false,
    -- Shipped with the product: renameable and re-permissionable, not deletable.
    is_system        boolean NOT NULL DEFAULT false,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Company roles are unique per company; platform roles are unique globally.
CREATE UNIQUE INDEX roles_company_slug_idx
    ON roles (company_id, lower(slug)) WHERE company_id IS NOT NULL;
CREATE UNIQUE INDEX roles_platform_slug_idx
    ON roles (lower(slug)) WHERE company_id IS NULL;
CREATE INDEX roles_company_idx ON roles (company_id);

-- ---------------------------------------------------------------------------
-- Company membership
-- ---------------------------------------------------------------------------
-- One account may work for several companies. Membership — not the account — is
-- what carries company roles, so revoking access at one employer leaves the
-- other untouched.
CREATE TYPE membership_status AS ENUM ('invited', 'active', 'suspended', 'removed');

CREATE TABLE company_memberships (
    id             text PRIMARY KEY,
    account_id     text NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    company_id     text NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    status         membership_status NOT NULL DEFAULT 'invited',
    -- The founding member; cannot be removed while they are the only owner.
    is_owner       boolean NOT NULL DEFAULT false,
    job_title      text,
    invited_by     text REFERENCES accounts (id) ON DELETE SET NULL,
    invited_at     timestamptz,
    joined_at      timestamptz,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX company_memberships_account_company_idx
    ON company_memberships (account_id, company_id);
CREATE INDEX company_memberships_company_idx ON company_memberships (company_id);
CREATE INDEX company_memberships_account_idx ON company_memberships (account_id);

-- Roles held through a membership (company realm).
CREATE TABLE membership_roles (
    membership_id  text NOT NULL REFERENCES company_memberships (id) ON DELETE CASCADE,
    role_id        text NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    is_primary     boolean NOT NULL DEFAULT false,
    assigned_by    text REFERENCES accounts (id) ON DELETE SET NULL,
    assigned_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (membership_id, role_id)
);

-- Roles held directly by an account (platform realm).
CREATE TABLE account_roles (
    account_id   text NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    role_id      text NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    is_primary   boolean NOT NULL DEFAULT false,
    assigned_by  text REFERENCES accounts (id) ON DELETE SET NULL,
    assigned_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, role_id)
);

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------
-- Refresh tokens are opaque and stored only as a hash. Keeping sessions in the
-- database is what makes revocation real: deactivating a user or resetting a
-- password ends their live sessions, which a self-contained JWT cannot do.
CREATE TABLE sessions (
    id                  text PRIMARY KEY,
    account_id          text NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    -- Which company the session is acting in; null for platform and candidates.
    membership_id       text REFERENCES company_memberships (id) ON DELETE CASCADE,
    company_id          text REFERENCES companies (id) ON DELETE CASCADE,
    refresh_token_hash  text NOT NULL,
    -- Set when a refresh token is rotated, so replay of an old token is detectable.
    rotated_to          text REFERENCES sessions (id) ON DELETE SET NULL,
    ip_address          text,
    user_agent          text,
    expires_at          timestamptz NOT NULL,
    revoked_at          timestamptz,
    revoked_reason      text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    last_used_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX sessions_refresh_hash_idx ON sessions (refresh_token_hash);
CREATE INDEX sessions_account_idx ON sessions (account_id) WHERE revoked_at IS NULL;
CREATE INDEX sessions_expiry_idx ON sessions (expires_at) WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- One-time tokens (verification, password reset, invitations)
-- ---------------------------------------------------------------------------
CREATE TYPE one_time_token_purpose AS ENUM ('email_verification', 'password_reset', 'invitation');

CREATE TABLE one_time_tokens (
    id           text PRIMARY KEY,
    account_id   text NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    purpose      one_time_token_purpose NOT NULL,
    token_hash   text NOT NULL,
    context      jsonb NOT NULL DEFAULT '{}'::jsonb,
    expires_at   timestamptz NOT NULL,
    consumed_at  timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX one_time_tokens_hash_idx ON one_time_tokens (token_hash);
CREATE INDEX one_time_tokens_account_purpose_idx
    ON one_time_tokens (account_id, purpose) WHERE consumed_at IS NULL;

-- ---------------------------------------------------------------------------
-- Authentication audit trail
-- ---------------------------------------------------------------------------
CREATE TABLE auth_events (
    id           text PRIMARY KEY,
    account_id   text REFERENCES accounts (id) ON DELETE SET NULL,
    company_id   text REFERENCES companies (id) ON DELETE SET NULL,
    event        text NOT NULL,
    ip_address   text,
    user_agent   text,
    metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_events_account_idx ON auth_events (account_id, created_at DESC);
CREATE INDEX auth_events_created_idx ON auth_events (created_at DESC);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accounts_touch BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER roles_touch BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER company_memberships_touch BEFORE UPDATE ON company_memberships
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
