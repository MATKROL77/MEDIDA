import type { Metadata } from "next";

import { MyDesigns } from "@/components/designs/MyDesigns";

export const metadata: Metadata = {
  title: "Mis diseños",
  description: "Tus diseños guardados: favoritos para comparar y un carrito de consulta para pedir cotización de varios muebles juntos.",
  alternates: { canonical: "/mis-disenos/" },
  // es una página personal: no tiene nada para un buscador
  robots: { index: false },
};

export default function MyDesignsPage() {
  return <MyDesigns />;
}
