"use server";

import { gatewayFetch, gatewayRead } from "@/lib/gateway/client";
import { getActor } from "@/lib/rbac/guard";

export interface SystemNotification {
  id: string;
  type: "application" | "interview" | "scorecard" | "offer" | "communication" | "system";
  title: string;
  message: string;
  timestamp: string;
  timeAgo: string;
  read: boolean;
  priority: "high" | "medium" | "low";
  href: string;
  actionLabel: string;
}

/** What the notifications service returns. */
interface PlatformNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: string;
  payload?: Record<string, unknown>;
}

function formatTimeAgo(date: Date): string {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Maps a platform notification type onto the categories this header renders.
 *
 * The service names events after the domain fact (`application.submitted`),
 * while the header groups them by the icon it draws. Unknown types fall through
 * to "system" rather than being dropped — a notification nobody categorised is
 * still one the user should see.
 */
function categorise(type: string): SystemNotification["type"] {
  if (type.startsWith("application")) return "application";
  if (type.startsWith("interview")) return "interview";
  if (type.startsWith("offer")) return "offer";
  if (type.startsWith("message") || type.startsWith("candidate.approached")) return "communication";
  return "system";
}

function priorityOf(type: string): SystemNotification["priority"] {
  // A rejection or an expiring subscription needs attention today; a new
  // application can wait for the next time someone opens the pipeline.
  if (type.includes("rejected") || type.includes("expired") || type.includes("failed")) return "high";
  if (type.startsWith("application") || type.startsWith("message")) return "medium";
  return "low";
}

function actionLabelFor(category: SystemNotification["type"]): string {
  switch (category) {
    case "application":
      return "View application";
    case "interview":
      return "View interview";
    case "offer":
      return "View offer";
    case "communication":
      return "Open conversation";
    default:
      return "View";
  }
}

function toSystemNotification(notification: PlatformNotification): SystemNotification {
  const created = new Date(notification.createdAt);
  const category = categorise(notification.type);

  return {
    id: notification.id,
    type: category,
    title: notification.title,
    message: notification.body,
    timestamp: notification.createdAt,
    timeAgo: formatTimeAgo(created),
    read: notification.read,
    priority: priorityOf(notification.type),
    href: notification.link || "/dashboard",
    actionLabel: actionLabelFor(category),
  };
}

/**
 * Header notification feed.
 *
 * The notifications service already addresses each row to one recipient and
 * filters by the principal, so this no longer assembles a feed by querying
 * every module the actor can read — it asks for the actor's own inbox.
 */
export async function getSystemNotifications(): Promise<{
  notifications: SystemNotification[];
  unreadCount: number;
}> {
  const actor = await getActor();
  if (!actor) return { notifications: [], unreadCount: 0 };

  // The header renders on every page. A notifications outage must cost the
  // bell its contents, not the whole application shell.
  const payload = await gatewayRead(
    () =>
      gatewayFetch<{ data?: PlatformNotification[]; items?: PlatformNotification[] }>(
        "/api/v1/notifications",
        { query: { limit: 30 } },
      ),
    {},
  );

  const rows = payload.data ?? payload.items ?? [];
  const notifications = rows.map(toSystemNotification);

  return {
    notifications,
    unreadCount: notifications.filter((notification) => !notification.read).length,
  };
}

export async function markNotificationAsRead(notificationId: string) {
  await gatewayFetch(`/api/v1/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: "POST",
  });
  return { success: true };
}

export async function markAllNotificationsAsRead(_notificationIds: string[]) {
  // The service marks the caller's whole inbox; the id list the old local
  // implementation needed is no longer meaningful, and passing it would invite
  // a caller to believe they can mark somebody else's notifications read.
  await gatewayFetch("/api/v1/notifications/read-all", { method: "POST" });
  return { success: true };
}
