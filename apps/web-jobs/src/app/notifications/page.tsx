import { PageHeader } from "@/components/feedback";
import { NotificationsList } from "@/components/notifications/notifications-list";
import { requireIdentity } from "@/lib/guard";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  await requireIdentity("/notifications");

  return (
    <div className="page">
      <PageHeader
        title="Notifications"
        description="Updates about your applications and messages, delivered as they happen."
      />
      <NotificationsList />
    </div>
  );
}
