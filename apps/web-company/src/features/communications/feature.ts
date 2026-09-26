import { defineFeature } from "@/lib/rbac/define";

export const communicationsFeature = defineFeature({
  key: "communications",
  name: "Communications",
  description: "Candidate email templates, merge tokens, and delivery history",
  icon: "Mail",
  group: "recruitment",
  order: 7,
  crud: true,
  actions: [
    {
      action: "send",
      label: "Send Candidate Emails",
      description: "Dispatch emails and status updates to candidates",
      sensitive: true,
    },
    {
      action: "view_history",
      label: "View Delivery History",
      description: "Inspect the audit trail of every message sent",
    },
  ],
  nav: [
    {
      label: "Communications",
      href: "/communications",
      icon: "Mail",
      requires: ["communications.read"],
      children: [
        { label: "Email Templates", href: "/communications" },
        {
          label: "Delivery Audit History",
          href: "/communications?tab=history",
          requires: ["communications.view_history"],
        },
      ],
    },
  ],
  routes: [{ path: "/communications", requires: ["communications.read"] }],
});
