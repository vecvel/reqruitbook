"use server";

import { revalidatePath } from "next/cache";

import { gatewayFetch, gatewayRead } from "@/lib/gateway/client";
import { unwrap } from "@/lib/gateway/list";
import { unavailable } from "@/lib/gateway/unavailable";
import { requirePermission } from "@/lib/rbac/guard";

/**
 * The company's recruiters, served by the identity service.
 *
 * Identity holds the memberships and resolves each person's permissions the same
 * way it resolves them into a token, so this screen and a signed-in session can
 * never disagree about what somebody may do.
 *
 * Every rule that decides who may change whose access — delegation, the
 * self-modification refusal, the last-owner and last-administrator guards — is
 * enforced there, not here. This module is the shape the screens were written
 * against, over the platform's data.
 */

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  roleIds: string[];
  roleNames: string[];
  primaryRoleId: string | null;
  isSuperAdmin: boolean;
  departmentId: string | null;
  departmentName: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  /** Platform permission keys, for the screens that apply the delegation rule. */
  permissions: string[];
  isOwner: boolean;
  jobTitle: string;
}

/** What the identity service returns for a member. */
interface PlatformMember {
  accountId: string;
  membershipId: string;
  email: string;
  fullName: string;
  jobTitle?: string;
  isOwner: boolean;
  status: string;
  accountStatus: string;
  roleIds: string[];
  roles: string[];
  roleNames: string[];
  primaryRoleId?: string;
  permissions: string[];
  isSuperAdmin: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

function toUserRecord(member: PlatformMember): UserRecord {
  return {
    id: member.accountId,
    name: member.fullName,
    email: member.email,
    role: member.roleNames[0] ?? member.roles[0] ?? "",
    roleIds: member.roleIds ?? [],
    roleNames: member.roleNames ?? [],
    primaryRoleId: member.primaryRoleId || null,
    isSuperAdmin: member.isSuperAdmin,
    // Departments are free text on a requisition rather than a record, so there
    // is nothing to attach a person to.
    departmentId: null,
    departmentName: null,
    isActive: member.status === "active",
    lastLoginAt: member.lastLoginAt ? new Date(member.lastLoginAt) : null,
    createdAt: new Date(member.createdAt),
    permissions: member.permissions ?? [],
    isOwner: member.isOwner,
    jobTitle: member.jobTitle ?? "",
  };
}

export async function getUsers(): Promise<UserRecord[]> {
  await requirePermission("users.read");

  return gatewayRead(async () => {
    const payload = await gatewayFetch<unknown>("/api/v1/recruiters");
    return unwrap<PlatformMember>(payload, "recruiters").map(toUserRecord);
  }, []);
}

function revalidateSettings() {
  revalidatePath("/settings");
}

/**
 * Adds someone to the company.
 *
 * Not an invitation: the platform sends no email, so the administrator sets an
 * initial password and passes it on themselves. An address that already has a
 * company login on the platform is attached to this tenant keeping the password
 * it already has, and the result says which of the two happened.
 */
export async function createUser(data: {
  name: string;
  email: string;
  password?: string;
  roleIds?: string[];
  primaryRoleId?: string | null;
  departmentId?: string | null;
  jobTitle?: string;
}) {
  await requirePermission("users.create");

  const result = await gatewayFetch<{
    member: PlatformMember;
    accountCreated: boolean;
    reactivated: boolean;
  }>("/api/v1/recruiters", {
    method: "POST",
    body: {
      email: data.email,
      fullName: data.name,
      ...(data.password ? { password: data.password } : {}),
      ...(data.jobTitle ? { jobTitle: data.jobTitle } : {}),
      roleIds: data.roleIds ?? [],
      ...(data.primaryRoleId ? { primaryRoleId: data.primaryRoleId } : {}),
    },
  });

  revalidateSettings();
  return {
    success: true as const,
    user: toUserRecord(result.member),
    accountCreated: result.accountCreated,
    reactivated: result.reactivated,
  };
}

/**
 * Changes what this company says about one of its members: the job title.
 *
 * Neither the name nor the email is forwarded, and identity refuses both for the
 * same reason — they belong to the account, which is shared by every company
 * that person recruits for. Sending a name from here renamed them inside other
 * tenants, through a screen that looks entirely local.
 */
export async function updateUser(
  userId: string,
  data: { name?: string; email?: string; departmentId?: string | null; jobTitle?: string },
) {
  await requirePermission("users.update");

  await gatewayFetch(`/api/v1/recruiters/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: {
      ...(data.jobTitle !== undefined ? { jobTitle: data.jobTitle } : {}),
    },
  });

  revalidateSettings();
  return {
    success: true as const,
    // Said plainly rather than silently dropped, so a caller that passed a name
    // does not believe it was applied.
    ignored: data.name !== undefined || data.email !== undefined
      ? "A person's name and email belong to their account and are changed there, not by their company."
      : undefined,
  };
}

export async function updateUserRoles(
  userId: string,
  roleIds: string[],
  primaryRoleId?: string | null,
) {
  await requirePermission("users.assign_roles");

  await gatewayFetch(`/api/v1/recruiters/${encodeURIComponent(userId)}/roles`, {
    method: "PUT",
    body: {
      roleIds,
      ...(primaryRoleId ? { primaryRoleId } : {}),
    },
  });

  revalidateSettings();
  return { success: true as const };
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  await requirePermission("users.manage_status");

  await gatewayFetch(`/api/v1/recruiters/${encodeURIComponent(userId)}/status`, {
    method: "PATCH",
    body: { active: isActive },
  });

  revalidateSettings();
  return { success: true as const };
}

/**
 * Removing somebody ends their membership; the login itself survives.
 *
 * It may be the account they use at another company on the platform, and
 * deleting it here would take that access with it.
 */
export async function deleteUser(userId: string) {
  await requirePermission("users.delete");

  await gatewayFetch(`/api/v1/recruiters/${encodeURIComponent(userId)}`, { method: "DELETE" });

  revalidateSettings();
  return { success: true as const };
}

/**
 * Setting another person's password is deliberately not served.
 *
 * Identity owns credentials and exposes no endpoint for one member to overwrite
 * another's, and it should not: it is a complete account takeover carried out
 * with a permission that otherwise only edits a job title. The honest answer is
 * that the person resets their own password.
 *
 * Tracked in lib/gateway/unavailable.ts as "password-reset".
 */
export async function resetUserPassword(_userId: string, _newPassword: string) {
  await requirePermission("users.update");
  const feature = unavailable("password-reset");
  return { success: false as const, unavailable: feature, error: feature.blockedOn };
}
