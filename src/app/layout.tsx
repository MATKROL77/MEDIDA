import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { CookieConsent } from "@/components/site/CookieConsent";
import { SiteProvider } from "@/components/site/SiteProvider";
import { ConfiguratorWindow } from "@/components/site/ConfiguratorWindow";
import { SyncAgent } from "@/components/site/SyncAgent";
import { IN_DEVELOPMENT } from "@/lib/edition";
import { site } from "@/lib/site";
import "./globals.css";

// tipografías locales: next/font/google baja los archivos en el build y lo
// tira abajo cuando Google no contesta
const inter = localFont({
  src: "./fonts/inter-latin-variable.woff2",
  variable: "--font-inter",
  display: "swap",
});
export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} · ${site.tagline}`, template: `%s · ${site.name}` },
  description: site.description,
  applicationName: site.name,
  authors: [{ name: site.maker }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: site.name,
    locale: "es_AR",
    title: `${site.name} · ${site.tagline}`,
    description: site.description,
    url: "/",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Un placard configurado en 3D con MEDIDA" }],
  },
  twitter: { card: "summary_large_image", title: `${site.name} · ${site.tagline}`, description: site.description, images: ["/og.jpg"] },
  formatDetection: { telephone: false },
  ...(IN_DEVELOPMENT ? { robots: { index: false, follow: false } } : {}),
};

export const viewport: Viewport = {
  themeColor: "#ece5d8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={inter.variable}>
      <head>
        {/* marca que hay JavaScript antes de pintar: sin él, nada queda escondido esperando una animación */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="min-h-dvh">
        <SiteProvider>
          {children}
          <CookieConsent />
          <SyncAgent />
          <ConfiguratorWindow />
        </SiteProvider>
      </body>
    </html>
  );
}
