import type { Metadata } from "next";

import { CompanyDetailClient } from "./company-detail-client";

export const metadata: Metadata = { title: "Company" };

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CompanyDetailClient companyId={id} />;
}
