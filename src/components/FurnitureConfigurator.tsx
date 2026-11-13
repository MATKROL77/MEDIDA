"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { IconBulb, IconDoor, IconExplode, IconFront, IconThree } from "@/components/icons";
import { OtherConfigurators } from "@/components/OtherConfigurators";
import { SendSheet } from "@/components/SendSheet";
import { Dimension, Section, Segmented, Stepper, Swatches, Toggle, useAnimatedNumber } from "@/components/controls";
import { SaveSheet, type SaveChoice } from "@/components/designs/SaveSheet";
import { IconCheck, IconClose, IconDecor, IconHeart } from "@/components/site/icons";
import { Logo } from "@/components/site/Logo";
import { FLOORS, WALL_COLORS, type FloorType } from "@/components/viewer/constants";
import { PhotoBadge, PhotoToggle, usePhotoMode } from "@/components/PhotoControls";
import type { ViewName } from "@/components/viewer/Scene";
import { fromBase64Url, toBase64Url } from "@/lib/base64url";
import { undressed } from "@/lib/decor";
import { addDesign, clearDraft, getDesign, nextName, readDraft, updateDesign, useDesigns, writeDraft } from "@/lib/designStore";
import { fabricStyle } from "@/lib/swatch";
import { FABRICS, buildFurniture, defaultFurniture, fabricById, furniturePrice, hasLed, furnitureSummary, normalizeFurniture, specById, type FurnitureConfig, type Value } from "@/lib/furniture";
import { DEFAULT_CONFIG, type WardrobeConfig } from "@/lib/model";
import { shrinkImage } from "@/lib/preview";
import { currentQuery, rememberQuery } from "@/lib/query";
import { cutList, money } from "@/lib/quote";

const Viewer3D = dynamic(() => import("@/components/viewer/Scene"), { ssr: false, loading: () => null });

const encode = (c: FurnitureConfig) => toBase64Url(JSON.stringify(c));
function decode(value: string | null, family: string): FurnitureConfig | null {
  if (!value) return null;
  try {
    const c = normalizeFurniture(JSON.parse(fromBase64Url(value)));
    return c.family === family ? c : null;
  } catch {
    return null;
  }
}

type Toast = { text: string; href?: string; hrefLabel?: string; action?: { label: string; run: () => void } };

/**
 * El configurador de las familias que se arman con parámetros (mesas,
 * ratonas, muebles de TV, bibliotecas, sillones). Los controles salen de la
 * descripción de cada familia; el 3D es el mismo del placard.
 */
