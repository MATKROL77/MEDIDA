import Link from "next/link";

import { ContactLink } from "@/components/site/ContactLink";
import type { Family } from "@/lib/families";
import { familyMessage } from "@/lib/site";

import { FamilyDrawing } from "./FamilyDrawing";

/**
 * Tarjeta de una familia de producto. La que tiene demo lleva una imagen real
 * del configurador y entra a probarlo; las que están en desarrollo llevan un
 * esquema y lo dicen.
 */
export function FamilyCard({ family, featured = false, placement }: { family: Family; featured?: boolean; placement: string }) {
  if (family.status === "demo" && family.href) {
    return (
      <Link
        href={family.href}
        className="group tile relative flex h-full flex-col overflow-hidden transition-shadow duration-500 hover:shadow-[0_20px_60px_rgb(17_18_20/0.10)]"
      >
        <div className={`relative overflow-hidden ${featured ? "aspect-[4/3] lg:aspect-auto lg:flex-1" : "aspect-[4/3]"}`}>
          <img
            src={`/img/familia-${family.id}.webp`}
            alt={`Configurador de ${family.name.toLowerCase()} con el mueble abierto y las luces prendidas`}
            width={1400}
            height={1050}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.03]"
          />
        </div>
        <div className="flex flex-col gap-3 p-6 sm:p-7">
          <span className="badge badge-live self-start">Demo funcionando</span>
          <h3 className={`font-display font-semibold tracking-tight ${featured ? "text-2xl sm:text-3xl" : "text-xl"}`}>{family.name}</h3>
          <p className="max-w-xl text-[0.95rem] leading-relaxed text-ink-2">{family.summary}</p>
          <span className="link-arrow mt-1">Probar el configurador</span>
        </div>
      </Link>
    );
  }

  return (
    <article className="tile flex h-full flex-col overflow-hidden">
      <div className="grid aspect-[4/3] place-items-center px-6 pt-6">
        <FamilyDrawing id={family.id} className="h-full w-full max-w-[19rem]" />
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-6">
        <span className="badge badge-dev self-start">En desarrollo</span>
        <h3 className="font-display text-xl font-semibold tracking-tight">{family.name}</h3>
        <p className="text-[0.95rem] leading-relaxed text-ink-2">{family.summary}</p>
        <ContactLink channel="whatsapp" interest="configurador" message={familyMessage(family.name)} placement={placement} className="link-arrow mt-auto pt-2">
          Consultar por este configurador
        </ContactLink>
      </div>
    </article>
  );
}
