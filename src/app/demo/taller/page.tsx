import type { Metadata } from "next";

import Workshop from "@/components/Workshop";

export const metadata: Metadata = {
  title: "Orden de producción",
  // es la vista interna del taller: no tiene que aparecer en buscadores
  robots: { index: false },
};

export default function WorkshopPage() {
  return <Workshop />;
}
