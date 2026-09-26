import { RouteGate } from "@/components/rbac/route-gate";
import { JobEditPage } from "@/features/jobs/components/job-edit-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <RouteGate path={`/jobs/${id}/edit`}>
      <JobEditPage jobId={id} />
    </RouteGate>
  );
}
