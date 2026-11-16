import Link from "next/link";

import { ContactSection } from "@/components/landing/ContactSection";
import { FamilyCard } from "@/components/landing/FamilyCard";
import { ContactLink } from "@/components/site/ContactLink";
import { IconWhatsapp } from "@/components/site/icons";
import { FAMILIES } from "@/lib/families";
import { SERVICES } from "@/lib/services";
import { site } from "@/lib/site";

/**
 * Landing de MEDIDA: arriba el título y, enseguida, todos los configuradores
 * para abrir. No lleva testimonios, clientes ni números de resultados:
 * todavía no hay, y no se inventan.
 */

const steps = [
  { title: "Configura", body: "Tu cliente abre el configurador desde tu web o desde un enlace y arma el producto en 3D." },
  { title: "Personaliza", body: "Elige medidas, materiales y módulos. Cada cambio se ve en el momento." },
  { title: "Guarda", body: "Guarda el diseño para compararlo o lo suma al carrito de consulta junto a otros." },
  { title: "Consulta", body: "Manda la consulta con la configuración completa, por WhatsApp o por email." },
  { title: "Cotizás", body: "Tu empresa recibe todo lo necesario para preparar la cotización, sin ida y vuelta de mensajes." },
];

const received = [
  { title: "La configuración entera", body: "Medidas, materiales, módulos y un enlace que abre exactamente el diseño que armó el cliente." },
  { title: "El despiece", body: "Cada pieza agrupada como se fabrica y dibujada con sus medidas, cantos y mecanizados." },
  { title: "El plano de corte", body: "Cómo acomodar las piezas en cada placa y cuántas placas hacen falta." },
  { title: "Costo y margen", body: "Cuánto cuesta ese mueble con tus precios y cuánto queda, antes de contestar." },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: site.name,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: site.description,
  url: site.url,
  inLanguage: "es-AR",
  author: { "@type": "Person", name: site.maker },
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero: qué es y cómo hablar; debajo, directamente, los configuradores */}
      <section className="wrap pb-10 pt-12 sm:pb-12 sm:pt-14">
        <div className="mx-auto max-w-[70rem] text-center">
          <p className="eyebrow">{site.tagline}</p>
          {/* compacto como en el teléfono: en la compu los configuradores se ven sin bajar */}
          <h1 className="display-xl mt-5 sm:text-[clamp(1.8rem,5.2vw,3.6rem)]">
            Tus productos.
            <br />
            Infinitas configuraciones.
          </h1>
          <p className="lead mx-auto mt-6 max-w-2xl">Convertí tus productos personalizados en experiencias interactivas de compra.</p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <ContactLink channel="whatsapp" interest="general" placement="hero" className="btn btn-whatsapp">
              <IconWhatsapp />
              Quiero MEDIDA para mi empresa
            </ContactLink>
            <Link href="/configuradores/" className="btn btn-secondary">
              Probar configuradores
            </Link>
          </div>
          <p className="mt-4 text-sm text-ink-2">
            Sin registro.{" "}
            <ContactLink channel="email" interest="general" placement="hero" className="underline underline-offset-4 hover:text-ink">
              También podés escribirme por email
            </ContactLink>
            .
          </p>
        </div>
      </section>

      {/* Todos los configuradores, directamente debajo del título */}
      <section id="configuradores" aria-labelledby="configuradores-titulo" className="wrap pb-16 sm:pb-24">
        <h2 id="configuradores-titulo" className="sr-only">
          Configuradores
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {FAMILIES.map((family) => (
            <FamilyCard key={family.id} family={family} placement="landing-familias" />
          ))}
        </div>
      </section>

      {/* Soluciones para empresas */}
      <section aria-labelledby="empresas" className="bg-paper py-16 sm:py-24">
        <div className="wrap">
          <div className="max-w-3xl" data-reveal>
            <p className="eyebrow">Para empresas</p>
            <h2 id="empresas" className="display-lg mt-4">
              MEDIDA en tu negocio, de tres maneras.
            </h2>
            <p className="lead mt-5">Para fabricantes, carpinterías y comercios que venden productos a medida.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:mt-14 lg:grid-cols-3 lg:gap-5">
            {SERVICES.map((service, i) => (
              <article key={service.slug} className="flex flex-col rounded-[var(--radius-tile)] bg-surface p-7 sm:p-8" data-reveal style={{ ["--reveal-delay" as string]: `${i * 70}ms` }}>
                <span className="font-display text-sm font-semibold tabular-nums text-ink-3">0{i + 1}</span>
                <h3 className="display-md mt-3">{service.title}</h3>
                <p className="mt-3 leading-relaxed text-ink-2">{service.summary}</p>
                <ul className="mt-6 space-y-2.5 border-t border-line pt-6 text-sm">
                  {service.includes.map((item) => (
                    <li key={item.title} className="flex gap-2.5">
                      <span className="mt-[0.55rem] size-1 shrink-0 rounded-full bg-accent" aria-hidden />
                      {item.title}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-8">
                  <ContactLink channel="whatsapp" interest={service.interest} placement="landing-servicios" className="btn btn-primary btn-sm">
                    <IconWhatsapp width={15} height={15} />
                    Consultar
                  </ContactLink>
                  <Link href={`/servicios/${service.slug}/`} className="link-arrow text-sm">
                    Ver el servicio
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" aria-labelledby="como-funciona-titulo" className="wrap py-16 sm:py-24">
        <div className="max-w-3xl" data-reveal>
          <p className="eyebrow">Cómo funciona</p>
          <h2 id="como-funciona-titulo" className="display-lg mt-4">
            Del primer clic a la cotización.
          </h2>
        </div>
        <ol className="mt-10 grid gap-x-6 gap-y-8 sm:mt-14 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((step, i) => (
            <li key={step.title} className="relative" data-reveal style={{ ["--reveal-delay" as string]: `${i * 80}ms` }}>
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink font-display text-sm font-semibold text-on-dark">{i + 1}</span>
                {/* la línea que une un paso con el siguiente */}
                {i < steps.length - 1 && <span className="hidden h-px flex-1 bg-line lg:block" aria-hidden />}
              </div>
              <h3 className="mt-5 font-display text-xl font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Lo que recibe la empresa */}
      <section aria-labelledby="recibe" className="wrap py-16 sm:py-24">
        <div className="tile grid items-center gap-10 overflow-hidden p-7 sm:p-12 lg:grid-cols-[1fr_1.15fr] lg:gap-14 lg:p-16">
          <div data-reveal>
            <p className="eyebrow">Lo que recibe tu empresa</p>
            <h2 id="recibe" className="display-lg mt-4">
              La consulta llega completa.
            </h2>
            <p className="lead mt-5">
              El 3D y el despiece salen del mismo cálculo: lo que el cliente ve es lo que se corta. El de placares suma además el plano de corte y el PDF para el taller.
            </p>
            <dl className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {received.map((item) => (
                <div key={item.title}>
                  <dt className="font-semibold">{item.title}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-ink-2">{item.body}</dd>
                </div>
              ))}
            </dl>
            <Link href="/demo/taller/" className="link-arrow mt-8">
              Ver una orden de ejemplo
            </Link>
          </div>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_70px_rgb(17_18_20/0.10)]" data-reveal>
            <img
              src="/img/orden.webp"
              alt="La orden de producción de un placard: piezas dibujadas con sus medidas, placas y costos"
              width={1400}
              height={1050}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover object-top"
            />
          </div>
        </div>
      </section>

      {/* Contacto comercial */}
      <section id="contacto" aria-label="Contacto" className="wrap pb-16 pt-8 sm:pb-24" data-reveal>
        <ContactSection />
      </section>
    </>
  );
}
