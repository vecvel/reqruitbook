import { defineFeature } from "@/lib/rbac/define";

export const jobsFeature = defineFeature({
  key: "jobs",
  name: "Job Requisitions",
  description: "Openings, job descriptions, salary bands, and the publish workflow",
  icon: "Briefcase",
  group: "recruitment",
  order: 2,
  crud: true,
  actions: [
    {
      action: "publish",
      label: "Publish to Careers Portal",
      description: "Make a requisition publicly visible or take it offline",
      sensitive: true,
    },
    {
      action: "duplicate",
      label: "Duplicate Requisition",
      description: "Clone an existing requisition into a new draft",
    },
    {
      action: "export",
      label: "Export Requisitions",
      description: "Download the requisition list as a spreadsheet",
    },
  ],
  nav: [
    {
      label: "Jobs",
      href: "/jobs",
      icon: "Briefcase",
      requires: ["jobs.read"],
      children: [
        { label: "All Openings", href: "/jobs" },
        { label: "Open Jobs", href: "/jobs?status=open", badgeKey: "openJobs" },
        { label: "Drafts", href: "/jobs?status=draft" },
        { label: "On Hold", href: "/jobs?status=on_hold" },
        { label: "Closed", href: "/jobs?status=closed" },
        { label: "+ Create Job", href: "/jobs/new", requires: ["jobs.create"] },
      ],
    },
  ],
  routes: [
    { path: "/jobs/new", exact: true, requires: ["jobs.create"] },
    { path: "/jobs/:id/edit", exact: true, requires: ["jobs.update"] },
    { path: "/jobs", requires: ["jobs.read"] },
  ],
});
