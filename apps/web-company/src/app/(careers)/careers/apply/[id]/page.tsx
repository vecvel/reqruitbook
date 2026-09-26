import { CareersApplyPage } from "@/features/careers/components/careers-apply-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CareersApplyPage jobId={id} />;
}
