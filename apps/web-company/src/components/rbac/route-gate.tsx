import { redirect } from "next/navigation";

import { checkRouteAccess } from "@/lib/rbac/guard";
import { AccessDenied } from "./access-denied";

/**
 * Server-side page guard.
 *
 * Wraps a route's content so the permission decision happens before the feature
 * renders, and a refusal produces a proper "access denied" screen rather than an
 * error page. The `path` is matched against the route rules the features
 * declare, so a route's requirements live with the feature that owns it.
 */
export async function RouteGate({
  path,
  children,
}: {
  path: string;
  children: React.ReactNode;
}) {
  const decision = await checkRouteAccess(path);

  if (decision.allowed) return <>{children}</>;

  if (decision.reason === "unauthenticated") {
    redirect(`/login?redirect=${encodeURIComponent(path)}`);
  }

  if (decision.reason === "feature-disabled") {
    return (
      <AccessDenied
        errorCode="403"
        title="Module Disabled"
        description={`The ${decision.featureName} module has been switched off for your organization. Contact your Super Admin to re-enable it.`}
      />
    );
  }

  return (
    <AccessDenied
      errorCode="403"
      title="Access Denied"
      description="You do not have permission to view or access this section."
    />
  );
}
