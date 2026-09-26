import { ConversationList } from "@/components/messages/conversation-list";
import { PageHeader } from "@/components/feedback";
import { requireIdentity } from "@/lib/guard";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  await requireIdentity("/messages");

  return (
    <div className="page">
      <PageHeader
        title="Messages"
        description="Conversations with the companies you have applied to."
      />
      <ConversationList />
    </div>
  );
}
