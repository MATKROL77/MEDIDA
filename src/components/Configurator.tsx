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
import { OtherConfigurators } from "@/components/OtherConfigurators";
import { SendSheet } from "@/components/SendSheet";
import { Watermark } from "@/components/Watermark";
import { SaveSheet, type SaveChoice } from "@/components/designs/SaveSheet";
import { ContactLink } from "@/components/site/ContactLink";
import { IconCheck, IconClose, IconDecor, IconHeart, IconWhatsapp } from "@/components/site/icons";
import { Logo } from "@/components/site/Logo";
import { Dimension, OptionCard, Section, Segmented, Stepper, Swatches, Toggle, useAnimatedNumber } from "@/components/controls";
import { FLOORS, WALL_COLORS, type FloorType } from "@/components/viewer/constants";
import { PhotoBadge, PhotoToggle, usePhotoMode } from "@/components/PhotoControls";
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
import { dressed } from "@/lib/decor";
import { addDesign, clearDraft, getDesign, nextName, readDraft, updateDesign, useDesigns, writeDraft } from "@/lib/designStore";
import { drawerGroupsOf, leavesOf, openOffsets, toggleLeaf } from "@/lib/motion";
import { buildOrderPdf, type OrderPdf } from "@/lib/orderPdf";
import { shrinkImage } from "@/lib/preview";
import { currentQuery, rememberQuery } from "@/lib/query";
import { money, quote } from "@/lib/quote";
import { decodeConfig, designSummary, encodeConfig, orderMessage } from "@/lib/share";
import type { Workshop } from "@/lib/workshop";

/** la familia de producto de este configurador, para guardar y recuperar sus diseños */
const FAMILY = "placares";
/** después de cuántos cambios se le cuenta a la persona que esto se puede tener en su empresa */
const PITCH_AFTER_CHANGES = 8;

type Toast = { text: string; href?: string; hrefLabel?: string; action?: { label: string; run: () => void } };

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

/**
 * El configurador de placares. `workshop` es la empresa dueña del configurador:
 * a ella le llegan las consultas. Sin `workshop` es la demo de MEDIDA, donde
 * además se pueden guardar diseños y armar un carrito de consulta.
 */
