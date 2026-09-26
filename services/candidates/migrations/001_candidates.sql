-- Candidates service schema.
--
-- This service holds two populations that must never be confused:
--
--   * candidate_profiles and their children are owned by the *candidate*. They
--     are platform-wide, have no company_id, and are reachable by a company only
--     through talent search, and only when the candidate has opted in.
--   * company_candidates is the company's own sourced/imported/referred pool.
--     It is tenant-scoped and private to one company.
--
-- Keeping them in separate tables rather than one table with a nullable
-- company_id is deliberate: a missing predicate on a shared table would leak a
-- candidate's private profile into a company's list, and no reviewer would spot
-- it. Two tables make the mistake impossible to write.

CREATE TYPE employment_type AS ENUM (
    'full_time', 'part_time', 'contract', 'internship', 'temporary', 'freelance'
);

CREATE TYPE work_authorisation AS ENUM (
    'unspecified', 'citizen', 'permanent_resident', 'visa_holder', 'requires_sponsorship'
);

CREATE TYPE candidate_source AS ENUM ('sourced', 'imported', 'referred', 'applied');

-- ---------------------------------------------------------------------------
-- The candidate's own profile
-- ---------------------------------------------------------------------------
CREATE TABLE candidate_profiles (
    id                        text PRIMARY KEY,
    -- The identity account this profile belongs to. Unique so the consumer that
    -- creates the shell on registration is idempotent under redelivery.
    account_id                text NOT NULL,
    email                     text NOT NULL DEFAULT '',
    full_name                 text NOT NULL DEFAULT '',

    headline                  text NOT NULL DEFAULT '',
    summary                   text NOT NULL DEFAULT '',
    location                  text NOT NULL DEFAULT '',
    years_experience          integer NOT NULL DEFAULT 0,
    current_title             text NOT NULL DEFAULT '',
    current_employer          text NOT NULL DEFAULT '',
    phone                     text NOT NULL DEFAULT '',

    skills                    text[] NOT NULL DEFAULT '{}',
    languages                 text[] NOT NULL DEFAULT '{}',

    website_url               text NOT NULL DEFAULT '',
    linkedin_url              text NOT NULL DEFAULT '',
    github_url                text NOT NULL DEFAULT '',

    -- Money is minor units plus an ISO 4217 code; never a float.
    desired_salary_minor      bigint,
    desired_salary_currency   char(3),

    open_to_types             employment_type[] NOT NULL DEFAULT '{}',
    open_to_remote            boolean NOT NULL DEFAULT false,
    work_authorisation        work_authorisation NOT NULL DEFAULT 'unspecified',

    -- Discoverability is the candidate's switch and nobody else's. Default false:
    -- a profile becomes findable only by an explicit act.
    discoverable              boolean NOT NULL DEFAULT false,
    hide_current_employer     boolean NOT NULL DEFAULT false,
    -- Companies this candidate refuses to be shown to — typically their current
    -- employer and its agencies.
    hide_from_companies       uuid[] NOT NULL DEFAULT '{}',

    -- Monotonic, bumped on every profile write, so a consumer of the update
    -- event can discard a delivery older than the row it already holds.
    version                   bigint NOT NULL DEFAULT 1,

    -- Soft delete: an approach or an application already references this row,
    -- and those histories must survive the candidate closing their account.
    deleted_at                timestamptz,
    created_at                timestamptz NOT NULL DEFAULT now(),
    updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX candidate_profiles_account_idx ON candidate_profiles (account_id);

-- Talent search reads only live, opted-in rows, so the index carries the same
-- predicate the query does and never walks a hidden profile.
CREATE INDEX candidate_profiles_discoverable_idx
    ON candidate_profiles (updated_at DESC, id DESC)
    WHERE discoverable AND deleted_at IS NULL;

CREATE INDEX candidate_profiles_skills_idx ON candidate_profiles USING gin (skills);

-- ---------------------------------------------------------------------------
-- Profile children
-- ---------------------------------------------------------------------------
-- Each child carries account_id as well as candidate_id so a handler can write
-- "WHERE id = $1 AND account_id = $2" instead of loading the row and comparing
-- owners afterwards — the same reason tenant tables carry company_id.
CREATE TABLE candidate_experience (
    id             text PRIMARY KEY,
    candidate_id   text NOT NULL REFERENCES candidate_profiles (id) ON DELETE CASCADE,
    account_id     text NOT NULL,
    title          text NOT NULL,
    employer       text NOT NULL,
    location       text NOT NULL DEFAULT '',
    employment_type employment_type,
    description    text NOT NULL DEFAULT '',
    started_on     date NOT NULL,
    ended_on       date,
    is_current     boolean NOT NULL DEFAULT false,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX candidate_experience_owner_idx
    ON candidate_experience (account_id, started_on DESC, id DESC);

CREATE TABLE candidate_education (
    id             text PRIMARY KEY,
    candidate_id   text NOT NULL REFERENCES candidate_profiles (id) ON DELETE CASCADE,
    account_id     text NOT NULL,
    institution    text NOT NULL,
    qualification  text NOT NULL,
    field_of_study text NOT NULL DEFAULT '',
    grade          text NOT NULL DEFAULT '',
    started_on     date,
    ended_on       date,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX candidate_education_owner_idx
    ON candidate_education (account_id, created_at DESC, id DESC);

CREATE TABLE candidate_certifications (
    id             text PRIMARY KEY,
    candidate_id   text NOT NULL REFERENCES candidate_profiles (id) ON DELETE CASCADE,
    account_id     text NOT NULL,
    name           text NOT NULL,
    issuer         text NOT NULL DEFAULT '',
    credential_id  text NOT NULL DEFAULT '',
    credential_url text NOT NULL DEFAULT '',
    issued_on      date,
    expires_on     date,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX candidate_certifications_owner_idx
    ON candidate_certifications (account_id, created_at DESC, id DESC);

-- ---------------------------------------------------------------------------
-- Resumes
-- ---------------------------------------------------------------------------
-- Only the object metadata lives here. The bytes go straight from the browser to
-- object storage under a presigned PUT; this service never sees them.
CREATE TABLE candidate_resumes (
    id             text PRIMARY KEY,
    candidate_id   text NOT NULL REFERENCES candidate_profiles (id) ON DELETE CASCADE,
    account_id     text NOT NULL,
    object_key     text NOT NULL,
    filename       text NOT NULL,
    content_type   text NOT NULL,
    size_bytes     bigint NOT NULL,
    is_primary     boolean NOT NULL DEFAULT false,
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX candidate_resumes_object_key_idx ON candidate_resumes (object_key);
CREATE INDEX candidate_resumes_owner_idx ON candidate_resumes (account_id, created_at DESC, id DESC);

-- "Exactly one primary" is a schema fact rather than a convention a handler
-- might forget: a second primary for the same candidate cannot be inserted.
CREATE UNIQUE INDEX candidate_resumes_primary_idx
    ON candidate_resumes (candidate_id) WHERE is_primary;

-- ---------------------------------------------------------------------------
-- The company's own talent pool
-- ---------------------------------------------------------------------------
CREATE TABLE company_candidates (
    id                text PRIMARY KEY,
    company_id        uuid NOT NULL,
    full_name         text NOT NULL,
    email             text NOT NULL DEFAULT '',
    phone             text NOT NULL DEFAULT '',
    headline          text NOT NULL DEFAULT '',
    location          text NOT NULL DEFAULT '',
    source            candidate_source NOT NULL DEFAULT 'sourced',
    current_title     text NOT NULL DEFAULT '',
    current_employer  text NOT NULL DEFAULT '',
    years_experience  integer NOT NULL DEFAULT 0,
    skills            text[] NOT NULL DEFAULT '{}',
    tags              text[] NOT NULL DEFAULT '{}',
    notes             text NOT NULL DEFAULT '',

    -- A pool record may point at a platform profile (the candidate was found
    -- through talent search) but never joins to it: the pool row is the
    -- company's own data and must stay readable if the profile is deleted.
    linked_profile_id text,

    resume_object_key text NOT NULL DEFAULT '',
    resume_filename   text NOT NULL DEFAULT '',
    resume_content_type text NOT NULL DEFAULT '',
    resume_size_bytes bigint NOT NULL DEFAULT 0,

    created_by        text NOT NULL DEFAULT '',
    deleted_at        timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX company_candidates_tenant_idx
    ON company_candidates (company_id, created_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX company_candidates_email_idx ON company_candidates (company_id, lower(email));
CREATE INDEX company_candidates_skills_idx ON company_candidates USING gin (skills);

-- ---------------------------------------------------------------------------
-- Approaches
-- ---------------------------------------------------------------------------
-- A recorded approach is what turns talent search from a directory into an
-- auditable action: the candidate can be told who contacted them, and the
-- per-company-per-candidate window below is enforced against this table rather
-- than against a cache, so a Redis outage cannot open a spam channel.
CREATE TABLE candidate_approaches (
    id               text PRIMARY KEY,
    candidate_id     text NOT NULL REFERENCES candidate_profiles (id) ON DELETE CASCADE,
    company_id       uuid NOT NULL,
    actor_account_id text NOT NULL DEFAULT '',
    job_id           text,
    subject          text NOT NULL DEFAULT '',
    message          text NOT NULL,
    created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX candidate_approaches_tenant_idx
    ON candidate_approaches (company_id, created_at DESC, id DESC);
CREATE INDEX candidate_approaches_window_idx
    ON candidate_approaches (company_id, candidate_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER candidate_profiles_touch BEFORE UPDATE ON candidate_profiles
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER candidate_experience_touch BEFORE UPDATE ON candidate_experience
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER candidate_education_touch BEFORE UPDATE ON candidate_education
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER candidate_certifications_touch BEFORE UPDATE ON candidate_certifications
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER company_candidates_touch BEFORE UPDATE ON company_candidates
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
