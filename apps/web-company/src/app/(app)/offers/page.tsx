import { RouteGate } from "@/components/rbac/route-gate";
import { OffersPage } from "@/features/offers/components/offers-page";

export default function Page() {
  return (
    <RouteGate path="/offers">
      <OffersPage />
    </RouteGate>
  );
}
