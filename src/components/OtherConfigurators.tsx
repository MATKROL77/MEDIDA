import Link from "next/link";

import { FAMILIES, RECOMMENDED } from "@/lib/families";

/** al pie de cada configurador: los otros que se pueden probar, para seguir mirando */
export function OtherConfigurators({ current }: { current: string }) {
  const rank = (id: string) => (RECOMMENDED.includes(id) ? RECOMMENDED.indexOf(id) : RECOMMENDED.length);
  const others = FAMILIES.filter((f) => f.status === "demo" && f.href && f.id !== current).sort((a, b) => rank(a.id) - rank(b.id));
  return (
    <section aria-label="Otros configuradores" className="space-y-3">
      <h2 className="eyebrow">Probá también</h2>
      <ul className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        {others.map((f) => (
          <li key={f.id} className="w-36 shrink-0">
            <Link href={f.href!} className="group block">
              <span className="block aspect-[4/3] overflow-hidden rounded-xl bg-paper">
                <img src={`/img/familia-${f.id}.webp`} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </span>
              <span className="mt-2 block text-xs font-medium leading-snug group-hover:text-accent">{f.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
