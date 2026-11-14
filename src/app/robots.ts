import type { MetadataRoute } from "next";

import { IN_DEVELOPMENT } from "@/lib/edition";
import { site } from "@/lib/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  // la edición en desarrollo no se indexa: la que cuenta es la del link principal
  if (IN_DEVELOPMENT) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    // lo personal, lo interno y la API no tienen nada para un buscador
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/render/", "/embed/", "/admin/", "/panel/", "/cuenta/", "/mis-disenos/"] }],
    sitemap: `${site.url}/sitemap.xml`,
  };
}
