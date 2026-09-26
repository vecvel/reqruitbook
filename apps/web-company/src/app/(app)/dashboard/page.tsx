import { RouteGate } from "@/components/rbac/route-gate";
import { DashboardPage } from "@/features/dashboard/components/dashboard-page";

export default function Page() {
  return (
    <RouteGate path="/dashboard">
      <DashboardPage />
    </RouteGate>
  );
}
