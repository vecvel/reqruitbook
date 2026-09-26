import { RouteGate } from "@/components/rbac/route-gate";
import { JobsListPage } from "@/features/jobs/components/jobs-list-page";

export default function Page() {
  return (
    <RouteGate path="/jobs">
      <JobsListPage />
    </RouteGate>
  );
}
