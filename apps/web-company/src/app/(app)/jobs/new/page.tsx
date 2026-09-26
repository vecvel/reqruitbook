import { RouteGate } from "@/components/rbac/route-gate";
import { JobCreatePage } from "@/features/jobs/components/job-create-page";

export default function Page() {
  return (
    <RouteGate path="/jobs/new">
      <JobCreatePage />
    </RouteGate>
  );
}
