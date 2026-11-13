"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

type Quality = "alta" | "baja";
declare global {
  interface Window {
    /** la herramienta de capturas maneja la escena desde acá */
    __medidaRender?: { setQuality: (q: Quality) => void; pause: () => void };
    /** cómo va el modo foto: la captura espera a que termine */
    __medidaPhoto?: PhotoStatus;
  }
}

import { FLOORS, WALL_COLORS, type FloorType } from "@/components/viewer/constants";
import type { PhotoStatus } from "@/components/viewer/PhotoMode";
import type { ViewName } from "@/components/viewer/Scene";
import { buildFurniture, defaultFurniture, fabricById, normalizeFurniture, specById, type FurnitureConfig } from "@/lib/furniture";
import { fromBase64Url } from "@/lib/base64url";
import { DEFAULT_CONFIG, type WardrobeConfig } from "@/lib/model";
import { drawerGroupsOf, leavesOf, openOffsets } from "@/lib/motion";
import { quote } from "@/lib/quote";
import { decodeConfig } from "@/lib/share";

const Viewer3D = dynamic(() => import("@/components/viewer/Scene"), { ssr: false, loading: () => null });
const VIEWS: ViewName[] = ["front", "three", "side", "top", "back"];

/**
 * El 3D solo, a pantalla completa y sin interfaz: para sacar las imágenes del
 * sitio (scripts/capture.mjs). Parámetros: c (configuración), v (vista),
 * abierto, luces, explotado, adentro, ambiente=habitacion, piso, pared, fondo, encuadre,
 * calidad=alta, foto=1 (trazado de rayos; con muestras=N y px=N).
 */
export default function RenderStage() {
  const [state, setState] = useState<{
    config: WardrobeConfig;
    view: ViewName;
    open: boolean;
    lights: boolean;
    explode: boolean;
    xray: boolean;
    room: boolean;
    floor: FloorType;
    wall: string;
    backdrop: string | undefined;
    framing: number;
    photo: { samples: number; pixels: number } | null;
    /** otra familia (f=mesas…): se dibuja ese mueble en vez del placard */
    furniture: FurnitureConfig | null;
  } | null>(null);

  // arranca liviana para que puertas, cajones y luces lleguen rápido a su lugar;
  // la captura pide calidad alta para el cuadro final y después la deja quieta
  const [quality, setQuality] = useState<Quality>("baja");
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    window.__medidaRender = { setQuality, pause: () => setPaused(true) };
    return () => {
      delete window.__medidaRender;
    };
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("calidad") === "alta") setQuality("alta");
    const view = q.get("v") as ViewName | null;
    const floor = q.get("piso") as FloorType | null;
    const backdrop = q.get("fondo");
    setState({
      config: decodeConfig(q.get("c")) ?? DEFAULT_CONFIG,
      view: view && VIEWS.includes(view) ? view : "three",
      open: q.get("abierto") === "1",
      lights: q.get("luces") === "1",
      explode: q.get("explotado") === "1",
      xray: q.get("adentro") === "1",
      room: q.get("ambiente") === "habitacion",
      floor: floor && FLOORS.some((f) => f.id === floor) ? floor : "madera",
      wall: WALL_COLORS.find((w) => w.id === q.get("pared"))?.hex ?? WALL_COLORS[0].hex,
      backdrop: backdrop && /^[0-9a-f]{6}$/i.test(backdrop) ? `#${backdrop}` : undefined,
      framing: Math.min(1.5, Math.max(0.5, Number(q.get("encuadre")) || 1)),
      photo: q.get("foto") === "1" ? { samples: Math.min(4000, Number(q.get("muestras")) || 600), pixels: Math.min(8e6, Number(q.get("px")) || 2e6) } : null,
      furniture: (() => {
        const f = q.get("f");
        if (!f || !specById(f)) return null;
        try {
          return q.get("c") ? normalizeFurniture(JSON.parse(fromBase64Url(q.get("c")!))) : defaultFurniture(f);
        } catch {
          return defaultFurniture(f);
        }
      })(),
    });
  }, []);

  const result = useMemo(() => {
    if (!state) return null;
    if (!state.furniture) return { assembly: quote(state.config).assembly, look: state.config, fabric: undefined as string | undefined, weave: undefined as string | undefined };
    const built = buildFurniture(state.furniture);
    const look: WardrobeConfig = { ...DEFAULT_CONFIG, doors: built.doors ? "hinged" : "none", bodyMaterial: state.furniture.body, doorMaterial: state.furniture.front, led: { ...DEFAULT_CONFIG.led, sensor: false } };
    return { assembly: built.assembly, look, fabric: fabricById(state.furniture.fabric).color, weave: fabricById(state.furniture.fabric).weave as string | undefined };
  }, [state]);
  if (!state || !result) return null;
  const leaves = leavesOf(result.assembly);
  const leafOffsets = state.open && leaves.length ? openOffsets(leaves, drawerGroupsOf(result.assembly)) : {};

  return (
    <div className="fixed inset-0">
      <Viewer3D
        config={result.look}
        assembly={result.assembly}
        fabric={result.fabric}
        weave={result.weave}
        selection={null}
        onSelect={() => {}}
        open={state.open}
        leafOffsets={leafOffsets}
        xray={state.xray}
        explode={state.explode}
        lights={state.lights}
        environment={{ mode: state.room ? "room" : "studio", wall: state.wall, floor: state.floor }}
        view={{ name: state.view, nonce: 0 }}
        intro={false}
        orbit="none"
        backdrop={state.backdrop}
        framing={state.framing}
        quality={quality}
        paused={paused}
        confine={state.room}
        photo={!!state.photo}
        photoSamples={state.photo?.samples}
        photoPixels={state.photo?.pixels}
        onPhoto={(s) => (window.__medidaPhoto = s)}
        countFrames
      />
    </div>
  );
}
