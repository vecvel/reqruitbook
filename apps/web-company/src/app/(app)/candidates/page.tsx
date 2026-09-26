import { RouteGate } from "@/components/rbac/route-gate";
import { CandidatesPage } from "@/features/candidates/components/candidates-page";

export default function Page() {
  return (
    <RouteGate path="/candidates">
      <CandidatesPage />
    </RouteGate>
  );
}
