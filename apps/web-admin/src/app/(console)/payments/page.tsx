import type { Metadata } from "next";

import { PaymentsClient } from "./payments-client";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const { companyId } = await searchParams;
  return <PaymentsClient initialCompanyId={companyId ?? ""} />;
}
