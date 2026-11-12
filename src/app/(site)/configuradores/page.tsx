import type { Metadata } from "next";

import { ContactSection } from "@/components/landing/ContactSection";
import { FamilyCard } from "@/components/landing/FamilyCard";
import { FamilyDrawing } from "@/components/landing/FamilyDrawing";
import { ContactLink } from "@/components/site/ContactLink";
import { PageHero } from "@/components/site/PageHero";
import { FAMILIES } from "@/lib/families";
import { familyMessage } from "@/lib/site";

export const metadata: Metadata = {
  title: "Configuradores",
  description: "Probá el configurador 3D de placares y vestidores sin registrarte, y mirá las familias de producto que están en desarrollo.",
  alternates: { canonical: "/configuradores/" },
};

export default function ConfiguratorsPage() {
  const demos = FAMILIES.filter((f) => f.status === "demo");
  const upcoming = FAMILIES.filter((f) => f.status === "desarrollo");
  return (
    <>
      <PageHero
        eyebrow="Configuradores"
        title="Probalos sin registrarte."
        lead="Abrís la demo y empezás a configurar. Lo que armes queda guardado en tu dispositivo, y si querés lo sumás a tus favoritos o al carrito de consulta."
      />

      <section aria-labelledby="para-probar" className="wrap pb-16 sm:pb-24">
        <h2 id="para-probar" className="display-md">
          Para probar ahora
        </h2>
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          {demos.map((family) => (
            <div key={family.id} className="contents">
              <div data-reveal>
                <FamilyCard family={family} featured placement="configuradores" />
              </div>
              <div className="tile flex flex-col justify-center p-7 sm:p-10" data-reveal>
                <h3 className="font-display text-xl font-semibold tracking-tight">Qué se puede configurar</h3>
                <ul className="mt-5 space-y-3.5">
                  {family.options.map((option) => (
                    <li key={option} className="flex gap-3 leading-relaxed text-ink-2">
                      <span className="mt-[0.6rem] size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                      {option}
                    </li>
                  ))}
                </ul>
                <p className="mt-7 border-t border-line pt-6 text-sm leading-relaxed text-ink-2">
                  Es una demostración: los precios son de muestra y MEDIDA es el software, no una fábrica de muebles. En el sitio de un fabricante, la consulta le
                  llega a esa empresa.
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="en-desarrollo" className="bg-paper py-16 sm:py-24">
        <div className="wrap">
          <div className="max-w-3xl" data-reveal>
            <h2 id="en-desarrollo" className="display-md">
              En desarrollo
            </h2>
            <p className="mt-3 leading-relaxed text-ink-2">
              Estas familias todavía no tienen configurador. Se construyen sobre el mismo motor que el de placares, y el orden lo define qué necesitan las empresas
              que consultan: si fabricás alguna, escribime.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {upcoming.map((family, i) => (
              <article key={family.id} className="flex flex-col rounded-[var(--radius-tile)] bg-surface p-6 sm:p-7" data-reveal style={{ ["--reveal-delay" as string]: `${(i % 3) * 70}ms` }}>
                <div className="grid aspect-[16/10] place-items-center">
                  <FamilyDrawing id={family.id} className="h-full w-full max-w-[17rem]" />
                </div>
                <span className="badge badge-dev mt-2 self-start">En desarrollo</span>
                <h3 className="mt-3 font-display text-xl font-semibold tracking-tight">{family.name}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{family.summary}</p>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.1em] text-ink-3">Lo que se va a poder configurar</p>
                <ul className="mt-2.5 space-y-1.5 text-sm text-ink-2">
                  {family.options.map((option) => (
                    <li key={option}>{option}</li>
                  ))}
                </ul>
                <ContactLink channel="whatsapp" interest="configurador" message={familyMessage(family.name)} placement="configuradores" className="link-arrow mt-auto pt-6">
                  Consultar por este configurador
                </ContactLink>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-label="Contacto" className="wrap py-16 sm:py-24" data-reveal>
        <ContactSection placement="configuradores" />
      </section>
    </>
  );
}