export default function FurnitureConfigurator({ family }: { family: string }) {
  const spec = specById(family)!;
  const [config, setConfig] = useState<FurnitureConfig>(() => defaultFurniture(family));
  const [open, setOpen] = useState(false);
  const [explode, setExplode] = useState(false);
  const [lights, setLights] = useState(false);
  const photo = usePhotoMode();
  // la alfombra, la tele, las lámparas: se pueden sacar para ver el mueble solo
  const [deco, setDeco] = useState(true);
  const [view, setView] = useState<{ name: ViewName; nonce: number }>({ name: "three", nonce: 0 });
  const [environment, setEnvironment] = useState<{ mode: "room" | "studio"; wall: string; floor: FloorType }>({ mode: "room", wall: WALL_COLORS[0].hex, floor: "cemento" });
  const [ready, setReady] = useState(false);
  const [designId, setDesignId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const captureRef = useRef<(() => Promise<string | null>) | null>(null);
  const designs = useDesigns().designs;
  const saved = designs.find((d) => d.id === designId) ?? null;

  useEffect(() => {
    const q = new URLSearchParams(currentQuery());
    const stored = getDesign(q.get("id") ?? "");
    const fromUrl = decode(q.get("c"), family);
    if (stored && stored.type === family) {
      setConfig(normalizeFurniture(stored.config));
      setDesignId(stored.id);
    } else if (fromUrl) setConfig(fromUrl);
    else if (q.get("nuevo") !== "1") {
      const draft = readDraft<FurnitureConfig>(family);
      const restored = draft ? normalizeFurniture(draft.config) : null;
      if (restored && restored.family === family && JSON.stringify(restored) !== JSON.stringify(defaultFurniture(family))) {
        setConfig(restored);
        setToast({ text: "Recuperamos el diseño que estabas armando.", action: { label: "Empezar de cero", run: () => (clearDraft(family), setConfig(defaultFurniture(family))) } });
      }
    }
    setLoaded(true);
  }, [family]);

  const build = useMemo(() => buildFurniture(config), [config]);
  const price = useMemo(() => furniturePrice(config, build), [config, build]);
  const summary = useMemo(() => furnitureSummary(config, build), [config, build]);
  const shownPrice = useAnimatedNumber(price);
  // lo que no se puede elegir con lo que ya está elegido, y por qué
  const locked = useMemo(() => spec.locks?.(config.values) ?? {}, [spec, config.values]);
  const shown = useMemo(() => (deco ? build.assembly : undressed(build.assembly)), [deco, build.assembly]);
  const movable = build.doors + build.drawers > 0;

  // el 3D del placard pide una configuración de placard: se le pasa lo que mira (terminaciones y si hay puertas)
  const look = useMemo<WardrobeConfig>(
    () => ({ ...DEFAULT_CONFIG, doors: build.doors ? "hinged" : "none", bodyMaterial: config.body, doorMaterial: config.front, led: { ...DEFAULT_CONFIG.led, sensor: false } }),
    [build.doors, config.body, config.front],
  );

  const capturePreview = async (wait = 1500) => {
    const shot = captureRef.current ? await Promise.race([captureRef.current(), new Promise<null>((r) => setTimeout(() => r(null), wait))]) : null;
    return shot ? shrinkImage(shot) : null;
  };

  // guardado automático: dirección, borrador y, si se edita un diseño guardado, el diseño
  useEffect(() => {
    if (!loaded) return;
    const id = setTimeout(() => {
      rememberQuery(`?${designId ? `id=${designId}&` : ""}c=${encode(config)}`);
      writeDraft(family, config);
      const current = designId ? getDesign(designId) : null;
      if (current && JSON.stringify(current.config) !== JSON.stringify(config)) updateDesign(current.id, { config, summary, price });
    }, 350);
    return () => clearTimeout(id);
    // summary y price salen de config
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, designId, loaded, family]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(id);
  }, [toast]);

  const set = (key: string, value: Value) => {
    setConfig((c) => normalizeFurniture({ ...c, values: { ...c.values, [key]: value } }));
    // al sumar la luz, se prende: así se ve lo que se acaba de agregar
    if (key === "led") setLights(value === true);
  };
  const goView = (name: ViewName) => setView((v) => ({ name, nonce: v.nonce + 1 }));

  const save = async ({ name, favorite, cart }: SaveChoice) => {
    const preview = await capturePreview(4000);
    const data = { name, favorite, cart, config, summary, price };
    if (saved) updateDesign(saved.id, { ...data, preview: preview ?? saved.preview });
    else setDesignId(addDesign({ type: family, ...data, preview }).id);
    setSaveOpen(false);
    setToast({ text: cart ? "Agregado a tu carrito de consulta." : "Guardado en tus favoritos.", href: "/mis-disenos/", hrefLabel: "Ver mis diseños" });
  };

  const link = typeof window === "undefined" ? "" : `${window.location.origin}/demo/${family}/?c=${encode(config)}`;
  const message = [`Hola, armé este mueble a medida en la web:`, "", `${spec.label} · ${summary.dimensions}`, ...summary.lines, `Precio estimado: ${money(price)}`, "Valores orientativos de muestra; el fabricante debe validar medidas y costos.", "", `Mi diseño: ${link}`].join("\n");

  return (
    <div className="lg:grid lg:h-dvh lg:grid-cols-[minmax(0,1fr)_440px]">
      <section className="sticky top-0 z-20 h-[max(46dvh,300px)] overflow-hidden bg-[#f0efed] lg:relative lg:z-auto lg:h-full">
        <div className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}>
          <Viewer3D
            config={look}
            assembly={shown}
            selection={null}
            onSelect={() => {}}
            open={open}
            leafOffsets={{}}
            xray={false}
            explode={explode}
            lights={lights && hasLed(config)}
            environment={environment}
            view={view}
            fabric={fabricById(config.fabric).color}
            weave={fabricById(config.fabric).weave}
            confine
            onReady={() => setTimeout(() => setReady(true), 120)}
            captureRef={captureRef}
            photo={photo.on}
            onPhoto={photo.onStatus}
          />
        </div>
        <PhotoBadge status={photo.status} />

        <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3 sm:p-4">
          <div className="flex flex-col items-start">
          <Link href="/" className="glass pointer-events-auto rounded-2xl px-4 py-2.5" aria-label="MEDIDA, volver al inicio">
            <Logo />
            <p className="mt-0.5 text-xs text-ink-2">{spec.title}</p>
          </Link>
            <button
              type="button"
              aria-pressed={deco}
              onClick={() => setDeco((d) => !d)}
              className="glass pointer-events-auto mt-2 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
              title={deco ? "Sacar la decoración" : "Mostrar la decoración"}
            >
              <IconDecor width={15} height={15} />
              {deco ? "Con decoración" : "Sin decoración"}
            </button>
          </div>
          <Link href="/mis-disenos/" className="glass pointer-events-auto flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium">
            <IconHeart width={17} height={17} />
            <span className="hidden sm:inline">Mis diseños</span>
            {designs.length > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-ink px-1.5 text-[0.68rem] font-semibold leading-5 text-on-dark">{designs.length}</span>}
          </Link>
        </header>

        <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center px-3">
          <div className="toolbar max-w-full overflow-x-auto [scrollbar-width:none]">
            {(
              [
                ["front", "Frente", IconFront],
                ["three", "3/4", IconThree],
              ] as const
            ).map(([id, label, Icon]) => (
              <button key={id} type="button" className="tool px-2.5" title={`Vista ${label.toLowerCase()}`} aria-label={`Vista ${label.toLowerCase()}`} onClick={() => goView(id)}>
                <Icon />
              </button>
            ))}
            <span className="tool-sep shrink-0" />
            {movable && (
              <button type="button" className="tool" aria-pressed={open} onClick={() => setOpen((o) => !o)}>
                <IconDoor />
                <span>{open ? "Cerrar" : "Abrir"}</span>
              </button>
            )}
            {hasLed(config) && (
              <button type="button" className="tool" aria-pressed={lights} onClick={() => setLights((l) => !l)} title="Encender las luces">
                <IconBulb />
                <span>Luces</span>
              </button>
            )}
            <PhotoToggle on={photo.on} toggle={photo.toggle} />
            <button type="button" className="tool" aria-pressed={explode} onClick={() => setExplode((x) => !x)} title="Separar las piezas">
              <IconExplode />
              <span className="hidden sm:inline">Explotar</span>
            </button>
          </div>
        </div>
      </section>

      <aside className="flex flex-col border-line bg-surface lg:min-h-0 lg:border-l">
        <div className="flex-1 space-y-8 overflow-y-auto px-5 pb-28 pt-6 lg:pb-8">
          <Section title={spec.title} hint={summary.dimensions}>
            {spec.controls.map((c) => {
              const v = config.values[c.key];
              const why = locked[c.key];
              if (c.type === "size") return <Dimension key={c.key} label={c.label} value={v as number} min={c.min} max={c.max} onChange={(mm) => set(c.key, mm)} />;
              if (c.type === "count") return <Stepper key={c.key} label={c.label} value={v as number} min={c.min} max={c.max} onChange={(n) => set(c.key, n)} />;
              if (c.type === "toggle") return <Toggle key={c.key} label={c.label} hint={why ?? c.hint} disabled={!!why} checked={v as boolean} onChange={(on) => set(c.key, on)} />;
              const reasons = [...new Set(c.options.map((o) => locked[`${c.key}:${o.id}`]).filter(Boolean))];
              return (
                <div key={c.key} className="space-y-2">
                  <p className="text-sm">{c.label}</p>
                  <Segmented
                    value={v as string}
                    options={c.options.map((o) => ({ ...o, disabled: !!locked[`${c.key}:${o.id}`], title: locked[`${c.key}:${o.id}`] }))}
                    onChange={(id) => set(c.key, id)}
                    size={c.options.length > 3 ? "sm" : "md"}
                  />
                  {reasons.length > 0 && <p className="text-xs text-ink-2">{reasons.join(". ")}.</p>}
                </div>
              );
            })}
          </Section>

          <Section title="Terminaciones">
            {spec.upholstered && (
              <div className="space-y-2.5">
                <p className="text-sm">
                  Tapizado: <span className="text-ink-2">{fabricById(config.fabric).name}</span>
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {FABRICS.map((f) => (
                    <button key={f.id} type="button" title={f.name} aria-label={`Tapizado ${f.name}`} aria-pressed={config.fabric === f.id} onClick={() => setConfig((c) => ({ ...c, fabric: f.id }))} className={`swatch size-10 rounded-full border-2 ${config.fabric === f.id ? "border-wood" : "border-surface ring-1 ring-line"}`} style={fabricStyle(f)} />
                  ))}
                </div>
              </div>
            )}
            <Swatches label={spec.bodyLabel} value={config.body} onChange={(body) => setConfig((c) => ({ ...c, body }))} />
            {spec.frontLabel && <Swatches label={spec.frontLabel} value={config.front} onChange={(front) => setConfig((c) => ({ ...c, front }))} />}
          </Section>

          <Section title="Tu ambiente" hint="Solo para imaginarlo: no cambia el precio">
            <Segmented value={environment.mode} options={[{ id: "room", label: "Showroom" }, { id: "studio", label: "Fondo liso" }]} onChange={(mode) => setEnvironment((e) => ({ ...e, mode }))} />
            {environment.mode === "room" && (
              <div className="fade-in flex flex-wrap gap-2.5">
                {WALL_COLORS.map((w) => (
                  <button key={w.id} type="button" title={w.name} aria-label={`Pared ${w.name.toLowerCase()}`} aria-pressed={environment.wall === w.hex} onClick={() => setEnvironment((e) => ({ ...e, wall: w.hex }))} className={`swatch size-9 rounded-full border-2 ${environment.wall === w.hex ? "border-ink" : "border-surface ring-1 ring-line"}`} style={{ background: w.hex }} />
                ))}
                {FLOORS.map((f) => (
                  <button key={f.id} type="button" title={f.name} aria-label={`Piso ${f.name.toLowerCase()}`} aria-pressed={environment.floor === f.id} onClick={() => setEnvironment((e) => ({ ...e, floor: f.id }))} className={`swatch size-9 rounded-lg border-2 ${environment.floor === f.id ? "border-ink" : "border-surface ring-1 ring-line"}`} style={{ background: f.swatch }} />
                ))}
              </div>
            )}
          </Section>

          <OtherConfigurators current={family} />
        </div>

        <div className="price-bar fixed inset-x-0 bottom-0 z-30 px-4 py-2.5 lg:static">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-ink-2">Precio estimado</p>
              <p className="font-display text-lg leading-tight tabular-nums">{money(Math.round(shownPrice / 1000) * 1000)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => setSaveOpen(true)} className={`btn btn-sm h-9 px-3 text-[0.8rem] ${saved ? "btn-secondary" : "btn-ghost"}`} aria-label={saved ? "Diseño guardado: cambiar nombre o dónde está" : "Guardar este diseño"}>
                {saved ? <IconCheck /> : <IconHeart />}
                <span className="hidden min-[420px]:inline">{saved ? "Guardado" : "Guardar"}</span>
              </button>
              <button type="button" onClick={() => setSendOpen(true)} className="btn btn-primary btn-sm h-9 px-3.5 text-[0.8rem]">
                Enviar al taller
              </button>
            </div>
          </div>
          <p className="mt-1 text-[10px] leading-snug text-ink-2">Valores orientativos de muestra. El fabricante debe confirmar medidas y costos antes de cotizar.</p>
        </div>
      </aside>

      {sendOpen && (
        <SendSheet workshop={null} title={`${spec.label} a medida`} noPdf summary={summary} price={price} pdf={null} failed={false} rows={cutList(build.parts)} message={message} designLink={link} workshopHref="" onClose={() => setSendOpen(false)} />
      )}
      {saveOpen && <SaveSheet saved={saved} suggestedName={nextName(spec.label)} onSave={save} onClose={() => setSaveOpen(false)} />}
      {toast && (
        <div role="status" className="toast fixed inset-x-3 bottom-28 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-on-dark shadow-xl lg:bottom-6 lg:left-6 lg:right-auto lg:mx-0">
          <span className="flex-1">{toast.text}</span>
          {toast.href && (
            <Link href={toast.href} className="shrink-0 font-semibold underline underline-offset-4">
              {toast.hrefLabel}
            </Link>
          )}
          {toast.action && (
            <button type="button" className="shrink-0 font-semibold underline underline-offset-4" onClick={() => (toast.action!.run(), setToast(null))}>
              {toast.action.label}
            </button>
          )}
          <button type="button" aria-label="Cerrar el aviso" className="-mr-1 grid size-7 shrink-0 place-items-center rounded-full hover:bg-white/15" onClick={() => setToast(null)}>
            <IconClose width={15} height={15} />
          </button>
        </div>
      )}
    </div>
  );
}
