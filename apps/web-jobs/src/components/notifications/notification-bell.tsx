"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

import { useNotifications } from "@/components/notifications/use-notifications";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { notifications, unreadCount, loading, error, markRead, markAllRead } =
    useNotifications(true);

  const recent = notifications.slice(0, 8);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative text-shell-muted hover:bg-shell-border hover:text-shell-foreground"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : "Notifications"
          }
        >
          <Bell aria-hidden="true" />
          {unreadCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <h2 className="text-sm font-semibold">Notifications</h2>
          {unreadCount > 0 ? (
            <Button variant="link" size="xs" onClick={() => void markAllRead()}>
              Mark all read
            </Button>
          ) : null}
        </div>

        <div className="max-h-80 overflow-y-auto scrollbar-thin">
          {loading ? (
            <div className="space-y-2 p-3" aria-busy="true">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : error ? (
            <p className="p-3 text-sm text-destructive">{error}</p>
          ) : recent.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Nothing yet. Updates about your applications and messages will
              appear here.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((notification) => {
                const body = (
                  <>
                    <span className="flex items-start gap-2">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                          notification.read ? "bg-transparent" : "bg-accent",
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {notification.title}
                        </span>
                        {notification.body ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {notification.body}
                          </span>
                        ) : null}
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {formatRelative(notification.createdAt)}
                        </span>
                      </span>
                    </span>
                  </>
                );

                return (
                  <li key={notification.id}>
                    {notification.link ? (
                      <Link
                        href={notification.link}
                        onClick={() => {
                          if (!notification.read) void markRead(notification.id);
                        }}
                        className="block px-3 py-2.5 hover:bg-muted"
                      >
                        {body}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (!notification.read) void markRead(notification.id);
                        }}
                        className="block w-full px-3 py-2.5 text-left hover:bg-muted"
                      >
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-border p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/notifications">See all notifications</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
