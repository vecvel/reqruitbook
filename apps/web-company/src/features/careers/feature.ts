import { defineFeature } from "@/lib/rbac/define";

/**
 * The public job board itself is unauthenticated. These permissions cover the
 * internal side: previewing the portal from the app shell and configuring it.
 */
export const careersFeature = defineFeature({
  key: "careers",
  name: "Careers Portal",
  description: "Public job board, application form, and candidate account tracking",
  icon: "Globe",
  group: "recruitment",
  order: 9,
  crud: ["read", "update"],
  nav: [
    {
      label: "Careers Portal",
      href: "/careers",
      icon: "Globe",
      requires: ["careers.read"],
      children: [
        { label: "Public Job Board", href: "/careers" },
        { label: "Candidate Portal", href: "/careers/portal" },
      ],
    },
  ],
});
