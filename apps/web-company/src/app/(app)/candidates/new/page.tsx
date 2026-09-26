import { RouteGate } from "@/components/rbac/route-gate";
import { CandidateCreatePage } from "@/features/candidates/components/candidate-create-page";

export default function Page() {
  return (
    <RouteGate path="/candidates/new">
      <CandidateCreatePage />
    </RouteGate>
  );
}
