"use client";

import Link from "next/link";
import { BellOff, Radio } from "lucide-react";

import { EmptyState, ListSkeleton } from "@/components/feedback";
import { useNotifications } from "@/components/notifications/use-notifications";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export function NotificationsList() {
  const { notifications, unreadCount, loading, error, live, markRead, markAllRead } =
    useNotifications(true);

  if (loading) return <ListSkeleton rows={4} />;

  if (error) {
    return (
      <div role="alert" className="surface border-destructive/30 bg-destructive/10 p-4 text-sm">
        {error}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={BellOff}
        title="Nothing to catch up on"
        description="When a company moves your application forward or sends you a message, it shows up here."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {unreadCount > 0
            ? `${unreadCount} unread`
            : "You are up to date"}
          {live ? (
            <span className="ml-2 inline-flex items-center gap-1 text-xs">
              <Radio aria-hidden="true" className="size-3 text-success" />
              live
            </span>
          ) : null}
        </p>
        {unreadCount > 0 ? (
          <Button variant="outline" size="sm" onClick={() => void markAllRead()}>
            Mark all as read
          </Button>
        ) : null}
      </div>

      <ul className="space-y-2">
        {notifications.map((notification) => (
          <li
            key={notification.id}
            className={cn(
              "surface flex items-start gap-3 p-4",
              notification.read ? "" : "border-accent/40 bg-accent/5",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "mt-1.5 size-2 shrink-0 rounded-full",
                notification.read ? "bg-border" : "bg-accent",
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{notification.title}</p>
              {notification.body ? (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {notification.body}
                </p>
              ) : null}
              <p className="mt-1.5 text-xs text-muted-foreground">
                <time dateTime={notification.createdAt} title={formatDateTime(notification.createdAt)}>
                  {formatRelative(notification.createdAt)}
                </time>
                {notification.read ? "" : " · unread"}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {notification.link ? (
                <Button asChild size="xs" variant="outline">
                  <Link
                    href={notification.link}
                    onClick={() => {
                      if (!notification.read) void markRead(notification.id);
                    }}
                  >
                    Open
                  </Link>
                </Button>
              ) : null}
              {!notification.read ? (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => void markRead(notification.id)}
                >
                  Mark read
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
