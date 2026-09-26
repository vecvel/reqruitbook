# syntax=docker/dockerfile:1

# Identity service image.
#
# Built from the REPO ROOT, because the module lives there:
#
#   docker build -f services/identity/Dockerfile -t reqruitbook/identity:dev .
#
# This is deploy/Dockerfile.go-service with the arguments baked in. Changes to
# the build recipe belong in both.

ARG GO_VERSION=1.26
ARG ALPINE_VERSION=3.22

FROM golang:${GO_VERSION}-alpine AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY packages ./packages
COPY services ./services

# The migrate binary ships alongside the server so a deployment can apply the
# schema as its own step; the server also migrates at boot for local runs.
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' \
      -o /out/server ./services/identity/cmd/server && \
    CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' \
      -o /out/migrate ./services/identity/cmd/migrate

FROM alpine:${ALPINE_VERSION}

RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S app && adduser -S -G app -u 10001 app

COPY --from=build /out/ /usr/local/bin/

# Must match IDENTITY_HTTP_PORT in the environment: this only drives EXPOSE and
# the healthcheck, the process reads its port from that variable.
ENV PORT=8081

USER app:app

EXPOSE 8081

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=5 \
  CMD wget --quiet --spider "http://127.0.0.1:${PORT}/healthz" || exit 1

ENTRYPOINT ["/usr/local/bin/server"]
