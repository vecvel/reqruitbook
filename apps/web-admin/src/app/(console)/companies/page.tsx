import type { Metadata } from "next";

import { CompaniesClient } from "./companies-client";

export const metadata: Metadata = { title: "Companies" };

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; plan?: string; q?: string }>;
}) {
  // The filters arrive in the URL so a link from the overview lands on a
  // pre-filtered list and an operator can share what they are looking at.
  const { state, plan, q } = await searchParams;
  return <CompaniesClient initialState={state ?? ""} initialPlan={plan ?? ""} initialSearch={q ?? ""} />;
}
