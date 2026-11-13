import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContactLink } from "@/components/site/ContactLink";
import { IconMail, IconWhatsapp } from "@/components/site/icons";
import { PageHero } from "@/components/site/PageHero";
import { SERVICES, serviceBySlug } from "@/lib/services";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return SERVICES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const service = serviceBySlug((await params).slug);
  if (!service) return {};
  return { title: service.title, description: service.summary, alternates: { canonical: `/servicios/${service.slug}/` } };
}

export default async function ServicePage({ params }: Props) {
  const service = serviceBySlug((await params).slug);
  if (!service) notFound();
  const others = SERVICES.filter((s) => s.slug !== service.slug);

  return (
    <>
      <PageHero eyebrow="Para empresas" title={service.title} lead={service.summary}>
        <ContactLink channel="whatsapp" interest={service.interest} placement={`servicio-${service.slug}`} className="btn btn-primary">
          <IconWhatsapp />
          Consultar por WhatsApp
        </ContactLink>
        <ContactLink channel="email" interest={service.interest} placement={`servicio-${service.slug}`} className="btn btn-secondary">
          <IconMail />
          Consultar por email
        </ContactLink>
      </PageHero>

      <section className="wrap pb-16 sm:pb-20">
        <p className="max-w-3xl text-lg leading-relaxed text-ink-2">{service.audience}</p>

        <h2 className="display-md mt-14">Qué incluye</h2>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          {service.includes.map((item) => (
            <div key={item.title} className="tile p-7" data-reveal>
              <dt className="font-display text-lg font-semibold tracking-tight">{item.title}</dt>
              <dd className="mt-2 leading-relaxed text-ink-2">{item.body}</dd>
            </div>
          ))}
        </dl>

        <h2 className="display-md mt-16">Cómo se trabaja</h2>
        <ol className="mt-6 grid gap-x-6 gap-y-8 sm:grid-cols-3">
          {service.steps.map((step, i) => (
            <li key={step.title} data-reveal style={{ ["--reveal-delay" as string]: `${i * 80}ms` }}>
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink font-display text-sm font-semibold text-on-dark">{i + 1}</span>
                {i < service.steps.length - 1 && <span className="hidden h-px flex-1 bg-line sm:block" aria-hidden />}
              </div>
              <h3 className="mt-5 font-display text-xl font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{step.body}</p>
            </li>
          ))}
        </ol>

        <h2 className="display-md mt-16">Para tener en cuenta</h2>
        <ul className="mt-5 max-w-3xl space-y-3">
          {service.notes.map((note) => (
            <li key={note} className="flex gap-3 leading-relaxed text-ink-2">
              <span className="mt-[0.6rem] size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              {note}
            </li>
          ))}
          <li className="flex gap-3 leading-relaxed text-ink-2">
            <span className="mt-[0.6rem] size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
            El alcance, el precio y los plazos salen de una propuesta para tu caso: no hay una lista de precios publicada.
          </li>
        </ul>
      </section>

      <section className="bg-paper py-14 sm:py-20">
        <div className="wrap">
          <h2 className="display-md">Los otros servicios</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {others.map((other) => (
              <Link key={other.slug} href={`/servicios/${other.slug}/`} className="group rounded-[var(--radius-tile)] bg-surface p-7 transition-shadow duration-500 hover:shadow-[0_20px_60px_rgb(17_18_20/0.08)]">
                <h3 className="font-display text-xl font-semibold tracking-tight">{other.title}</h3>
                <p className="mt-2 leading-relaxed text-ink-2">{other.summary}</p>
                <span className="link-arrow mt-4">Ver el servicio</span>
              </Link>
            ))}
          </div>
          <p className="mt-10 text-ink-2">
            ¿Querés verlo andando antes de consultar?{" "}
            <Link href="/configuradores/" className="link-arrow">
              Probá un configurador
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
