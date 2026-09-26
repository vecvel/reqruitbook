import { defineFeature } from "@/lib/rbac/define";

export const organizationFeature = defineFeature({
  key: "organization",
  name: "Organization Profile",
  description: "Company identity, branding, careers subdomain, and defaults",
  icon: "Building2",
  group: "configuration",
  order: 1,
  alwaysEnabled: true,
  crud: ["read", "update"],
  settings: {
    tab: "company",
    label: "Company",
    navLabel: "Organization & Profile",
    icon: "Building2",
    order: 10,
  },
});

export const emailSettingsFeature = defineFeature({
  key: "email-settings",
  name: "Email Delivery",
  description: "SMTP credentials, sender identity, and automated dispatch rules",
  icon: "Mail",
  group: "configuration",
  order: 2,
  crud: ["read", "update"],
  actions: [
    {
      action: "test",
      label: "Run SMTP Diagnostics",
      description: "Send a live test message to verify delivery settings",
    },
  ],
  settings: {
    tab: "smtp",
    label: "SMTP & Email",
    navLabel: "SMTP & Email Delivery",
    icon: "Server",
    order: 80,
  },
});

export const integrationsFeature = defineFeature({
  key: "integrations",
  name: "HRM & Integrations",
  description: "Outbound HRM webhook, payroll handover, and security settings",
  icon: "Plug",
  group: "configuration",
  order: 3,
  crud: ["read", "update"],
  settings: {
    tab: "integrations",
    label: "Integrations",
    navLabel: "HRM & Integrations",
    icon: "Plug",
    order: 85,
  },
});
