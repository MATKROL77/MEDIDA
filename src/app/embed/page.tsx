import type { Metadata } from "next";

import EmbedConfigurator from "@/components/EmbedConfigurator";

export const metadata: Metadata = {
  title: "Configurador",
  // vive dentro de la página de cada empresa: no se indexa por separado
  robots: { index: false },
};

export default function EmbedPage() {
  return <EmbedConfigurator />;
}
