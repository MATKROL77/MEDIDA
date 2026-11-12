import type { Metadata } from "next";

import { ContactSection } from "@/components/landing/ContactSection";
import { FamilyCard } from "@/components/landing/FamilyCard";
import { PageHero } from "@/components/site/PageHero";
import { FAMILIES } from "@/lib/families";

export const metadata: Metadata = {
  title: "Configuradores",
  description: "Probá sin registrarte los configuradores 3D de placares, mesas, muebles de TV, bibliotecas y sillones.",
  alternates: { canonical: "/configuradores/" },
};

export default function ConfiguratorsPage() {
  return (
    <>
      <PageHero
        eyebrow="Configuradores"
        title="Probalos sin registrarte."
        lead="Abrís la demo y empezás a configurar. Lo que armes queda guardado en tu dispositivo, y si querés lo sumás a tus favoritos o al carrito de consulta."
      />

      <section aria-label="Configuradores para probar" className="wrap pb-16 sm:pb-24">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FAMILIES.map((family, i) => (
            <div key={family.id} data-reveal style={{ ["--reveal-delay" as string]: `${(i % 3) * 70}ms` }}>
              <FamilyCard family={family} placement="configuradores" />
            </div>
          ))}
        </div>
        <p className="mt-10 max-w-3xl border-t border-line pt-6 text-sm leading-relaxed text-ink-2">
          Son demostraciones: los precios son de muestra y MEDIDA es el software, no una fábrica de muebles. En el sitio de un fabricante, cada configurador lleva sus
          medidas, sus materiales y sus precios, y la consulta le llega a esa empresa. El de placares es el más completo: suma despiece dibujado, plano de corte y PDF
          para el taller.
        </p>
      </section>

      <section aria-label="Contacto" className="wrap py-16 sm:py-24" data-reveal>
        <ContactSection placement="configuradores" />
      </section>
    </>
  );
}
