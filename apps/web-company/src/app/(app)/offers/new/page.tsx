import { RouteGate } from "@/components/rbac/route-gate";
import { OfferCreatePage } from "@/features/offers/components/offer-create-page";

export default function Page() {
  return (
    <RouteGate path="/offers/new">
      <OfferCreatePage />
    </RouteGate>
  );
}
