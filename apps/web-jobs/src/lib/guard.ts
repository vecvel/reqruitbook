import "server-only";

import { redirect } from "next/navigation";

import { readIdentity, type Identity } from "./session";

/**
 * The route guard every signed-in page starts with.
 *
 * It decides what to render, not what is allowed: the gateway verifies the
 * token and each service re-checks the permission and the principal on every
 * call. Deleting this would make the app worse — a signed-out visitor would
 * land on a page that loads, flickers and then fails — but it would not make
 * anything reachable that is not reachable now.
 */
export async function requireIdentity(returnTo: string): Promise<Identity> {
  const identity = await readIdentity();
  if (!identity) {
    redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  }
  return identity;
}
