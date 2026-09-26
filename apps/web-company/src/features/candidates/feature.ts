import { defineFeature } from "@/lib/rbac/define";

export const candidatesFeature = defineFeature({
  key: "candidates",
  name: "Candidates & Talent Pool",
  description: "Talent repository, resumes, cross-job profiles, and skill tags",
  icon: "Users",
  group: "recruitment",
  order: 4,
  crud: true,
  actions: [
    {
      action: "manage_talent_pool",
      label: "Curate Talent Pool",
      description: "Add or remove candidates from the long-term talent pool",
    },
    {
      action: "export",
      label: "Export Candidates",
      description: "Download the candidate directory as a spreadsheet",
    },
    {
      action: "import",
      label: "Import Candidates",
      description: "Bulk-import candidate profiles from a file",
    },
  ],
  nav: [
    {
      label: "Candidates",
      href: "/candidates",
      icon: "Users",
      requires: ["candidates.read"],
      children: [
        { label: "All Candidates", href: "/candidates" },
        { label: "Talent Pool", href: "/candidates?tab=talent-pool" },
        { label: "+ Add Candidate", href: "/candidates/new", requires: ["candidates.create"] },
      ],
    },
  ],
  routes: [
    { path: "/candidates/new", exact: true, requires: ["candidates.create"] },
    { path: "/candidates", requires: ["candidates.read"] },
  ],
});
