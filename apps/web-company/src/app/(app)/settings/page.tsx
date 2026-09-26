import { RouteGate } from "@/components/rbac/route-gate";
import { SettingsPage } from "@/features/access-control/components/settings-page";

export default function Page() {
  return (
    <RouteGate path="/settings">
      <SettingsPage />
    </RouteGate>
  );
}
