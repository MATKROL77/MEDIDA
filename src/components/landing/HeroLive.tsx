"use client";

import { useEffect, useMemo } from "react";

import { WALL_COLORS } from "@/components/viewer/constants";
import Scene from "@/components/viewer/Scene";
import type { WardrobeConfig } from "@/lib/model";
import { drawerGroupsOf, leavesOf, openOffsets } from "@/lib/motion";
import { HERO_FRAMING } from "@/lib/presets";
import { quote } from "@/lib/quote";

/** el fondo del 3D en la landing: el mismo gris de los bloques del sitio */
export const HERO_BACKDROP = "#f5f5f6";

const VIEW = { name: "three" as const, nonce: 0 };
const noop = () => {};

/**
 * El configurador vivo del hero. Se baja aparte y después de que la página ya
 * se ve: trae el motor 3D entero.
 */
export default function HeroLive({ config, open, lights, paused, draggable, onReady, onPrice }: {
  config: WardrobeConfig;
  open: boolean;
  lights: boolean;
  paused: boolean;
  /** con mouse se puede girar; con el dedo no, para no trabar el scroll de la página */
  draggable: boolean;
  onReady: () => void;
  onPrice: (price: number) => void;
}) {
  const result = useMemo(() => quote(config), [config]);
  useEffect(() => onPrice(result.price), [onPrice, result.price]);

  const leafOffsets = useMemo(() => {
    const leaves = leavesOf(result.assembly);
    return open && leaves.length ? openOffsets(leaves, drawerGroupsOf(result.assembly)) : {};
  }, [open, result.assembly]);

  return (
    <Scene
      config={config}
      assembly={result.assembly}
      selection={null}
      onSelect={noop}
      open={open}
      leafOffsets={leafOffsets}
      xray={false}
      explode={false}
      lights={lights}
      environment={{ mode: "studio", wall: WALL_COLORS[0].hex, floor: "madera" }}
      view={VIEW}
      // el lienzo existe un instante antes de tener algo dibujado
      onReady={() => setTimeout(onReady, 350)}
      intro={false}
      orbit={draggable ? "rotate" : "none"}
      sway
      paused={paused}
      backdrop={HERO_BACKDROP}
      framing={HERO_FRAMING}
      maxDpr={1.75}
    />
  );
}
