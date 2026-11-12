import type { ReactNode } from "react";

/** cabecera de una página interior: de qué se trata, en grande, y qué hacer */
export function PageHero({ eyebrow, title, lead, children }: { eyebrow: string; title: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  return (
    <section className="wrap pb-10 pt-12 sm:pb-14 sm:pt-20">
      <div className="max-w-3xl">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display-lg mt-4">{title}</h1>
        {lead && <p className="lead mt-5">{lead}</p>}
        {children && <div className="mt-8 flex flex-wrap items-center gap-3">{children}</div>}
      </div>
    </section>
  );
}
