"use client";

import { useEffect, useState } from "react";

import Configurator from "@/components/Configurator";
import { api } from "@/lib/api";
import { catalog, configureCatalog, type CatalogOverrides } from "@/lib/catalog";
import { DEFAULT_CONFIG, normalize, type WardrobeConfig } from "@/lib/model";
import { designSummary } from "@/lib/share";
import type { Workshop } from "@/lib/workshop";

type Embed = {
  tenant: { name: string; whatsapp: string; email: string; tagline: string };
  configurator: { id: string; name: string; family: string; params: CatalogOverrides };
};

/**
 * El configurador de una empresa, para mostrar dentro de su página
 * (/embed/?t=<empresa>). Lleva su marca, sus terminaciones y sus precios, y
 * "Enviar al taller" le escribe a esa empresa, no a MEDIDA.
 */
export default function EmbedConfigurator() {
  const [state, setState] = useState<{ workshop: Workshop; initial: WardrobeConfig; slug: string; id: string } | "cargando" | "no_disponible">("cargando");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const slug = q.get("t") ?? "";
    const k = q.get("k");
    api<Embed>(`/api/public/embed?t=${encodeURIComponent(slug)}${k ? `&k=${encodeURIComponent(k)}` : ""}`)
      .then(({ tenant, configurator }) => {
        configureCatalog({ ...configurator.params, brandName: tenant.name, tagline: tenant.tagline || configurator.name });
        const first = catalog.materials[0].id;
        const has = (id: string) => catalog.materials.some((m) => m.id === id);
        // si la empresa no ofrece las terminaciones de partida, arranca con las suyas
        const initial = normalize({ ...DEFAULT_CONFIG, bodyMaterial: has(DEFAULT_CONFIG.bodyMaterial) ? DEFAULT_CONFIG.bodyMaterial : first, doorMaterial: has(DEFAULT_CONFIG.doorMaterial) ? DEFAULT_CONFIG.doorMaterial : first });
        setState({ workshop: { name: tenant.name, whatsapp: tenant.whatsapp, email: tenant.email || undefined }, initial, slug, id: configurator.id });
      })
      .catch(() => setState("no_disponible"));
  }, []);

  if (state === "cargando") return <div className="shimmer h-dvh" role="status" aria-label="Cargando el configurador" />;
  if (state === "no_disponible") {
    return (
      <main className="grid h-dvh place-items-center px-6 text-center">
        <div>
          <h1 className="display-md">Este configurador no está disponible.</h1>
          <p className="mt-3 text-ink-2">Puede que la dirección esté mal escrita o que la empresa lo haya pausado.</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <Configurator
        workshop={state.workshop}
        initial={state.initial}
        onInquiry={(channel, config, price) => {
          // queda registrada para la empresa: qué diseño consultaron y por dónde
          void api("/api/public/inquiries", { body: { t: state.slug, k: state.id, channel, config, summary: designSummary(config), price }, keepalive: true }).catch(() => {});
        }}
      />
      <a href="https://medida.matiascolimodio.workers.dev" target="_blank" rel="noopener noreferrer" className="fixed bottom-1 left-2 z-40 hidden text-[10px] text-ink-3 hover:text-ink lg:block">
        Hecho con MEDIDA
      </a>
    </>
  );
}
