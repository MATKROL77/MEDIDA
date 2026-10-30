"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  IconBack,
  IconBulb,
  IconDoor,
  IconExplode,
  IconFront,
  IconSide,
  IconThree,
  IconTop,
  IconXray,
} from "@/components/icons";
import { LayoutIcon } from "@/components/LayoutIcon";
import { Poster } from "@/components/Poster";
import { Watermark, WatermarkNote } from "@/components/Watermark";
import { Dimension, OptionCard, Section, Segmented, Stepper, Swatches, Toggle, useAnimatedNumber } from "@/components/controls";
import { FLOORS, WALL_COLORS, type FloorType } from "@/components/viewer/constants";
import type { ViewName } from "@/components/viewer/Scene";
import { catalog, type HandleType } from "@/lib/catalog";
import {
  DEFAULT_CONFIG,
  DOOR_STYLE_LABELS,
  LAYOUT_LABELS,
  LED_COLORS,
  LIMITS,
  hasLeds,
  innerAvailable,
  layoutFits,
  moduleInterior,
  moduleMin,
  normalize,
  allowsDrawers,
  cornerPair,
  runSpan,
  validModuleCounts,
  withModuleCount,
  withModuleWidth,
  type DoorStyle,
  type DoorType,
  type LedColor,
  type Layout,
  type ModuleConfig,
  type Shape,
  type WardrobeConfig,
} from "@/lib/model";
import { EMBEDDED, currentQuery, rememberQuery } from "@/lib/embed";
import { drawerGroupsOf, leavesOf, openOffsets, toggleLeaf } from "@/lib/motion";
import { buildOrderPdf, type OrderPdf } from "@/lib/orderPdf";
import { money, quote, summaryByTitle } from "@/lib/quote";
import { decodeConfig, encodeConfig, orderMessage, whatsappLink } from "@/lib/share";

type Tab = "forma" | "interior" | "frentes" | "luz" | "color";
const TABS: { id: Tab; label: string }[] = [
  { id: "forma", label: "Forma" },
  { id: "interior", label: "Interior" },
  { id: "frentes", label: "Frentes" },
  { id: "luz", label: "Luz" },
  { id: "color", label: "Color" },
];

const LAYOUTS = Object.keys(LAYOUT_LABELS) as Layout[];
const RGB_PRESETS = ["#ff3b30", "#ff2d92", "#a64dff", "#3b6cff", "#00c2ff", "#21d07a", "#ffb000"];

