import { defineFeature } from "@/lib/rbac/define";

export const offersFeature = defineFeature({
  key: "offers",
  name: "Offers & HRM Sync",
  description: "Offer letters, compensation packages, approvals, and HRM handover",
  icon: "FileCheck",
  group: "recruitment",
  order: 6,
  crud: true,
  actions: [
    {
      action: "approve",
      label: "Approve Offers",
      description: "Sign off on compensation packages before they are sent",
      sensitive: true,
    },
    {
      action: "send",
      label: "Send Offers",
      description: "Dispatch an approved offer letter to the candidate",
      sensitive: true,
    },
    {
      action: "view_compensation",
      label: "View Salary & Compensation",
      description: "See salary figures, bonuses, and equity on offers and requisitions",
      sensitive: true,
    },
    {
      action: "sync_hrm",
      label: "Synchronize to HRM",
      description: "Push an accepted offer into the HRM and payroll system",
      sensitive: true,
    },
    {
      action: "export",
      label: "Export Offers",
      description: "Download the offer register as a spreadsheet",
    },
  ],
  nav: [
    {
      label: "Offers",
      href: "/offers",
      icon: "FileCheck",
      requires: ["offers.read"],
      children: [
        { label: "All Offers", href: "/offers" },
        { label: "Draft Offers", href: "/offers?status=draft" },
        { label: "Pending Approval", href: "/offers?status=pending_approval" },
        { label: "Sent / Out", href: "/offers?status=sent" },
        { label: "Accepted", href: "/offers?status=accepted" },
        { label: "Rejected / Expired", href: "/offers?status=declined" },
        { label: "+ Create Offer", href: "/offers/new", requires: ["offers.create"] },
      ],
    },
  ],
  routes: [
    { path: "/offers/new", exact: true, requires: ["offers.create"] },
    { path: "/offers", requires: ["offers.read"] },
  ],
});
