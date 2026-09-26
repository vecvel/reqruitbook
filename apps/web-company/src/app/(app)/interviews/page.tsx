import { RouteGate } from "@/components/rbac/route-gate";
import { InterviewsPage } from "@/features/interviews/components/interviews-page";

export default function Page() {
  return (
    <RouteGate path="/interviews">
      <InterviewsPage />
    </RouteGate>
  );
}