function shareLink(config: WardrobeConfig, path = "/demo/") {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}${path}?c=${encodeConfig(config)}`;
}

export default function Configurator() {
  const [config, setConfig] = useState<WardrobeConfig>(DEFAULT_CONFIG);
  const [tab, setTab] = useState<Tab>("forma");
  const [selection, setSelection] = useState({ run: 0, module: 0 });
  const [open, setOpen] = useState(false);
  const [xray, setXray] = useState(false);
  const [explode, setExplode] = useState(false);
  const [lights, setLights] = useState(false);
  const [environment, setEnvironment] = useState<{ mode: "room" | "studio"; wall: string; floor: FloorType }>({
    mode: "room",
    wall: WALL_COLORS[0].hex,
    floor: "madera",
  });
  const captureRef = useRef<(() => Promise<string | null>) | null>(null);
  const [sheet, setSheet] = useState<{ open: boolean; pdf: OrderPdf | null; failed: boolean }>({ open: false, pdf: null, failed: false });
  const [view, setView] = useState<{ name: ViewName; nonce: number }>({ name: "three", nonce: 0 });
  const [ready, setReady] = useState(false);

  // un link compartido abre el placard que armó el cliente
  useEffect(() => {
    const fromUrl = decodeConfig(new URLSearchParams(currentQuery()).get("c"));
    if (fromUrl) setConfig(fromUrl);
  }, []);

  // la barra de direcciones siempre reproduce lo que se ve, por si la copian
  useEffect(() => {
    const id = setTimeout(() => rememberQuery(`?c=${encodeConfig(config)}`), 300);
    return () => clearTimeout(id);
  }, [config]);

  const result = useMemo(() => quote(config), [config]);

  // corredizas: dónde dejó cada hoja el cliente; se vuelve a empezar si cambian las hojas
  const leaves = useMemo(() => leavesOf(result.assembly), [result.assembly]);
  const leafKey = leaves.map((l) => `${l.id}:${Math.round(l.home)}:${Math.round(l.width)}`).join("|");
  const [leafOffsets, setLeafOffsets] = useState<Record<string, number>>({});
  useEffect(() => {
    setLeafOffsets(open && leaves.length ? openOffsets(leaves, drawerGroupsOf(result.assembly)) : {});
    // sólo cuando cambian las hojas, no cada vez que se abre
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafKey]);
  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    setLeafOffsets(next && leaves.length ? openOffsets(leaves, drawerGroupsOf(result.assembly)) : {});
  };
  // tocar una hoja la corre para el otro lado; los cajones que quedan a la vista salen
  const slideLeaf = (id: string) => {
    setLeafOffsets((cur) => toggleLeaf(leaves, open ? cur : {}, id));
    setOpen(true);
  };
  const update = (patch: Partial<WardrobeConfig>) => setConfig((c) => normalize({ ...c, ...patch }));
  const updateModule = (run: number, i: number, patch: Partial<ModuleConfig>) =>
    setConfig((c) => {
      // la esquina de una L es un solo espacio: se edita desde el módulo del frente
      const pair = cornerPair(c);
      const [tr, ti] = pair && run === 1 && i === pair.side ? [0, pair.front] : [run, i];
      return normalize({
        ...c,
        runs: c.runs.map((r, j) => (j === tr ? { ...r, modules: r.modules.map((m, k) => (k === ti ? { ...m, ...patch } : m)) } : r)),
      });
    });
  const updateAllModules = (patch: Partial<ModuleConfig>) =>
    setConfig((c) => normalize({ ...c, runs: c.runs.map((r) => ({ ...r, modules: r.modules.map((m) => ({ ...m, ...patch })) })) }));

  const sel = {
    run: Math.min(selection.run, config.runs.length - 1),
    module: 0,
  };
  sel.module = Math.min(selection.module, config.runs[sel.run].modules.length - 1);
  const run = config.runs[sel.run];
  const mod = run.modules[sel.module];
  const interior = moduleInterior(config, sel.run, sel.module);
  // las corredizas llevan una hoja por módulo: si no entran dos hojas de verdad, no se ofrecen
  const slidingOk = useMemo(() => normalize({ ...config, doors: "sliding" }).doors === "sliding", [config]);
  // con corredizas hay módulos que ninguna combinación de hojas deja libres enteros
  const drawersStuck =
    config.doors === "sliding" &&
    !!result.assembly.runs[sel.run]?.parts.some((p) => p.module === sel.module && p.kind === "drawer-front" && p.drawerBlocked);
  const span = runSpan(config, sel.run, run.width);
  const counts = validModuleCounts(config, sel.run, span);
  const anyDrawers = config.runs.some((r) => r.modules.some((m) => m.drawers > 0));
  const hasHandles = config.doors !== "none" || anyDrawers;
  const lit = hasLeds(config);
  const allLed = (key: "ledShelves" | "ledSides") => config.runs.every((r) => r.modules.every((m) => m[key]));

  // ancho posible para el módulo elegido: lo que dejan los demás en su mínimo
  const n = run.modules.length;
  const avail = innerAvailable(span, n);
  const othersMin = run.modules.reduce((s, _, i) => (i === sel.module ? s : s + moduleMin(config, sel.run, i, n)), 0);
  const othersMax = run.modules.reduce((s, _, i) => (i === sel.module ? s : s + LIMITS.moduleInner.max), 0);
  const modMin = Math.max(moduleMin(config, sel.run, sel.module, n), avail - othersMax);
  const modMax = Math.min(LIMITS.moduleInner.max, avail - othersMin);

  const price = useAnimatedNumber(result.price);
  const message = orderMessage(config, money(result.price), shareLink(config), {
    rows: result.rows,
    workshopLink: shareLink(config, "/demo/taller/"),
  });
  const orderHref = whatsappLink(message);

  // abre la hoja de envío y arma el PDF con una captura del 3D en la tapa
  const openSend = async () => {
    setSheet({ open: true, pdf: null, failed: false });
    try {
      const snapshot = captureRef.current ? await Promise.race([captureRef.current(), new Promise<null>((r) => setTimeout(() => r(null), 1500))]) : null;
      const pdf = await buildOrderPdf(config, result, snapshot);
      setSheet((cur) => (cur.open ? { open: true, pdf, failed: false } : cur));
    } catch {
      setSheet((cur) => (cur.open ? { open: true, pdf: null, failed: true } : cur));
    }
  };

  const selectModule = (r: number, m: number) => {
    setSelection({ run: r, module: m });
    if (tab !== "luz") setTab("interior");
  };
  const goView = (name: ViewName) => setView((v) => ({ name, nonce: v.nonce + 1 }));
  // mientras se edita el interior las puertas se aclaran solas para ver qué cambia
  const editingInside = tab === "interior" || tab === "luz";

  return (
    <div className="lg:grid lg:h-dvh lg:grid-cols-[minmax(0,1fr)_440px]">
      {/* visor: arriba en el teléfono, a la izquierda en pantalla grande. En el
          teléfono queda fijo mientras se recorren las opciones, para ver cada cambio */}
      <section className="sticky top-0 z-20 h-[max(46dvh,300px)] overflow-hidden lg:relative lg:z-auto lg:h-full">
        <Poster config={config} assembly={result.assembly} />
        <div className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}>
          <Viewer3D
            config={config}
            assembly={result.assembly}
            selection={editingInside ? sel : null}
            onSelect={selectModule}
            open={open}
            leafOffsets={leafOffsets}
            onLeaf={slideLeaf}
            xray={xray || (editingInside && !open && config.doors !== "none")}
            explode={explode}
            lights={lights}
            environment={environment}
            view={view}
            onReady={() => setTimeout(() => setReady(true), 120)}
            captureRef={captureRef}
          />
        </div>

        <Watermark />

        <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3 sm:p-4">
          <div className="pointer-events-auto rounded-2xl bg-surface/90 px-4 py-2.5 shadow-sm backdrop-blur">
            <p className="font-display text-base font-semibold leading-tight">{catalog.brand.name}</p>
            <p className="text-xs text-ink-2">{catalog.brand.tagline}</p>
          </div>
          <WatermarkNote className="mt-1 hidden rounded-full bg-surface/70 px-3 py-1.5 backdrop-blur sm:block" />
        </header>

        <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center px-3">
          <div className="toolbar max-w-full overflow-x-auto [scrollbar-width:none]">
            {(
              [
                ["front", "Frente", IconFront],
                ["three", "3/4", IconThree],
                ["side", "Costado", IconSide],
                ["top", "Arriba", IconTop],
                ["back", "Atrás", IconBack],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                // en el teléfono no entran todas: arriba y atrás quedan para pantallas más anchas
                className={`tool px-2.5 ${id === "top" || id === "back" ? "hidden sm:inline-flex" : ""}`}
                title={`Vista ${label.toLowerCase()}`}
                onClick={() => goView(id)}
              >
                <Icon />
                <span className="hidden 2xl:inline">{label}</span>
              </button>
            ))}
            <span className="tool-sep shrink-0" />
            {config.doors !== "none" && (
              <button type="button" className="tool" aria-pressed={open} onClick={toggleOpen} aria-label={open ? "Cerrar" : "Abrir"} title={open ? "Cerrar" : "Abrir"}>
                <IconDoor />
                <span className="hidden sm:inline">{open ? "Cerrar" : "Abrir"}</span>
              </button>
            )}
            {config.doors !== "none" && (
              <button type="button" className="tool" aria-pressed={xray} onClick={() => setXray((x) => !x)} title="Ver adentro sin abrir">
                <IconXray />
                <span className="hidden sm:inline">Ver adentro</span>
              </button>
            )}
            <button type="button" className="tool" aria-pressed={explode} onClick={() => setExplode((x) => !x)} title="Separar las piezas">
              <IconExplode />
              <span className="hidden sm:inline">Explotar</span>
            </button>
            {lit && (
              <button type="button" className="tool" aria-pressed={lights} onClick={() => setLights((l) => !l)} title="Encender las luces">
                <IconBulb />
                <span className="hidden sm:inline">Luces</span>
              </button>
            )}
          </div>
        </div>
      </section>

      <aside className="flex flex-col border-line bg-surface lg:min-h-0 lg:border-l">
        <nav className="sticky top-[max(46dvh,300px)] z-20 flex justify-between lg:top-0 gap-1 border-b border-line bg-surface/95 px-5 backdrop-blur" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="tab" onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>

        <div key={tab} className="fade-in flex-1 space-y-8 overflow-y-auto px-5 pb-36 pt-6 lg:pb-8">
          {tab === "forma" && (
            <>
              <Section title="Forma">
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["straight", "Recto"],
                      ["l-left", "En L, izquierda"],
                      ["l-right", "En L, derecha"],
                    ] as [Shape, string][]
                  ).map(([id, label]) => (
                    <OptionCard
                      key={id}
                      active={config.shape === id}
                      label={label}
                      // al cambiar de forma la esquina pide otro ancho: los módulos se vuelven a repartir parejo
                      onClick={() => update({ shape: id, runs: config.runs.map((r) => ({ ...r, modules: r.modules.map((m) => ({ ...m, width: 0 })) })) })}
                    >
                      <ShapeIcon shape={id} />
                    </OptionCard>
                  ))}
                </div>
              </Section>

              <Section title="Medidas">
                <Dimension
                  label={config.shape === "straight" ? "Ancho" : "Ancho del frente"}
                  value={config.runs[0].width}
                  min={LIMITS.width.min}
                  max={LIMITS.width.max}
                  onChange={(width) => update({ runs: config.runs.map((r, i) => (i === 0 ? { ...r, width } : r)) })}
                />
                {config.shape !== "straight" && (
                  <Dimension
                    label="Ancho del lateral"
                    value={config.runs[1].width}
                    min={config.depth + LIMITS.width.min}
                    max={LIMITS.width.max}
                    onChange={(width) => update({ runs: config.runs.map((r, i) => (i === 1 ? { ...r, width } : r)) })}
                  />
                )}
                <Dimension
                  label={config.slope.enabled ? "Alto (lado alto)" : "Alto"}
                  value={config.height}
                  min={LIMITS.height.min}
                  max={LIMITS.height.max}
                  onChange={(height) => update({ height })}
                />
                <Dimension label="Profundidad" value={config.depth} min={LIMITS.depth.min} max={LIMITS.depth.max} onChange={(depth) => update({ depth })} />
                <Toggle label="Zócalo de 8 cm" checked={config.plinth} onChange={(plinth) => update({ plinth })} />
              </Section>

              <details className="rounded-xl border border-line p-4">
                <summary className="cursor-pointer text-sm font-medium text-ink">
                  Opciones especiales
                  <span className="mt-1 block text-xs font-normal text-ink-2">Altillo, techo inclinado y terminales curvos</span>
                </summary>
                <div className="mt-5 space-y-8">
              <Section title="Altillo">
                <Toggle
                  label="Altillo con puertas arriba"
                  hint={config.slope.enabled ? "No va con techo inclinado" : "Para lo que se usa poco: valijas, mantas"}
                  checked={config.topBox.enabled}
                  disabled={config.slope.enabled}
                  onChange={(enabled) => update({ topBox: { ...config.topBox, enabled } })}
                />
                {config.topBox.enabled && (
                  <Dimension
                    label="Alto del altillo"
                    value={config.topBox.height}
                    min={LIMITS.topBox.min}
                    max={LIMITS.topBox.max}
                    onChange={(height) => update({ topBox: { ...config.topBox, height } })}
                  />
                )}
              </Section>

              <Section title="Techo inclinado">
                <Toggle
                  label="Sigue la pendiente del techo"
                  hint={config.shape !== "straight" ? "Disponible en placares rectos" : "Bajo escalera o buhardilla"}
                  checked={config.slope.enabled}
                  disabled={config.shape !== "straight"}
                  onChange={(enabled) => update({ slope: { ...config.slope, enabled } })}
                />
                {config.slope.enabled && (
                  <>
                    <Segmented
                      value={config.slope.side}
                      options={[
                        { id: "left", label: "Bajo a la izquierda" },
                        { id: "right", label: "Bajo a la derecha" },
                      ]}
                      onChange={(side) => update({ slope: { ...config.slope, side } })}
                    />
                    <Dimension
                      label="Alto del lado bajo"
                      value={config.slope.low}
                      min={LIMITS.slopeLow.min}
                      max={config.height - 100}
                      onChange={(low) => update({ slope: { ...config.slope, low } })}
                    />
                  </>
                )}
              </Section>

              <Section title="Terminales curvos" hint="Estantes abiertos redondeados">
                <Toggle label="A la izquierda" checked={config.curved.left} onChange={(left) => update({ curved: { ...config.curved, left } })} />
                <Toggle label="A la derecha" checked={config.curved.right} onChange={(right) => update({ curved: { ...config.curved, right } })} />
              </Section>
                </div>
              </details>
            </>
          )}

          {tab === "interior" && (
            <>
              {config.runs.length > 1 && (
                <Section title="Tramo">
                  <Segmented
                    value={sel.run}
                    options={[
                      { id: 0, label: "Frente" },
                      { id: 1, label: "Lateral" },
                    ]}
                    onChange={(r) => setSelection({ run: r, module: 0 })}
                  />
                </Section>
              )}

              <Section title="Módulos" hint="Tocá un módulo en el 3D para editarlo">
                <Segmented
                  value={run.modules.length}
                  options={counts.map((c) => ({ id: c, label: c }))}
                  onChange={(c) => {
                    setConfig((cur) => withModuleCount(cur, sel.run, c));
                    setSelection((s) => ({ ...s, module: Math.min(s.module, c - 1) }));
                  }}
                />
                <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${run.modules.length}, minmax(0, 1fr))` }}>
                  {run.modules.map((m, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={i === sel.module}
                      onClick={() => setSelection({ run: sel.run, module: i })}
                      className={`option-card rounded-xl border px-1 py-2 text-xs ${i === sel.module ? "border-accent bg-accent-soft text-accent-strong" : "border-line text-ink-2"}`}
                    >
                      <span className="block font-semibold">{i + 1}</span>
                      <span className="tabular-nums">{Math.round(m.width / 10)} cm</span>
                    </button>
                  ))}
                </div>
              </Section>

              <Section title={`Módulo ${sel.module + 1}`}>
                {!allowsDrawers(config, sel.run, sel.module) && (
                  <p className="text-xs leading-relaxed text-ink-2">
                    Es la esquina: este módulo y el del otro tramo forman un solo espacio, con estantes y barral en L.
                  </p>
                )}
                {n > 1 && modMax > modMin && (
                  <Dimension
                    label="Ancho interior"
                    value={mod.width}
                    min={modMin}
                    max={modMax}
                    onChange={(w) => setConfig((cur) => withModuleWidth(cur, sel.run, sel.module, w))}
                  />
                )}
                <div className="grid grid-cols-5 gap-1.5">
                  {LAYOUTS.map((layout) => {
                    const noDrawers = layout.startsWith("drawers") && !allowsDrawers(config, sel.run, sel.module);
                    const fits = !noDrawers && layoutFits(layout, interior, Math.max(1, mod.drawers));
                    return (
                      <OptionCard
                        key={layout}
                        active={mod.layout === layout}
                        disabled={!fits}
                        title={fits ? LAYOUT_LABELS[layout] : noDrawers ? "En la esquina no van cajones: chocarían con el otro tramo" : "No entra con este alto"}
                        label={LAYOUT_LABELS[layout]}
                        onClick={() =>
                          updateModule(sel.run, sel.module, {
                            layout,
                            drawers: layout.startsWith("drawers") ? Math.max(2, mod.drawers) : 0,
                            shelves: layout === "shelves" || layout === "drawers-shelves" ? Math.max(2, mod.shelves) : mod.shelves,
                          })
                        }
                      >
                        <LayoutIcon layout={layout} />
                      </OptionCard>
                    );
                  })}
                </div>
                {(mod.layout === "shelves" || mod.layout === "drawers-shelves") && (
                  <Stepper
                    label="Estantes"
                    value={mod.shelves}
                    min={mod.layout === "shelves" ? 1 : 0}
                    max={LIMITS.shelves.max}
                    onChange={(shelves) => updateModule(sel.run, sel.module, { shelves })}
                  />
                )}
                {mod.drawers > 0 && (
                  <Stepper label="Cajones" value={mod.drawers} min={1} max={LIMITS.drawers.max} onChange={(drawers) => updateModule(sel.run, sel.module, { drawers })} />
                )}
                {mod.drawers > 0 && drawersStuck && (
                  <p className="fade-in rounded-xl bg-accent-soft px-3 py-2 text-xs leading-relaxed text-accent-strong">
                    Con estas corredizas, este módulo nunca queda libre entero y los cajones no pueden salir. Ponelos en otro módulo o cambiá
                    el ancho.
                  </p>
                )}
              </Section>
            </>
          )}

          {tab === "frentes" && (
            <>
              <Section title="Puertas">
                <Segmented
                  value={config.doors}
                  options={(
                    [
                      ["none", "Sin puertas"],
                      ["hinged", "Batientes"],
                      ["sliding", "Corredizas"],
                    ] as [DoorType, string][]
                  ).map(([id, label]) => ({
                    id,
                    label,
                    disabled: id === "sliding" && !slidingOk,
                    title:
                      id === "sliding" && !slidingOk
                        ? config.slope.enabled
                          ? "Con techo inclinado van batientes"
                          : "Hace falta lugar para dos hojas de al menos 50 cm"
                        : undefined,
                  }))}
                  onChange={(doors) => {
                    update({ doors });
                    if (doors === "none") {
                      setOpen(false);
                      setXray(false);
                    }
                  }}
                />
              </Section>
              {config.doors !== "none" && (
                <Section title="Estilo del frente">
                  <div className="grid grid-cols-4 gap-2">
                    {(Object.keys(DOOR_STYLE_LABELS) as DoorStyle[]).map((s) => (
                      <OptionCard
                        key={s}
                        active={config.doorStyle === s}
                        disabled={s === "glass" && config.slope.enabled}
                        label={DOOR_STYLE_LABELS[s]}
                        onClick={() => update({ doorStyle: s })}
                      >
                        <FrontPreview style={s} color={catalog.materials.find((m) => m.id === config.doorMaterial)?.color ?? "#ccc"} />
                      </OptionCard>
                    ))}
                  </div>
                </Section>
              )}
              {hasHandles && (
                <Section title="Tiradores">
                  <Segmented
                    value={config.handle}
                    options={(
                      [
                        ["bar", "Barral"],
                        ["knob", "Botón"],
                        ["none", "Sin tirador"],
                      ] as [HandleType, string][]
                    ).map(([id, label]) => ({ id, label }))}
                    onChange={(handle) => update({ handle })}
                  />
                </Section>
              )}
            </>
          )}

          {tab === "luz" && (
            <>
              <Section title="Dónde va la luz" hint={lit ? `${result.assembly.ledMeters.toFixed(1)} m de tira` : undefined}>
                <Toggle label="Bajo cada estante, en todos" checked={allLed("ledShelves")} onChange={(v) => updateAllModules({ ledShelves: v })} />
                <Toggle label="Perfiles verticales, en todos" checked={allLed("ledSides")} onChange={(v) => updateAllModules({ ledSides: v })} />
                <div className="space-y-1.5 rounded-2xl bg-paper p-3">
                  {config.runs.map((r, ri) =>
                    r.modules.map((m, mi) => (
                      <div key={`${ri}-${mi}`} className="flex items-center justify-between gap-2 text-sm">
                        <button type="button" className="text-left text-ink-2 hover:text-ink" onClick={() => setSelection({ run: ri, module: mi })}>
                          {config.runs.length > 1 ? (ri === 0 ? "Frente " : "Lateral ") : "Módulo "}
                          {mi + 1}
                        </button>
                        <span className="flex gap-1.5">
                          <LedChip active={m.ledShelves} onClick={() => updateModule(ri, mi, { ledShelves: !m.ledShelves })}>
                            Estantes
                          </LedChip>
                          <LedChip active={m.ledSides} onClick={() => updateModule(ri, mi, { ledSides: !m.ledSides })}>
                            Laterales
                          </LedChip>
                        </span>
                      </div>
                    )),
                  )}
                </div>
              </Section>

              <Section title="Color de la luz">
                <Segmented
                  value={config.led.color}
                  options={(
                    [
                      ...Object.entries(LED_COLORS).map(([id, c]) => [id, c.label]),
                      ["rgb", "RGB"],
                    ] as [LedColor, string][]
                  ).map(([id, label]) => ({
                    id,
                    label: (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="size-2.5 rounded-full"
                          style={{
                            background:
                              id === "rgb" ? "conic-gradient(#ff3b30, #ffb000, #21d07a, #00c2ff, #a64dff, #ff2d92, #ff3b30)" : LED_COLORS[id as Exclude<LedColor, "rgb">].hex,
                          }}
                        />
                        {label}
                      </span>
                    ),
                  }))}
                  onChange={(color) => {
                    update({ led: { ...config.led, color } });
                    setLights(true);
                  }}
                />
                {config.led.color === "rgb" && (
                  <div className="fade-in flex flex-wrap items-center gap-2.5">
                    {RGB_PRESETS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        aria-label={`Color ${hex}`}
                        aria-pressed={config.led.rgb.toLowerCase() === hex}
                        onClick={() => update({ led: { ...config.led, rgb: hex } })}
                        className={`swatch size-8 rounded-full border-2 ${config.led.rgb.toLowerCase() === hex ? "border-ink" : "border-surface ring-1 ring-line"}`}
                        style={{ background: hex, boxShadow: `0 0 14px ${hex}66` }}
                      />
                    ))}
                    <label className="swatch relative size-8 cursor-pointer overflow-hidden rounded-full ring-1 ring-line" title="Elegir cualquier color">
                      <span className="absolute inset-0" style={{ background: "conic-gradient(#ff3b30, #ffb000, #21d07a, #00c2ff, #a64dff, #ff2d92, #ff3b30)" }} />
                      <input
                        type="color"
                        value={config.led.rgb}
                        onChange={(e) => update({ led: { ...config.led, rgb: e.target.value } })}
                        className="absolute inset-0 cursor-pointer opacity-0"
                        aria-label="Elegir cualquier color"
                      />
                    </label>
                  </div>
                )}
              </Section>

              <Section title="Encendido">
                {config.doors !== "none" && (
                  <Toggle
                    label="Sensor al abrir"
                    hint="La luz se prende sola al abrir la puerta"
                    checked={config.led.sensor}
                    onChange={(sensor) => update({ led: { ...config.led, sensor } })}
                  />
                )}
                <Toggle label="Ver las luces prendidas" checked={lights} onChange={setLights} disabled={!lit} hint={lit ? undefined : "Primero elegí dónde va la luz"} />
              </Section>
            </>
          )}

          {tab === "color" && (
            <>
              <Section title="Terminaciones">
                <Swatches label="Cuerpo" value={config.bodyMaterial} onChange={(bodyMaterial) => update({ bodyMaterial })} />
                <Swatches
                  label={config.doors === "none" ? "Frentes de cajón" : "Puertas"}
                  value={config.doorMaterial}
                  onChange={(doorMaterial) => update({ doorMaterial })}
                />
              </Section>

              <Section title="Tu ambiente" hint="Solo para imaginarlo: no cambia el precio">
                <Segmented
                  value={environment.mode}
                  options={[
                    { id: "room", label: "Habitación" },
                    { id: "studio", label: "Fondo liso" },
                  ]}
                  onChange={(mode) => setEnvironment((e) => ({ ...e, mode }))}
                />
                {environment.mode === "room" && (
                  <div className="fade-in space-y-4">
                    <div className="space-y-2.5">
                      <p className="text-sm">
                        Pared: <span className="text-ink-2">{WALL_COLORS.find((w) => w.hex === environment.wall)?.name}</span>
                      </p>
                      <div className="flex flex-wrap gap-2.5">
                        {WALL_COLORS.map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            title={w.name}
                            aria-label={`Pared ${w.name.toLowerCase()}`}
                            aria-pressed={environment.wall === w.hex}
                            onClick={() => setEnvironment((e) => ({ ...e, wall: w.hex }))}
                            className={`swatch size-9 rounded-full border-2 ${environment.wall === w.hex ? "border-ink" : "border-surface ring-1 ring-line"}`}
                            style={{ background: w.hex }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      <p className="text-sm">Piso</p>
                      <div className="grid grid-cols-4 gap-2">
                        {FLOORS.map((f) => (
                          <OptionCard
                            key={f.id}
                            active={environment.floor === f.id}
                            label={f.name}
                            onClick={() => setEnvironment((e) => ({ ...e, floor: f.id }))}
                          >
                            <span className="block h-9 w-full rounded-lg ring-1 ring-black/5" style={{ background: f.swatch }} />
                          </OptionCard>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </Section>
            </>
          )}

          <Link href={`/demo/taller/?c=${encodeConfig(config)}`} className="block text-sm font-medium text-accent underline-offset-4 hover:underline">
            Ver lo que le llega al taller →
          </Link>
        </div>

        {/* precio y pedido: fijos abajo en el teléfono, al pie del panel en pantalla grande */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-5 py-4 backdrop-blur lg:static">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-ink-2">Precio estimado</p>
              <p className="font-display text-2xl font-semibold tabular-nums">{money(Math.round(price / 1000) * 1000)}</p>
            </div>
            <button type="button" onClick={openSend} className="btn btn-whatsapp shrink-0 text-sm">
              Enviar al taller
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-ink-2">
            {catalog.brand.samplePricing
              ? "Valores orientativos de muestra. El fabricante debe confirmar medidas y costos antes de cotizar."
              : "Incluye materiales, luces y fabricación. El precio final se confirma al medir en tu casa."}
          </p>
        </div>
      </aside>

      {sheet.open && (
        <SendSheet
          pdf={sheet.pdf}
          failed={sheet.failed}
          rows={result.rows}
          message={message}
          orderHref={orderHref}
          onClose={() => setSheet({ open: false, pdf: null, failed: false })}
        />
      )}
    </div>
  );
}

/**
 * Hoja para mandar el pedido. En el celular el PDF se comparte directo a
 * WhatsApp; en la compu se baja el PDF y se abre WhatsApp con el resumen y el
 * link al despiece con dibujos.
 */
function SendSheet({ pdf, failed, rows, message, orderHref, onClose }: {
  pdf: OrderPdf | null;
  failed: boolean;
  rows: ReturnType<typeof quote>["rows"];
  message: string;
  orderHref: string;
  onClose: () => void;
}) {
  const [canShare] = useState(() => {
    if (EMBEDDED) return false;
    try {
      return typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [new File([""], "x.pdf", { type: "application/pdf" })] });
    } catch {
      return false;
    }
  });
  const fileName = `pedido-${catalog.brand.name.toLowerCase().replace(/\s+/g, "-")}.pdf`;
  const file = pdf ? new File([pdf.blob], fileName, { type: "application/pdf" }) : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], text: message, title: `Pedido para ${catalog.brand.name}` });
    } catch {
      // si la persona cancela no pasa nada; queda la hoja abierta
    }
  };
  const download = () => {
    if (!file) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const summary = summaryByTitle(rows);
  const shown = summary.slice(0, 6);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Enviar el pedido al taller">
      <button type="button" aria-label="Cerrar" className="sheet-backdrop absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="sheet-panel relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[1.75rem] bg-surface p-5 shadow-2xl sm:rounded-[1.75rem] sm:p-6">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Pedido para {catalog.brand.name}</p>
            <h2 className="mt-1 font-display text-xl font-semibold">Todo listo para el taller</h2>
          </div>
          <button type="button" onClick={onClose} className="tool -mr-2 -mt-1" aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-[110px_1fr] gap-4">
          <div className="aspect-[1/1.414] overflow-hidden rounded-lg border border-line bg-paper">
            {pdf ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pdf.preview} alt="Tapa del PDF del pedido" className="fade-in h-full w-full object-cover" />
            ) : (
              <div className="shimmer h-full w-full" />
            )}
          </div>
          <div className="text-sm">
            <p className="font-medium">{pdf ? `PDF de ${pdf.pages} hojas` : failed ? "No se pudo armar el PDF" : "Armando el PDF…"}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-2">Con el dibujo de cada pieza, sus cortes, cantos, canales de luz y agujeros.</p>
            <ul className="mt-3 space-y-1 text-xs">
              {shown.map((r) => (
                <li key={r.title}>
                  <span className="font-semibold text-accent">{r.qty} ×</span> {r.title}
                </li>
              ))}
              {summary.length > shown.length && <li className="text-ink-2">y {summary.length - shown.length} tipos de pieza más</li>}
            </ul>
          </div>
        </div>

        <div className="mt-5 grid gap-2">
          {canShare && (
            <button type="button" onClick={share} disabled={!file} className="btn btn-whatsapp disabled:opacity-60">
              Mandar el PDF por WhatsApp
            </button>
          )}
          <a href={orderHref} target="_blank" rel="noopener noreferrer" className={`btn ${canShare ? "btn-ghost" : "btn-whatsapp"}`}>
            {canShare ? "Mandar solo el resumen" : "Abrir WhatsApp con el resumen"}
          </a>
          {!EMBEDDED && (
            <button type="button" onClick={download} disabled={!file} className="btn btn-ghost disabled:opacity-60">
              Descargar el PDF
            </button>
          )}
        </div>
        {EMBEDDED && (
          <p className="mt-3 text-xs leading-relaxed text-ink-2">
            En esta vista de prueba el PDF no se puede bajar ni compartir. En la versión publicada en el sitio del taller, este botón lo
            manda directo por WhatsApp.
          </p>
        )}
        {!canShare && !EMBEDDED && (
          <p className="mt-3 text-xs leading-relaxed text-ink-2">
            El resumen lleva el link al despiece con los dibujos. Si querés, adjuntá también el PDF en el chat.
          </p>
        )}
      </div>
    </div>
  );
}

