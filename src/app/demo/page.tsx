import type { Metadata } from "next";

import Configurator from "@/components/Configurator";
import { catalog } from "@/lib/catalog";

export const metadata: Metadata = {
  title: `Armá tu placard · ${catalog.brand.name}`,
  description: "Diseñá tu placard a medida en 3D y mirá el precio al instante.",
};

export default function DemoPage() {
  return <Configurator />;
}
