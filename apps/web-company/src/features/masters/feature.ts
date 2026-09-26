import { defineFeature } from "@/lib/rbac/define";
import type { FeatureDef, SettingsTabDef } from "@/lib/rbac/types";

/**
 * Master data features.
 *
 * Every lookup list the product reads from is its own feature with its own CRUD
 * permissions, so a role can be allowed to maintain, say, Locations without also
 * gaining control of Currencies. They are declared through one small helper because
 * the shape is identical — adding another master is a single entry in this list.
 */
interface MasterSpec {
  key: string;
  name: string;
  description: string;
  icon: string;
  order: number;
  tab: string;
  tabLabel: string;
  navLabel: string;
}

const MASTERS: MasterSpec[] = [
  {
    key: "departments",
    name: "Departments",
    description: "Functional departments used by requisitions and workforce allocation",
    icon: "Building2",
    order: 10,
    tab: "departments",
    tabLabel: "Departments",
    navLabel: "Departments",
  },
  {
    key: "locations",
    name: "Locations",
    description: "Global office locations and hiring hubs",
    icon: "MapPin",
    order: 20,
    tab: "locations",
    tabLabel: "Locations",
    navLabel: "Locations",
  },
  {
    key: "currencies",
    name: "Currencies",
    description: "Currency codes and symbols available for compensation",
    icon: "Coins",
    order: 30,
    tab: "currencies",
    tabLabel: "Currencies",
    navLabel: "Currencies",
  },
  {
    key: "pay-frequencies",
    name: "Pay Frequencies",
    description: "Annual, monthly, and hourly compensation cadences",
    icon: "Clock",
    order: 40,
    tab: "pay-frequencies",
    tabLabel: "Pay Frequencies",
    navLabel: "Pay Frequencies",
  },
  {
    key: "job-statuses",
    name: "Requisition Statuses",
    description: "Lifecycle statuses a requisition can move through",
    icon: "Layers",
    order: 50,
    tab: "job-statuses",
    tabLabel: "Requisition Statuses",
    navLabel: "Requisition Statuses",
  },
  {
    key: "interview-types",
    name: "Interview Rounds",
    description: "Round types and their default durations",
    icon: "CalendarDays",
    order: 55,
    tab: "interview-types",
    tabLabel: "Interview Rounds",
    navLabel: "Interview Rounds",
  },
  {
    key: "benefit-categories",
    name: "Benefit Categories",
    description: "Grouping for the benefits and perks shown on job posts",
    icon: "Tag",
    order: 60,
    tab: "benefit-categories",
    tabLabel: "Benefit Categories",
    navLabel: "Benefit Categories",
  },
  {
    key: "work-modes",
    name: "Work Modes",
    description: "Work arrangements such as Hybrid, Remote, and On-Site",
    icon: "Globe",
    order: 62,
    tab: "work-modes",
    tabLabel: "Work Modes",
    navLabel: "Work Modes",
  },
  {
    key: "employment-types",
    name: "Employment Types",
    description: "Contract classifications such as Full-Time and Internship",
    icon: "Briefcase",
    order: 64,
    tab: "employment-types",
    tabLabel: "Employment Types",
    navLabel: "Employment Types",
  },
  {
    key: "experience-levels",
    name: "Experience Levels",
    description: "Seniority tiers and their year ranges",
    icon: "Sparkles",
    order: 66,
    tab: "experience-levels",
    tabLabel: "Experience Levels",
    navLabel: "Experience Levels",
  },
  {
    key: "education-levels",
    name: "Education Levels",
    description: "Degree and qualification classifications",
    icon: "ShieldCheck",
    order: 68,
    tab: "education-levels",
    tabLabel: "Education Levels",
    navLabel: "Education Levels",
  },
];

function defineMaster(spec: MasterSpec): FeatureDef {
  const settings: SettingsTabDef = {
    tab: spec.tab,
    label: spec.tabLabel,
    navLabel: spec.navLabel,
    icon: spec.icon,
    order: spec.order + 100,
  };

  return defineFeature({
    key: spec.key,
    name: spec.name,
    description: spec.description,
    icon: spec.icon,
    group: "configuration",
    order: spec.order,
    crud: true,
    settings,
  });
}

export const MASTER_FEATURES: FeatureDef[] = MASTERS.map(defineMaster);

/** Master feature keys in settings order — used by the settings screen renderer. */
export const MASTER_FEATURE_KEYS = MASTERS.map((m) => m.key);
