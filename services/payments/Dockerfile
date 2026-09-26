# syntax=docker/dockerfile:1

# Payments service image.
#
# Built from the REPO ROOT, because the service depends on a workspace package:
#
#   docker build -f services/payments/Dockerfile -t reqruitbook/payments:dev .

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS build

RUN corepack enable

WORKDIR /src

# The workspace manifests come first so a dependency-free code change reuses the
# install layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/nestshared/package.json ./packages/nestshared/
COPY services/payments/package.json ./services/payments/

RUN --mount=type=cache,target=/pnpm-store \
    pnpm config set store-dir /pnpm-store && \
    pnpm install --frozen-lockfile --filter @reqruitbook/payments...

COPY packages/nestshared ./packages/nestshared
COPY services/payments ./services/payments

# confirmModulesPurge=false: dropping to --prod makes pnpm remove and rebuild
# node_modules, and it refuses to do that unprompted without a TTY — which a
# Docker build never has. Without this the image simply cannot be built.
RUN pnpm --filter @reqruitbook/nestshared build && \
    pnpm --filter @reqruitbook/payments build && \
    pnpm install --prod --frozen-lockfile --filter @reqruitbook/payments... \
      --config.confirmModulesPurge=false

FROM node:${NODE_VERSION}-alpine

RUN apk add --no-cache tini \
    && addgroup -S app && adduser -S -G app -u 10001 app

WORKDIR /app

COPY --from=build /src/node_modules /app/node_modules
COPY --from=build /src/packages/nestshared /app/packages/nestshared
COPY --from=build /src/services/payments/node_modules /app/services/payments/node_modules
COPY --from=build /src/services/payments/dist /app/services/payments/dist
# Migrations are read from disk at boot, not compiled in.
COPY --from=build /src/services/payments/migrations /app/services/payments/migrations
COPY --from=build /src/services/payments/package.json /app/services/payments/package.json

WORKDIR /app/services/payments

# Must match PAYMENTS_HTTP_PORT in the environment: this only drives EXPOSE and
# the healthcheck, the process reads its port from that variable.
ENV PORT=8084
ENV NODE_ENV=production

USER app:app

EXPOSE 8084

HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=5 \
  CMD wget --quiet --spider "http://127.0.0.1:${PORT}/healthz" || exit 1

ENTRYPOINT ["/sbin/tini", "--", "node", "dist/main"]
