import { defineFeature } from "@/lib/rbac/define";

export const dashboardFeature = defineFeature({
  key: "dashboard",
  name: "Dashboard",
  description: "Recruitment overview, KPI tiles, and pipeline analytics",
  icon: "LayoutDashboard",
  group: "recruitment",
  order: 1,
  crud: ["read"],
  nav: [{ label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" }],
  routes: [{ path: "/dashboard", requires: ["dashboard.read"] }],
});
