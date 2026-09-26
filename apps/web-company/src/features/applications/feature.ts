import { defineFeature } from "@/lib/rbac/define";

export const applicationsFeature = defineFeature({
  key: "applications",
  name: "Applications & Pipeline",
  description: "Applicant tracking, screening, kanban stages, and stage progression",
  icon: "Layers",
  group: "recruitment",
  order: 3,
  crud: true,
  actions: [
    {
      action: "advance_stage",
      label: "Advance Pipeline Stage",
      description: "Move applicants between Screening, Interview, Offer, and Hired",
      sensitive: true,
    },
    {
      action: "reject",
      label: "Reject Applicants",
      description: "Reject an application with a recorded reason",
      sensitive: true,
    },
    {
      action: "bulk_update",
      label: "Bulk Stage Actions",
      description: "Apply a stage change to multiple applications at once",
    },
    {
      action: "export",
      label: "Export Applications",
      description: "Download the pipeline as a spreadsheet",
    },
  ],
  nav: [
    {
      label: "Applications",
      href: "/applications",
      icon: "Layers",
      badgeKey: "activeApplications",
      requires: ["applications.read"],
      children: [
        { label: "All Applications", href: "/applications" },
        { label: "Applied / New", href: "/applications?stage=applied" },
        { label: "Screening", href: "/applications?stage=screening", badgeKey: "screeningCount" },
        { label: "Shortlisted", href: "/applications?stage=shortlisted" },
        { label: "Interview Loops", href: "/applications?stage=interview" },
        { label: "Evaluation & Debrief", href: "/applications?stage=evaluation" },
        { label: "Selected", href: "/applications?stage=selected" },
        { label: "Offer Stage", href: "/applications?stage=offer" },
        { label: "Hired (HRM)", href: "/applications?stage=hired" },
        { label: "Rejected", href: "/applications?stage=rejected" },
      ],
    },
  ],
  routes: [{ path: "/applications", requires: ["applications.read"] }],
});
