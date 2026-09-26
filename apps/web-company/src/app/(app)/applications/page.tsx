import { RouteGate } from "@/components/rbac/route-gate";
import { ApplicationsPage } from "@/features/applications/components/applications-page";

export default function Page() {
  return (
    <RouteGate path="/applications">
      <ApplicationsPage />
    </RouteGate>
  );
}
