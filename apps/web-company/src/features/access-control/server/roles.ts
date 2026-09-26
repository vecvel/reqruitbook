"use server";

import { revalidatePath } from "next/cache";

import { gatewayFetch, gatewayRead } from "@/lib/gateway/client";
import { unwrap } from "@/lib/gateway/list";
import { requirePermission } from "@/lib/rbac/guard";

/**
 * A company's roles, served by the identity service.
 *
 * The permission keys here are the platform's, not this app's — identity owns
 * the catalogue, issues the tokens, and re-checks every key on every call. The
 * role editor renders `lib/rbac/catalogue.ts` for the same reason, so what a
 * checkbox says and what a token will carry are the same string.
 *
 * The delegation, self-modification and last-administrator rules are enforced by
 * identity (`services/identity/internal/team/guards.go`), which is where they
 * belong: a guard in this file only ever protected this app's path to the data.
 * The screens still apply them for display, so a button that would be refused is
 * not offered — but the refusal is the service's.
 */

export interface RoleRecord {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  description: string | null;
  badge: string | null;
  permissions: string[];
  isSuperAdmin: boolean;
  isSystem: boolean;
  userCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** What the identity service returns for a role. */
interface PlatformRole {
  id: string;
  slug: string;
  name: string;
  description: string;
  badge: string;
  permissions: string[];
  isSuperAdmin: boolean;
  isSystem: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

function toRoleRecord(role: PlatformRole, orgId: string): RoleRecord {
  return {
    id: role.id,
    orgId,
    name: role.name,
    slug: role.slug,
    description: role.description || null,
    badge: role.badge || null,
    permissions: role.permissions ?? [],
    isSuperAdmin: role.isSuperAdmin,
    isSystem: role.isSystem,
    userCount: role.memberCount,
    createdAt: new Date(role.createdAt),
    updatedAt: new Date(role.updatedAt),
  };
}

export async function getRoles(): Promise<RoleRecord[]> {
  const { user } = await requirePermission("roles.read");

  return gatewayRead(async () => {
    const payload = await gatewayFetch<unknown>("/api/v1/company-roles");
    return unwrap<PlatformRole>(payload, "roles").map((role) => toRoleRecord(role, user.orgId));
  }, []);
}

/**
 * The roles this actor may hand to somebody else.
 *
 * Identity refuses an assignment that would grant more than the actor holds, so
 * filtering here only keeps the picker from offering a choice that would be
 * rejected on save. The list is the same either way; the difference is whether
 * the user learns about the rule before or after clicking.
 */
export async function getAssignableRoles(): Promise<RoleRecord[]> {
  const { user, access } = await requirePermission("roles.read");
  const roles = await getRoles();

  if (access.isSuperAdmin) return roles;

  const held = new Set(user.platformPermissions);
  return roles.filter(
    (role) => !role.isSuperAdmin && role.permissions.every((key) => held.has(key)),
  );
}

function revalidateSettings() {
  revalidatePath("/settings");
}

export async function createRole(data: {
  name: string;
  slug?: string;
  description?: string;
  badge?: string;
  permissions?: string[];
}) {
  await requirePermission("roles.create");

  const role = await gatewayFetch<PlatformRole>("/api/v1/company-roles", {
    method: "POST",
    body: {
      name: data.name,
      ...(data.slug ? { slug: data.slug } : {}),
      ...(data.description ? { description: data.description } : {}),
      ...(data.badge ? { badge: data.badge } : {}),
      permissions: data.permissions ?? [],
    },
  });

  revalidateSettings();
  return { success: true as const, id: role.id };
}

export async function updateRole(
  id: string,
  data: { name?: string; description?: string; badge?: string; permissions?: string[] },
) {
  await requirePermission("roles.update");

  // Only the fields the caller actually sent are forwarded: identity leaves an
  // omitted field alone, and sending `undefined` as `null` would clear a
  // description the editor never showed.
  await gatewayFetch(`/api/v1/company-roles/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.badge !== undefined ? { badge: data.badge } : {}),
      ...(data.permissions !== undefined ? { permissions: data.permissions } : {}),
    },
  });

  revalidateSettings();
  return { success: true as const };
}

/**
 * One cell of the permission matrix.
 *
 * Identity replaces a role's whole permission list rather than patching one key,
 * so the new list is computed from what the role holds now. Two administrators
 * toggling different cells at the same time therefore means last-write-wins on
 * the whole row — acceptable for a screen one person uses at a time, and the
 * alternative is a per-permission endpoint that would need its own delegation
 * check for a single key.
 */
export async function toggleRolePermission(id: string, permission: string, granted: boolean) {
  await requirePermission("roles.assign_permissions");

  const roles = await getRoles();
  const role = roles.find((candidate) => candidate.id === id);
  if (!role) {
    throw new Error("That role no longer exists.");
  }

  const next = granted
    ? [...new Set([...role.permissions, permission])]
    : role.permissions.filter((key) => key !== permission);

  await gatewayFetch(`/api/v1/company-roles/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { permissions: next },
  });

  revalidateSettings();
  return { success: true as const };
}

export async function deleteRole(id: string) {
  await requirePermission("roles.delete");

  await gatewayFetch(`/api/v1/company-roles/${encodeURIComponent(id)}`, { method: "DELETE" });

  revalidateSettings();
  return { success: true as const };
}
