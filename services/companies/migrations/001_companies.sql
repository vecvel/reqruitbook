-- Companies service schema.
--
-- This service owns the tenant record itself: the row created here *is* the
-- company that every other service filters by. That is why the table has no
-- `company_id` column — its primary key is the tenant key, and every query in
-- the repository still carries it as a predicate for exactly the same reason a
-- tenant-scoped table would.
--
-- The identity service keeps a narrow projection of these rows (slug, name,
-- state) fed by events. It is a projection, not a source: nothing here is read
-- across the service boundary.

CREATE TYPE company_state AS ENUM ('pending_review', 'active', 'suspended', 'closed');

CREATE TABLE companies (
    -- A uuid rather than the platform's prefixed ULID: the company id is minted
    -- at registration and handed to identity, which types it as a uuid.
    id                      uuid PRIMARY KEY,

    -- The subdomain the careers portal is served on.
    slug                    text NOT NULL,

    legal_name              text NOT NULL,
    display_name            text NOT NULL,
    state                   company_state NOT NULL DEFAULT 'pending_review',

    description             text NOT NULL DEFAULT '',
    logo_key                text NOT NULL DEFAULT '',
    website                 text NOT NULL DEFAULT '',
    industry                text NOT NULL DEFAULT '',
    size                    text NOT NULL DEFAULT '',
    founded_year            integer,
    headquarters            text NOT NULL DEFAULT '',
    country                 text NOT NULL DEFAULT '',
    -- Lists and maps that are only ever read as a whole live as jsonb rather
    -- than as child tables: nothing queries inside them, and a careers page
    -- renders them in one shot.
    locations               jsonb NOT NULL DEFAULT '[]'::jsonb,
    social_links            jsonb NOT NULL DEFAULT '{}'::jsonb,
    contact_email           text NOT NULL DEFAULT '',
    contact_phone           text NOT NULL DEFAULT '',

    -- Careers portal presentation.
    brand_color             text NOT NULL DEFAULT '',
    hero_image_key          text NOT NULL DEFAULT '',
    tagline                 text NOT NULL DEFAULT '',
    about_markdown          text NOT NULL DEFAULT '',
    benefits                jsonb NOT NULL DEFAULT '[]'::jsonb,
    -- STORED ONLY. Nothing in this service verifies domain ownership and
    -- nothing routes on this value; serving a custom domain requires DNS
    -- validation and a certificate, both of which are out of scope. Until that
    -- exists, `custom_domain_verified` stays false and the column is a note to
    -- the operator, not a routing input.
    custom_domain           text NOT NULL DEFAULT '',
    custom_domain_verified  boolean NOT NULL DEFAULT false,
    portal_published        boolean NOT NULL DEFAULT false,

    -- Who registered the company. The owner's account lives in identity; what is
    -- kept here is what the registration form supplied, for support and audit.
    owner_email             text NOT NULL DEFAULT '',
    owner_name              text NOT NULL DEFAULT '',
    owner_account_id        text NOT NULL DEFAULT '',

    -- Platform-side bookkeeping. Never returned by a company or public endpoint.
    internal_notes          text NOT NULL DEFAULT '',
    suspension_reason       text NOT NULL DEFAULT '',
    approved_at             timestamptz,
    suspended_at            timestamptz,
    -- Soft delete: a removed tenant's data is still referenced by other
    -- services, so the row is hidden rather than destroyed.
    deleted_at              timestamptz,

    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT companies_slug_shape CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 3 AND 40),
    CONSTRAINT companies_founded_year CHECK (founded_year IS NULL OR founded_year BETWEEN 1800 AND 2200),
    CONSTRAINT companies_locations_is_array CHECK (jsonb_typeof(locations) = 'array'),
    CONSTRAINT companies_benefits_is_array CHECK (jsonb_typeof(benefits) = 'array'),
    CONSTRAINT companies_social_is_object CHECK (jsonb_typeof(social_links) = 'object')
);

-- Slug uniqueness is a constraint, not a pre-check.
--
-- Two registrations for the same slug arriving at the same instant both pass a
-- SELECT and both insert; only the database can decide that race. The index
-- covers every row including soft-deleted ones, because a slug is a hostname:
-- recycling it would point old links and bookmarks at a different tenant.
CREATE UNIQUE INDEX companies_slug_key ON companies (slug);

-- The platform console lists by state, newest first, and pages with
-- (created_at, id) — the same sort the cursor encodes.
CREATE INDEX companies_state_created_idx ON companies (state, created_at DESC, id DESC);
CREATE INDEX companies_created_idx ON companies (created_at DESC, id DESC);

-- Support looks a company up by the address the customer quotes.
CREATE INDEX companies_owner_email_idx ON companies (lower(owner_email));

CREATE OR REPLACE FUNCTION companies_touch_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- A trigger rather than a column list in every UPDATE: a statement that forgets
-- to set updated_at is not an error anything would catch.
CREATE TRIGGER companies_set_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION companies_touch_updated_at();