// el 3D sólo existe en el navegador; mientras carga se ve la vista de frente
const Viewer3D = dynamic(() => import("@/components/viewer/Scene"), { ssr: false, loading: () => null });

function LedChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`option-card rounded-full border px-2.5 py-1 text-xs ${active ? "border-accent bg-accent-soft text-accent-strong" : "border-line text-ink-2"}`}
    >
      {children}
    </button>
  );
}

/** forma vista desde arriba: la pared de fondo queda arriba */
function ShapeIcon({ shape }: { shape: Shape }) {
  const d =
    shape === "straight" ? "M6 6H42V16H6Z" : shape === "l-left" ? "M6 6H42V16H16V34H6Z" : "M6 6H42V34H32V16H6Z";
  return (
    <svg viewBox="0 0 48 40" className="h-10 w-12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
      <path d="M3 3H45" strokeDasharray="2 2.5" opacity="0.5" />
      <path d={d} fill="currentColor" fillOpacity="0.12" />
    </svg>
  );
}

function FrontPreview({ style, color }: { style: DoorStyle; color: string }) {
  return (
    <svg viewBox="0 0 28 44" className="h-11 w-7" aria-hidden>
      {style === "glass" ? (
        <>
          <rect x="1" y="1" width="26" height="42" rx="1.5" fill="#b8bcc1" />
          <rect x="4" y="4" width="20" height="36" fill="#3a4044" opacity="0.75" />
        </>
      ) : (
        <rect x="1" y="1" width="26" height="42" rx="1.5" fill={color} stroke="rgba(0,0,0,0.15)" />
      )}
      {style === "grooved" && [6, 10, 14, 18, 22].map((x) => <line key={x} x1={x} x2={x} y1="5" y2="39" stroke="rgba(0,0,0,0.35)" strokeWidth="0.9" />)}
      {style === "mirror" && (
        <>
          <rect x="3" y="3" width="22" height="38" fill="#dfe6ea" />
          <path d="M6 30 18 8M10 36 22 14" stroke="#fff" strokeWidth="1.4" opacity="0.8" />
        </>
      )}
    </svg>
  );
}
