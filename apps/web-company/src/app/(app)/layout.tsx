import { AppShell } from "@/features/shell/components/app-shell";
import { AccessProvider } from "@/components/rbac/access-provider";
import { buildNavigation } from "@/lib/rbac/navigation";
import { getActor } from "@/lib/rbac/guard";
import { toAccessSnapshot } from "@/features/auth/server/session";
import { getNavigationBadgeCounts } from "@/features/shell/server/badges";
import { getSystemNotifications } from "@/features/shell/server/notifications";
import { getDepartments } from "@/features/masters/server/actions";
import { redirect } from "next/navigation";

/**
 * Every authenticated route resolves the actor from the session cookie, so this
 * segment is always rendered per request rather than prerendered at build time.
 */
export const dynamic = "force-dynamic";

/**
 * Authenticated shell.
 *
 * Resolves the actor once per request, derives the navigation from the feature
 * registry against that actor's permissions, and hands the same snapshot to the
 * client so UI checks and server checks share one source of truth.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const [badges, notifications, departmentRows] = await Promise.all([
    getNavigationBadgeCounts(),
    getSystemNotifications(),
    // The header's department filter is itself gated by the departments feature.
    actor.access.can("departments.read") ? getDepartments() : Promise.resolve([]),
  ]);

  const departments = [
    { id: "dept_all", name: "All Departments", code: "ALL", location: "Global" },
    ...departmentRows.map((d: any) => ({
      id: d.id,
      name: d.name,
      code: d.code,
      location: d.leadName || "Office",
    })),
  ];

  const navigation = buildNavigation(actor.access, badges);
  const snapshot = toAccessSnapshot(actor.user);

  const accessUser = {
    id: actor.user.id,
    orgId: actor.user.orgId,
    name: actor.user.name,
    email: actor.user.email,
    role: actor.user.role,
    roleLabel: actor.user.roleLabel,
    roleSlugs: actor.user.roleSlugs,
    roleNames: actor.user.roleNames,
    departmentId: actor.user.departmentId,
    avatarUrl: actor.user.avatarUrl,
    organizationName: actor.user.organizationName,
  };

  return (
    <AccessProvider user={accessUser} snapshot={snapshot}>
      <AppShell
        organizationName={actor.user.organizationName}
        navigation={navigation}
        departments={departmentRows.length > 0 ? departments : []}
        activeDepartmentId="dept_all"
        user={{
          id: accessUser.id,
          name: accessUser.name,
          email: accessUser.email,
          roleLabel: actor.user.roleNames.join(", ") || actor.user.roleLabel,
        }}
        unreadCount={notifications.unreadCount}
      >
        {children}
      </AppShell>
    </AccessProvider>
  );
}