export default function Configurator({ workshop = null, initial, onInquiry }: {
  workshop?: Workshop | null;
  /** con qué arranca; el configurador de una empresa parte de sus propias terminaciones */
  initial?: WardrobeConfig;
  onInquiry?: (channel: string, config: WardrobeConfig, price: number) => void;
}) {
  const demo = workshop === null;
  const [config, setConfig] = useState<WardrobeConfig>(initial ?? DEFAULT_CONFIG);
  const [tab, setTab] = useState<Tab>("forma");
  const [selection, setSelection] = useState({ run: 0, module: 0 });
  const [open, setOpen] = useState(false);
  const [xray, setXray] = useState(false);
  const [explode, setExplode] = useState(false);
  const [lights, setLights] = useState(false);
  const photo = usePhotoMode();
  const [environment, setEnvironment] = useState<{ mode: "room" | "studio"; wall: string; floor: FloorType }>({
    mode: "room",
    wall: WALL_COLORS[0].hex,
    floor: "madera",
  });
  const captureRef = useRef<(() => Promise<string | null>) | null>(null);
  const [sheet, setSheet] = useState<{ open: boolean; pdf: OrderPdf | null; failed: boolean }>({ open: false, pdf: null, failed: false });
  const [view, setView] = useState<{ name: ViewName; nonce: number }>({ name: "three", nonce: 0 });
  const [ready, setReady] = useState(false);
  // el diseño guardado que se está editando, si se abrió uno
  const [designId, setDesignId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [changes, setChanges] = useState(0);
  // ropa y zapatillas adentro: para verlo en uso. No cambian el despiece ni el precio
  const [deco, setDeco] = useState(true);
  const [pitchClosed, setPitchClosed] = useState(true);
  const saved = useDesigns().designs.find((d) => d.id === designId) ?? null;
  const savedCount = useDesigns().designs.length;

  // qué se abre, en orden: un diseño guardado (?id=), un enlace compartido
  // (?c=), o lo último que se estaba armando en este dispositivo
  useEffect(() => {
    const q = new URLSearchParams(currentQuery());
    const stored = demo ? getDesign(q.get("id") ?? "") : null;
    const fromUrl = decodeConfig(q.get("c"));
    if (stored && stored.type === FAMILY) {
      setConfig(normalize(stored.config as Partial<WardrobeConfig>));
      setDesignId(stored.id);
    } else if (fromUrl) {
      setConfig(fromUrl);
    } else if (demo && q.get("nuevo") !== "1") {
      const draft = readDraft<Partial<WardrobeConfig>>(FAMILY);
      if (draft) {
        try {
          const restored = normalize(draft.config);
          if (JSON.stringify(restored) !== JSON.stringify(DEFAULT_CONFIG)) {
            setConfig(restored);
            setToast({
              text: "Recuperamos el diseño que estabas armando.",
              action: {
                label: "Empezar de cero",
                run: () => {
                  clearDraft(FAMILY);
                  setConfig(DEFAULT_CONFIG);
                },
              },
            });
          }
        } catch {
          clearDraft(FAMILY);
        }
      }
    }
    try {
      setPitchClosed(sessionStorage.getItem("medida.pitch") === "cerrado");
    } catch {
      setPitchClosed(false);
    }
    setLoaded(true);
    // solo al abrir la página
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const result = useMemo(() => quote(config), [config]);

  const clothed = useMemo(() => dressed(result.assembly), [result.assembly]);

  /** una vista previa chica del 3D, tal como se ve ahora */
  const capturePreview = async (wait = 1500): Promise<string | null> => {
    const shot = captureRef.current ? await Promise.race([captureRef.current(), new Promise<null>((r) => setTimeout(() => r(null), wait))]) : null;
    return shot ? shrinkImage(shot) : null;
  };

  // guardado automático: la dirección reproduce lo que se ve, el borrador queda
  // en el dispositivo y, si se está editando un diseño guardado, se actualiza
  useEffect(() => {
    if (!loaded) return;
    const id = setTimeout(() => {
      rememberQuery(`?${designId ? `id=${designId}&` : ""}c=${encodeConfig(config)}`);
      if (!demo) return;
      writeDraft(FAMILY, config);
      const current = designId ? getDesign(designId) : null;
      if (current && JSON.stringify(current.config) !== JSON.stringify(config)) {
        updateDesign(current.id, { config, summary: designSummary(config), price: result.price });
      }
    }, 350);
    return () => clearTimeout(id);
    // result sale de config: no hace falta en la lista
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, designId, loaded, demo]);

  // la vista previa del diseño guardado se rehace cuando la persona deja de cambiar cosas
  const firstPreview = useRef(true);
  useEffect(() => {
    if (!loaded || !designId) return;
    if (firstPreview.current) {
      firstPreview.current = false;
      return;
    }
    const id = setTimeout(async () => {
      const preview = await capturePreview();
      if (preview && getDesign(designId)) updateDesign(designId, { preview });
    }, 2600);
    return () => clearTimeout(id);
  }, [config, designId, loaded]);

  // cuenta los cambios para ofrecer, sin interrumpir, tener esto en la propia empresa
  const firstChange = useRef(true);
  useEffect(() => {
    if (!loaded) return;
    if (firstChange.current) {
      firstChange.current = false;
      return;
    }
    setChanges((n) => n + 1);
  }, [config, loaded]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(id);
  }, [toast]);

  const save = async ({ name, favorite, cart }: SaveChoice) => {
    // al guardar a pedido se espera más: en un equipo lento un cuadro del 3D puede tardar
    const preview = await capturePreview(4000);
    const data = { name, favorite, cart, config, summary: designSummary(config), price: result.price };
    if (saved) updateDesign(saved.id, { ...data, preview: preview ?? saved.preview });
    else setDesignId(addDesign({ type: FAMILY, ...data, preview }).id);
    setSaveOpen(false);
    setToast({ text: cart ? "Agregado a tu carrito de consulta." : "Guardado en tus favoritos.", href: "/mis-disenos/", hrefLabel: "Ver mis diseños" });
  };

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
    recipient: workshop?.name,
  });
  const showPitch = demo && !pitchClosed && changes >= PITCH_AFTER_CHANGES;

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
            assembly={deco ? clothed : result.assembly}
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
            photo={photo.on}
            onPhoto={photo.onStatus}
          />
        </div>
        <PhotoBadge status={photo.status} />

        <Watermark />

        <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3 sm:p-4">
          <div className="flex flex-col items-start">
          {workshop ? (
            <div className="pointer-events-auto rounded-2xl bg-surface/90 px-4 py-2.5 shadow-sm backdrop-blur">
              <p className="font-display text-base font-semibold leading-tight">{workshop.name}</p>
              <p className="text-xs text-ink-2">{catalog.brand.tagline}</p>
            </div>
          ) : (
            <Link href="/" className="pointer-events-auto rounded-2xl bg-surface/90 px-4 py-2.5 shadow-sm backdrop-blur transition-colors hover:bg-surface" aria-label="MEDIDA, volver al inicio">
              <Logo />
              <p className="mt-0.5 text-xs text-ink-2">{catalog.brand.tagline}</p>
            </Link>
          )}
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
          {demo && (
            <Link
              href="/mis-disenos/"
              className="pointer-events-auto flex items-center gap-2 rounded-full bg-surface/90 px-3.5 py-2 text-sm font-medium shadow-sm backdrop-blur transition-colors hover:bg-surface"
            >
              <IconHeart width={17} height={17} />
              <span className="hidden sm:inline">Mis diseños</span>
              {savedCount > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-ink px-1.5 text-[0.68rem] font-semibold leading-5 text-on-dark">{savedCount}</span>}
            </Link>
          )}
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
            <PhotoToggle on={photo.on} toggle={photo.toggle} />
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

        <div key={tab} className="fade-in flex-1 space-y-8 overflow-y-auto px-5 pb-28 pt-6 lg:pb-8">
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
                    { id: "room", label: "Showroom" },
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

          <Link href={`/demo/taller/?c=${encodeConfig(config)}`} className="link-arrow text-sm">
            Ver lo que le llega al taller
          </Link>

          {demo && <OtherConfigurators current={FAMILY} />}

          {showPitch && (
            <aside className="fade-in relative rounded-2xl bg-paper p-4 pr-10" aria-label="MEDIDA para empresas">
              <p className="text-sm font-semibold">¿Tenés una empresa?</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">Podés tener un configurador como este en tu propia web.</p>
              <ContactLink channel="whatsapp" interest="demo" placement="demo-panel" className="btn btn-primary btn-sm mt-3">
                <IconWhatsapp width={15} height={15} />
                Hablemos
              </ContactLink>
              <button
                type="button"
                aria-label="Cerrar"
                className="absolute right-2 top-2 grid size-8 place-items-center rounded-full text-ink-2 hover:bg-surface hover:text-ink"
                onClick={() => {
                  setPitchClosed(true);
                  try {
                    sessionStorage.setItem("medida.pitch", "cerrado");
                  } catch {
                    // sin almacenamiento de sesión vuelve a aparecer al recargar
                  }
                }}
              >
                <IconClose width={16} height={16} />
              </button>
            </aside>
          )}
        </div>

        {/* precio y pedido: fijos abajo en el teléfono, al pie del panel en pantalla grande */}
        <div className="price-bar fixed inset-x-0 bottom-0 z-30 px-4 py-2.5 lg:static">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-ink-2">Precio estimado</p>
              <p className="font-display text-lg leading-tight tabular-nums">{money(Math.round(price / 1000) * 1000)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {demo && (
                <button
                  type="button"
                  onClick={() => setSaveOpen(true)}
                  className={`btn btn-sm h-9 px-3 text-[0.8rem] ${saved ? "btn-secondary" : "btn-ghost"}`}
                  aria-label={saved ? "Diseño guardado: cambiar nombre o dónde está" : "Guardar este diseño"}
                  title={saved ? "Guardado" : "Guardar"}
                >
                  {saved ? <IconCheck /> : <IconHeart />}
                  <span className="hidden min-[420px]:inline">{saved ? "Guardado" : "Guardar"}</span>
                </button>
              )}
              <button type="button" onClick={openSend} className="btn btn-primary btn-sm h-9 px-3.5 text-[0.8rem]">
                Enviar al taller
              </button>
            </div>
          </div>
          <p className="mt-1 text-[10px] leading-snug text-ink-2">
            {catalog.brand.samplePricing
              ? "Valores orientativos de muestra. El fabricante debe confirmar medidas y costos antes de cotizar."
              : "Incluye materiales, luces y fabricación. El precio final se confirma al medir en tu casa."}
          </p>
        </div>
      </aside>

      {sheet.open && (
        <SendSheet
          workshop={workshop}
          summary={designSummary(config)}
          price={result.price}
          pdf={sheet.pdf}
          failed={sheet.failed}
          rows={result.rows}
          message={message}
          designLink={shareLink(config)}
          workshopHref={`/demo/taller/?c=${encodeConfig(config)}`}
          onInquiry={(channel) => onInquiry?.(channel, config, result.price)}
          onClose={() => setSheet({ open: false, pdf: null, failed: false })}
        />
      )}

      {saveOpen && <SaveSheet saved={saved} suggestedName={nextName("Placard")} onSave={save} onClose={() => setSaveOpen(false)} />}

      {toast && (
        <div role="status" className="toast fixed inset-x-3 bottom-28 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-on-dark shadow-xl lg:bottom-6 lg:left-6 lg:right-auto lg:mx-0">
          <span className="flex-1">{toast.text}</span>
          {toast.href && (
            <Link href={toast.href} className="shrink-0 font-semibold underline underline-offset-4">
              {toast.hrefLabel}
            </Link>
          )}
          {toast.action && (
            <button
              type="button"
              className="shrink-0 font-semibold underline underline-offset-4"
              onClick={() => {
                toast.action!.run();
                setToast(null);
              }}
            >
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
