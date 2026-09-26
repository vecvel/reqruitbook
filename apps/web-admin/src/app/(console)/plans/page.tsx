import type { Metadata } from "next";

import { PlansClient } from "./plans-client";

export const metadata: Metadata = { title: "Plans" };

export default function PlansPage() {
  return <PlansClient />;
}
