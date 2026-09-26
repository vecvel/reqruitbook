import { RouteGate } from "@/components/rbac/route-gate";
import { CommunicationsPage } from "@/features/communications/components/communications-page";

export default function Page() {
  return (
    <RouteGate path="/communications">
      <CommunicationsPage />
    </RouteGate>
  );
}
