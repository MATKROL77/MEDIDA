import Link from "next/link";

import { ContactSection } from "@/components/landing/ContactSection";
import { FamilyCard } from "@/components/landing/FamilyCard";
import { HeroStage } from "@/components/landing/HeroStage";
import { Highlights } from "@/components/landing/Highlights";
import { ContactLink } from "@/components/site/ContactLink";
import { IconWhatsapp } from "@/components/site/icons";
import { FAMILIES } from "@/lib/families";
import { SERVICES } from "@/lib/services";
import { site } from "@/lib/site";

/**
 * Landing de MEDIDA. No lleva testimonios, clientes ni números de resultados:
 * todavía no hay, y no se inventan.
 */

/** lo que hace distinto al configurador: cada cosa es real y se puede probar arriba */
const qualities = [
  { title: "Medida exacta", body: "Al milímetro, con las reglas de fabricación de tu taller." },
  { title: "Texturas reales", body: "Fotografiadas, con relieve y brillo, a escala real." },
  { title: "Luz calculada", body: "Trazado de rayos en el navegador, sin instalar nada." },
  { title: "Directo al taller", body: "Despiece, cantos y plano de corte de lo que se ve." },
];

/** las texturas del motor, con la foto de verdad (Poly Haven, CC0) */
const materials = [
  { name: "Nogal", src: "/tex/nogal.webp", style: { backgroundSize: "560px" } },
  { name: "Roble", src: "/tex/roble.webp", style: { backgroundSize: "560px" } },
  { name: "Bouclé", src: "/tex/tela-boucle.webp", style: { backgroundColor: "#e6dccb", backgroundBlendMode: "multiply", backgroundSize: "170px" } },
  { name: "Pana", src: "/tex/tela-pana.webp", style: { backgroundColor: "#7a2a2c", backgroundBlendMode: "multiply", backgroundSize: "170px" } },
  { name: "Lino", src: "/tex/tela-lino.webp", style: { backgroundColor: "#b39f82", backgroundBlendMode: "multiply", backgroundSize: "170px" } },
  { name: "Cuero", src: "/tex/tela-cuero.webp", style: { backgroundColor: "#9a6040", backgroundBlendMode: "multiply", backgroundSize: "230px" } },
  { name: "Cemento", src: "/tex/piso-cemento.webp", style: { backgroundSize: "420px" } },
  { name: "Baldosa", src: "/tex/piso-baldosa.webp", style: { backgroundSize: "300px" } },
];

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

      {/* Hero: primero el configurador, andando; debajo, qué es y cómo hablar */}
      <section className="wrap pb-16 pt-4 sm:pb-24 sm:pt-6">
        <HeroStage />

        <div className="mx-auto mt-12 max-w-[70rem] text-center sm:mt-16">
          <p className="eyebrow">{site.tagline}</p>
          <h1 className="display-xl mt-5">
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

      {/* Lo que lo hace distinto */}
      <section aria-label="Cualidades" className="wrap pb-6 sm:pb-10">
        <div className="hairline" />
        <ul className="grid gap-x-8 gap-y-6 py-8 sm:grid-cols-2 lg:grid-cols-4">
          {qualities.map((q, i) => (
            <li key={q.title} className="flex gap-4" data-reveal style={{ ["--reveal-delay" as string]: `${i * 70}ms` }}>
              <span className="font-display text-sm tabular-nums text-ink-3">0{i + 1}</span>
              <div>
                <h2 className="text-[0.72rem] font-semibold uppercase tracking-[0.2em]">{q.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{q.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="hairline" />
      </section>

      {/* Materiales */}
      <section aria-labelledby="materiales" className="wrap py-16 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.6fr] lg:items-end lg:gap-14">
          <div data-reveal>
            <p className="eyebrow">Materiales</p>
            <h2 id="materiales" className="display-lg mt-4">
              La textura hace al mueble.
            </h2>
            <p className="lead mt-5">
              Cada terminación es una foto de alta resolución con su relieve y su brillo, puesta a escala real: la veta de una puerta de dos metros no es la de un cajón.
            </p>
            <p className="mt-4 leading-relaxed text-ink-2">Sumamos las de tu catálogo: chapas, melaminas, laqueados, telas, cueros o piedras. Las que ves acá ya están en el motor.</p>
          </div>
          <div className="grid grid-cols-4 gap-2.5 sm:gap-3.5">
            {materials.map((m, i) => (
              <div
                key={m.name}
                className="material-tile"
                data-reveal
                style={{ ["--reveal-delay" as string]: `${(i % 4) * 60}ms`, backgroundImage: `url(${m.src})`, backgroundPosition: "center", ...m.style }}
              >
                <span>{m.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Experiencia interactiva */}
      <section aria-labelledby="experiencia" className="wrap py-16 sm:py-24">
        <div className="max-w-3xl" data-reveal>
          <p className="eyebrow">Experiencia interactiva</p>
          <h2 id="experiencia" className="display-lg mt-4">
            Cada cambio se ve al instante.
          </h2>
          <p className="lead mt-5">Tu cliente mueve una medida, cambia un material o prende las luces, y el producto responde en tiempo real.</p>
        </div>
        <div className="mt-10 sm:mt-14" data-reveal>
          <Highlights />
        </div>
      </section>

      {/* Configuradores disponibles */}
      <section aria-labelledby="configuradores" className="wrap py-16 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6" data-reveal>
          <div className="max-w-3xl">
            <p className="eyebrow">Configuradores</p>
            <h2 id="configuradores" className="display-lg mt-4">
              Un configurador para cada familia de producto.
            </h2>
            <p className="lead mt-5">Siete familias para probar ahora mismo. Todas corren sobre el mismo motor: cambian las medidas y las reglas, no el sistema.</p>
          </div>
          <Link href="/configuradores/" className="link-arrow">
            Ver todos
          </Link>
        </div>
        <div className="mt-10 grid gap-4 sm:mt-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {FAMILIES.map((family, i) => (
            <div
              key={family.id}
              data-reveal
              style={{ ["--reveal-delay" as string]: `${(i % 3) * 70}ms` }}
              className={i === 0 ? "sm:col-span-2 lg:row-span-2" : undefined}
            >
              <FamilyCard family={family} featured={i === 0} placement="landing-familias" />
            </div>
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
