import { NextResponse } from "next/server";

import { gatewayFetch, unreachableProblem } from "@/lib/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The browser's door to the gateway.
 *
 * A browser cannot call the gateway directly: it would send
 * `Host: localhost:8080` in development and `Origin: https://root...` in
 * production, and the gateway routes platform endpoints by Host. This handler
 * is a transport shim and nothing more — it adds the portal's Host header and
 * forwards the response verbatim, problem documents included, so ProblemError
 * on the client sees exactly what the service wrote.
 *
 * What it deliberately does NOT do:
 *
 *  - It does not authenticate. The Authorization header comes from the
 *    ApiClient's in-memory access token and is forwarded as given. The session
 *    cookies are never read here, which is what keeps this from being a
 *    confused deputy: a cross-site POST that rides the operator's cookies
 *    carries no bearer token, so it reaches the gateway unauthenticated.
 *  - It does not decide anything about permissions. The gateway verifies the
 *    token, resolves the portal, and each service re-checks the permission.
 *
 * Only /api/v1/** is reachable, so this cannot be pointed at /healthz, an
 * internal endpoint, or anything else the gateway happens to expose.
 */

const ALLOWED_METHODS = new Set(["GET", "POST", "PATCH", "PUT", "DELETE"]);

async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  if (!ALLOWED_METHODS.has(request.method)) {
    return problem(405, "method_not_allowed", "That method is not supported here.");
  }

  const { path } = await context.params;
  const segments = (path ?? []).filter((segment) => segment !== "" && segment !== "..");
  const upstreamPath = `/api/v1/${segments.map(encodeURIComponent).join("/")}`;

  if (segments.length === 0) {
    return problem(404, "not_found", "That API path does not exist.");
  }

  const search = new URL(request.url).search;

  let body: string | undefined;
  if (request.method !== "GET" && request.method !== "DELETE") {
    const raw = await request.text();
    body = raw === "" ? undefined : raw;
  }

  let upstream;
  try {
    upstream = await gatewayFetch({
      method: request.method,
      path: upstreamPath + search,
      ...(body !== undefined ? { body } : {}),
      headers: forwardable(request.headers),
    });
  } catch {
    upstream = unreachableProblem(upstreamPath);
  }

  // Pass the body through untouched. An audit CSV export is text/csv with a
  // Content-Disposition the browser needs, and re-encoding it as JSON would
  // quietly break the one endpoint whose body is not JSON.
  const headers = new Headers(upstream.headers);
  headers.delete("set-cookie");

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}

/** Headers worth forwarding. Everything else is transport or trust. */
function forwardable(incoming: Headers): Headers {
  const forwarded = new Headers();
  for (const name of [
    "authorization",
    "content-type",
    "accept",
    "idempotency-key",
    "user-agent",
    "x-forwarded-for",
    "x-real-ip",
  ]) {
    const value = incoming.get(name);
    if (value) forwarded.set(name, value);
  }
  return forwarded;
}

function problem(status: number, code: string, detail: string): NextResponse {
  return NextResponse.json(
    { type: "about:blank", title: "Error", status, detail, code },
    { status, headers: { "content-type": "application/problem+json" } },
  );
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
