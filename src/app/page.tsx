import Image from "next/image";
import Link from "next/link";

import { product, productWhatsapp } from "@/lib/product";

/**
 * Página para los talleres: qué es el producto y la demo para probarlo.
 * No lleva testimonios, clientes ni números de resultados: todavía no hay, y
 * no se inventan.
 */

const steps = [
  {
    title: "Tu cliente lo arma",
    body: "Elige medidas, módulos, cajones, puertas y colores desde el celular. Lo ve en 3D mientras lo arma.",
  },
  {
    title: "Ve el precio al instante",
    body: "El precio sale de tus placas, tus herrajes y tu margen. Nada de cotizar a ojo ni de esperar dos días.",
  },
  {
    title: "Te llega el pedido",
    body: "Por WhatsApp, con las medidas, el diseño y un link que abre exactamente lo que armó.",
  },
];

const workshop = [
  { title: "Despiece", body: "Cada pieza con largo, ancho, espesor y qué cantos llevan tapacanto. Listo para la seccionadora o para bajar a Excel." },
  { title: "Plano de corte", body: "Cómo acomodar las piezas en cada placa, respetando la veta, y cuántas placas comprar." },
  { title: "Herrajes", body: "Bisagras según el alto de cada puerta, correderas, barrales, perfiles y tiradores, contados uno por uno." },
  { title: "Costo y margen", body: "Cuánto te cuesta ese placard y cuánto te queda, antes de confirmar nada." },
];

const yours = [
  "Tu marca, tus colores y tu WhatsApp",
  "Tus materiales y tus precios de placa",
  "Tu margen y tu mano de obra",
  "En tu web, en tu Instagram o en un link propio",
];

export default function Home() {
  const contact = productWhatsapp(`Hola Matías, vi ${product.name} y quiero ver cómo quedaría para mi taller.`);

  return (
    <main>
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <span className="font-display text-xl font-semibold tracking-tight">{product.name}</span>
        <div className="flex items-center gap-2">
          <Link href="/demo/" className="btn btn-ghost px-4 py-2 text-sm">
            Probar la demo
          </Link>
        </div>
      </nav>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-12">
        <div>
          <p className="eyebrow">Para fabricantes de placares y vestidores</p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            Que tu cliente arme el placard. A vos te llega el despiece.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">{product.pitch}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/demo/" className="btn btn-primary">
              Probar la demo
            </Link>
            <a href={contact} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
              Quiero verlo con mi taller
            </a>
          </div>
        </div>
        <Link href="/demo/" className="group block overflow-hidden rounded-[var(--radius-card)] border border-line shadow-sm">
          <Image
            src="/demo.png"
            alt="El configurador con un placard de tres módulos y el precio estimado"
            width={1440}
            height={900}
            priority
            className="transition-transform duration-500 group-hover:scale-[1.02]"
          />
        </Link>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="eyebrow">El problema</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">Cotizar a medida se come el día</h2>
          </div>
          <p className="text-lg leading-relaxed text-ink-2">
            El cliente manda una foto con un metro, después las medidas, después pregunta si se puede con cajones. Vos armás el
            presupuesto a mano, lo mandás dos días después y para entonces ya le pidió precio a otro. Y cuando por fin confirma,
            hay que pasar todo a una lista de cortes.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="eyebrow">Cómo funciona</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <article key={s.title} className="card p-6">
              <span className="grid size-8 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent-strong">
                {i + 1}
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-ink-2">{s.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="card grid gap-10 p-6 sm:p-10 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <p className="eyebrow">Lo que recibe el taller</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">El pedido ya viene listo para producir</h2>
            <p className="mt-4 leading-relaxed text-ink-2">
              El 3D y el despiece salen del mismo cálculo: lo que el cliente ve es exactamente lo que se corta.
            </p>
            <Link href="/demo/taller/" className="mt-6 inline-block font-medium text-accent underline-offset-4 hover:underline">
              Ver una orden de ejemplo →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {workshop.map((w) => (
              <div key={w.title} className="rounded-2xl bg-paper p-5">
                <h3 className="font-semibold">{w.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{w.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Hecho para tu taller</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">Se configura con lo que ya usás</h2>
          </div>
          <ul className="space-y-3">
            {yours.map((y) => (
              <li key={y} className="flex items-center gap-3 text-lg">
                <span className="size-2 shrink-0 rounded-full bg-accent" aria-hidden />
                {y}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-ink text-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 py-14 sm:px-6">
          <h2 className="max-w-xl font-display text-3xl font-semibold tracking-tight">
            Armamos una versión con tus productos y tus precios para que la pruebes.
          </h2>
          <a href={contact} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp">
            Escribime por WhatsApp
          </a>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-8 text-sm text-ink-2 sm:px-6">
        <span>
          {product.name} · hecho por {product.maker}, {product.makerCity}
        </span>
        <a href={`mailto:${product.email}`} className="hover:text-ink">
          {product.email}
        </a>
      </footer>
    </main>
  );
}
