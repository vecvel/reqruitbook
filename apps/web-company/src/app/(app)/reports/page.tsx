import { RouteGate } from "@/components/rbac/route-gate";
import { ReportsPage } from "@/features/reports/components/reports-page";

export default function Page() {
  return (
    <RouteGate path="/reports">
      <ReportsPage />
    </RouteGate>
  );
}
