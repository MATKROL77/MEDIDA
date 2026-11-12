import type { ReactNode } from "react";

/** fecha de la última revisión de los textos legales */
export const LEGAL_UPDATED = "12 de noviembre de 2026";

export function LegalPage({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <article className="wrap pb-20 pt-12 sm:pb-28 sm:pt-20">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">Legales</p>
        <h1 className="display-lg mt-4">{title}</h1>
        <p className="lead mt-5">{lead}</p>
        <p className="mt-4 text-sm text-ink-3">Última actualización: {LEGAL_UPDATED}</p>
        <div className="prose mt-10">{children}</div>
      </div>
    </article>
  );
}
