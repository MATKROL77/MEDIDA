import type { Metadata } from "next";
import Link from "next/link";

import { ContactSection } from "@/components/landing/ContactSection";
import { ContactLink } from "@/components/site/ContactLink";
import { IconMail, IconWhatsapp } from "@/components/site/icons";
import { PageHero } from "@/components/site/PageHero";
import { SERVICES } from "@/lib/services";

export const metadata: Metadata = {
  title: "Para empresas",
  description: "Un configurador 3D para tu web, una página completa con configuradores o una plataforma para varias familias de producto.",
  alternates: { canonical: "/servicios/" },
};

export default function ServicesPage() {
  return (
    <>
      <PageHero
        eyebrow="Para empresas"
        title="Que tus clientes armen el producto. A vos te llega la consulta lista."
        lead="MEDIDA es para fabricantes, carpinterías y comercios que venden a medida. Podés sumar un configurador a tu página, pedir la página entera o administrar varios configuradores desde una cuenta."
      >
        <ContactLink channel="whatsapp" interest="demostracion" placement="servicios" className="btn btn-primary">
          <IconWhatsapp />
          Pedir una demostración
        </ContactLink>
        <ContactLink channel="email" interest="demostracion" placement="servicios" className="btn btn-secondary">
          <IconMail />
          Escribir por email
        </ContactLink>
      </PageHero>

      <section aria-label="Servicios" className="wrap space-y-5 pb-16 sm:pb-24">
        {SERVICES.map((service, i) => (
          <article key={service.slug} className="tile grid gap-8 p-7 sm:p-12 lg:grid-cols-[1fr_1.2fr] lg:gap-16" data-reveal>
            <div>
              <span className="font-display text-sm font-semibold tabular-nums text-ink-3">0{i + 1}</span>
              <h2 className="display-md mt-3">{service.title}</h2>
              <p className="mt-4 text-lg leading-relaxed text-ink-2">{service.summary}</p>
              <p className="mt-4 text-sm leading-relaxed text-ink-2">{service.audience}</p>
              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
                <ContactLink channel="whatsapp" interest={service.interest} placement="servicios" className="btn btn-primary btn-sm">
                  <IconWhatsapp width={15} height={15} />
                  Consultar
                </ContactLink>
                <Link href={`/servicios/${service.slug}/`} className="link-arrow text-sm">
                  Ver el servicio completo
                </Link>
              </div>
            </div>
            <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {service.includes.map((item) => (
                <div key={item.title} className="border-t border-line pt-4">
                  <dt className="font-semibold">{item.title}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-ink-2">{item.body}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </section>

      <section aria-label="Contacto" className="wrap pb-16 sm:pb-24" data-reveal>
        <ContactSection placement="servicios" />
      </section>
    </>
  );
}
