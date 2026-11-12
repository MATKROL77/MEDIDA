import type { MetadataRoute } from "next";

import { site } from "@/lib/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    // lo personal, lo interno y la API no tienen nada para un buscador
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/render/", "/embed/", "/admin/", "/panel/", "/cuenta/", "/mis-disenos/"] }],
    sitemap: `${site.url}/sitemap.xml`,
  };
}
