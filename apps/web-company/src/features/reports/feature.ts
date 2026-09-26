import { defineFeature } from "@/lib/rbac/define";

export const reportsFeature = defineFeature({
  key: "reports",
  name: "Reports & Analytics",
  description: "Time to hire, source funnel, and recruiter performance metrics",
  icon: "ChartColumn",
  group: "recruitment",
  order: 8,
  crud: ["read"],
  actions: [
    {
      action: "export",
      label: "Export Reports",
      description: "Download analytics datasets for external reporting",
    },
  ],
  nav: [
    {
      label: "Reports",
      href: "/reports",
      icon: "ChartColumn",
      requires: ["reports.read"],
      children: [
        { label: "Recruitment Overview", href: "/reports" },
        { label: "Time-to-Hire & Fill", href: "/reports?tab=time-to-hire" },
        { label: "Source Performance", href: "/reports?tab=sources" },
        { label: "Interviewer Analytics", href: "/reports?tab=interviewers" },
      ],
    },
  ],
  routes: [{ path: "/reports", requires: ["reports.read"] }],
});
