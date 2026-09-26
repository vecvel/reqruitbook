import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ConversationList } from "@/components/messages/conversation-list";
import { MessageThread } from "@/components/messages/message-thread";
import { requireIdentity } from "@/lib/guard";

export const metadata = { title: "Conversation" };

type Params = Promise<{ id: string }>;

export default async function ConversationPage({ params }: { params: Params }) {
  const { id } = await params;
  await requireIdentity(`/messages/${id}`);

  return (
    <div className="page">
      <Link
        href="/messages"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground lg:hidden"
      >
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        All messages
      </Link>

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        {/* The list stays beside the thread on a wide screen so switching
            conversations is one click rather than a round trip through a
            separate page. */}
        <aside className="hidden lg:block">
          <h2 className="section-title mb-2">Conversations</h2>
          <ConversationList activeId={id} />
        </aside>

        <section className="surface p-4">
          <MessageThread conversationId={id} />
        </section>
      </div>
    </div>
  );
}
