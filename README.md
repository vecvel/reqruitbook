# ReqruitBook

A multi-tenant recruitment platform. Companies get isolated careers portals,
candidates get one central job portal, and the platform is operated from a
separate administration console.

## Layout

```
apps/
  web-company/      Company careers portal (Next.js)
services/
  gateway/          API gateway — host routing, tenancy, token verification (Go)
  identity/         Accounts, sessions, roles, permissions (Go)
  jobs/             Requisitions, dual visibility, custom application forms (Go)
  applications/     Pipeline, dynamic stages, one-application-per-job (Go)
  candidates/       Profiles, resumes, discoverability, talent search (Go)
  messaging/        Recruiter ↔ candidate conversations (Go)
  notifications/    In-app, SSE stream, email fan-out (Go)
  companies/        Registration, profile, careers portal settings (NestJS)
  subscriptions/    Plans, subscriptions, entitlements (NestJS)
  payments/         Provider-agnostic billing, invoices, webhooks (NestJS)
  support/          Support tickets, company and platform sides (NestJS)
  admin/            Root console aggregation over projections (NestJS)
packages/
  goshared/         Shared Go platform library
  nestshared/       Shared TypeScript platform library (the NestJS counterpart)
scripts/            dev.sh (run the stack), smoke.sh (boundary tests)
deploy/             Infrastructure and local orchestration
docs/               Architecture, service contract, and RBAC documentation
```

Both shared libraries expose the same concepts — problem+json, the gateway
principal, the permission guard, cursor pagination, the migration runner, the
event envelope — so a service behaves the same way whichever runtime it is
written in.

## Getting started

Requires Go 1.26+, Node 20+, pnpm, and Docker.

```bash
make setup      # signing keys, .env, and the infrastructure containers
make dev        # infrastructure, every service, and the web app
```

`make dev` discovers every service in the tree, builds it, and waits for its
readiness endpoint before starting the next. Three behaviours are deliberate:

- **A service that does not compile or start is skipped, loudly, by name.** One
  service still being written then costs you its own routes — which answer 502,
  exactly as a deployed-but-down service would — instead of the whole platform.
- **A port held by something `dev.sh` did not start is left alone**, and that
  service is skipped. Killing an unknown process would be worse than not
  starting one.
- **`make dev-down` sweeps those ports anyway.** Stopping is explicit intent, so
  it clears stale listeners a crash or a hand-started process left behind.
  Without that sweep the skip above quietly leaves an *old binary* serving while
  a fresh `make dev` reports success — a confusing way to lose an afternoon.

```bash
make status        # what is running, and on which port
make smoke-all     # both test suites against the running stack
make dev-down      # stop the services (infrastructure keeps running)
```

Two suites run against the live stack:

| | |
| --- | --- |
| `make smoke` | Security boundaries: cross-tenant tokens, header spoofing, portal isolation, credential enumeration, refresh replay |
| `make smoke-product` | The product: post a job, publish it, apply, advance the pipeline, reject, talent discovery |

Migrations run automatically at service boot, so `make migrate` is only needed
to apply them without starting anything.

To run the services by hand instead, in separate terminals:

```bash
make run-identity   # :8081
make run-gateway    # :8080
```

### First sign-in

`make setup` writes bootstrap credentials into `.env`. The identity service
creates that administrator on first boot and logs a warning; sign in, change the
password, then remove the `BOOTSTRAP_ADMIN_*` lines.

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -H 'Host: root.reqruitbook.local' \
  -d '{"realm":"platform","email":"admin@reqruitbook.local","password":"..."}'
```

### Local hostnames

Portals are routed by hostname. For browser testing, add them to `/etc/hosts`:

```
127.0.0.1  reqruitbook.local root.reqruitbook.local jobs.reqruitbook.local acme.reqruitbook.local
```

With `curl`, a `Host:` header is enough.

## Commands

| Command | Description |
| --- | --- |
| `make setup` | Keys, `.env`, and infrastructure |
| `make dev` / `make dev-down` | Start or stop the whole stack |
| `make status` | Show what is running |
| `make smoke` / `make smoke-product` / `make smoke-all` | Test suites against a running stack |
| `make infra` / `make infra-down` | Start or stop the containers |
| `make infra-reset` | Destroy the volumes and start clean |
| `make migrate` | Apply database migrations |
| `make build` / `make test` | Build and test the Go services |
| `make run-gateway` / `make run-identity` | Run a single service |

## Local services

| Service | Address |
| --- | --- |
| Gateway | http://localhost:8080 |
| Identity | http://localhost:8081 |
| Postgres | localhost:5432 |
| Redis | localhost:6379 |
| NATS | localhost:4222 (monitor :8222) |
| MinIO | http://localhost:9001 |
| Mailpit | http://localhost:8025 |
| Jaeger | http://localhost:16686 |

## Documentation

- [Platform architecture](docs/architecture.md) — services, tenancy, request path, security
- [Service contract](docs/contracts.md) — what every service must do to compose with the platform
- [Feature-based RBAC](docs/rbac.md) — the permission model used by the company portal
