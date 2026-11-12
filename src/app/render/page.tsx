import type { Metadata } from "next";

import RenderStage from "@/components/RenderStage";

export const metadata: Metadata = {
  title: "Vista limpia del 3D",
  // herramienta interna para sacar las imágenes del sitio
  robots: { index: false, follow: false },
};

export default function RenderPage() {
  return <RenderStage />;
}
