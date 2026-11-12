import type { MetadataRoute } from "next";

import { SERVICES } from "@/lib/services";
import { site } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", "/configuradores/", "/demo/", "/servicios/", ...SERVICES.map((s) => `/servicios/${s.slug}/`), "/privacidad/", "/cookies/", "/terminos/"];
  return paths.map((path) => ({ url: `${site.url}${path}`, changeFrequency: "monthly", priority: path === "/" ? 1 : path === "/demo/" || path === "/configuradores/" ? 0.9 : 0.6 }));
}
