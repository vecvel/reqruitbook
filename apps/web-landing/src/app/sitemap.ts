import type { MetadataRoute } from "next";

import { PORTAL_HOST, PORTAL_SCHEME } from "@/lib/env";

/**
 * Only the pages a stranger should land on.
 *
 * The legal stubs are deliberately absent: they carry `robots: noindex`
 * because they are placeholders, and listing them here would contradict that.
 */
const PATHS = ["/", "/for-companies", "/for-candidates", "/pricing", "/signup/company", "/signin"];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = `${PORTAL_SCHEME}://${PORTAL_HOST}`;
  return PATHS.map((path) => ({
    url: `${origin}${path}`,
    changeFrequency: "monthly" as const,
    priority: path === "/" ? 1 : 0.7,
  }));
}
