import type { NextConfig } from "next";

/**
 * Todo corre en el navegador: el precio, el despiece y el 3D se calculan del
 * lado del cliente y la configuración viaja en el link. Por eso alcanza con un
 * export estático, que se publica gratis en Cloudflare o GitHub Pages.
 */
const nextConfig: NextConfig = {
  output: "export",
  // Evita tomar un lockfile de otra carpeta como raíz del proyecto.
  outputFileTracingRoot: __dirname,
  reactStrictMode: true,
  devIndicators: false,
  // cada ruta como carpeta con index.html: no depende de reescrituras del hosting
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
