import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { ConsoleShell } from "@/components/console/shell";
import { SessionProvider } from "@/lib/session-provider";
import { readIdentity } from "@/lib/session";

// Every console route reads cookies, so none of it can be statically rendered.
export const dynamic = "force-dynamic";

/**
 * The route guard for everything under the console.
 *
 * `readIdentity` returns null unless the cookie describes a *platform*
 * principal, so a company or candidate session cannot get past sign-in here
 * even if one somehow arrived. That is a courtesy, not the boundary: the
 * gateway refuses every /api/v1/admin, /plans, /subscriptions, /payments and
 * /platform route to anything but a platform principal on root.{hostname}, so
 * a bypass of this check yields a console full of 404s rather than data.
 */
export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const identity = await readIdentity();

  if (!identity) {
    redirect("/login");
  }

  return (
    <SessionProvider initialIdentity={identity}>
      <ConsoleShell identity={identity}>{children}</ConsoleShell>
    </SessionProvider>
  );
}
