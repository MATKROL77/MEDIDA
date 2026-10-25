import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { product } from "@/lib/product";
import "./globals.css";

// tipografías locales: next/font/google baja los archivos en el build y lo
// tira abajo cuando Google no contesta
const inter = localFont({
  src: "./fonts/inter-latin-variable.woff2",
  variable: "--font-inter",
  display: "swap",
});
const interTight = localFont({
  src: "./fonts/inter-tight-latin-variable.woff2",
  variable: "--font-inter-tight",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${product.name}: configurador 3D para placares a medida`,
  description: product.pitch,
};

export const viewport: Viewport = {
  themeColor: "#f5f2ec",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${inter.variable} ${interTight.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
