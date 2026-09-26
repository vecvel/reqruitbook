# syntax=docker/dockerfile:1

# API gateway image.
#
# Built from the REPO ROOT, because the module lives there:
#
#   docker build -f services/gateway/Dockerfile -t reqruitbook/gateway:dev .
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

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' \
      -o /out/server ./services/gateway/cmd/server

FROM alpine:${ALPINE_VERSION}

RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S app && adduser -S -G app -u 10001 app

COPY --from=build /out/server /usr/local/bin/server

# Must match GATEWAY_HTTP_PORT in the environment: this only drives EXPOSE and
# the healthcheck, the process reads its port from that variable.
ENV PORT=8080

USER app:app

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=5 \
  CMD wget --quiet --spider "http://127.0.0.1:${PORT}/healthz" || exit 1

ENTRYPOINT ["/usr/local/bin/server"]
