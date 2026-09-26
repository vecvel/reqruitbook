import type { MetadataRoute } from "next";

import { PORTAL_HOST, PORTAL_SCHEME } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Nothing under /api is a page, and the registration confirmation is a
      // one-visitor URL that has no business in an index.
      disallow: ["/api/", "/signup/company/done"],
    },
    sitemap: `${PORTAL_SCHEME}://${PORTAL_HOST}/sitemap.xml`,
  };
}
