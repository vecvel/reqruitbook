import type { Metadata } from "next";

import { SubscriptionsClient } from "./subscriptions-client";

export const metadata: Metadata = { title: "Subscriptions" };

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string; state?: string }>;
}) {
  const { companyId, state } = await searchParams;
  return <SubscriptionsClient initialCompanyId={companyId ?? ""} initialState={state ?? ""} />;
}
