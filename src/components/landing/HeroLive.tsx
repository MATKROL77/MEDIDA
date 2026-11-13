"use client";

import { useEffect, useMemo } from "react";

import type { PhotoStatus } from "@/components/viewer/PhotoMode";
import Scene from "@/components/viewer/Scene";
import { buildFurniture, fabricById, furniturePrice, type FurnitureConfig } from "@/lib/furniture";
import { DEFAULT_CONFIG, type WardrobeConfig } from "@/lib/model";
import { undressed } from "@/lib/decor";
import { HERO_SOFA_FRAMING } from "@/lib/presets";

const VIEW = { name: "three" as const, nonce: 0 };
const ENVIRONMENT = { mode: "room" as const, wall: "#e9e4dc", floor: "estudio" as const };
const noop = () => {};

/**
 * El configurador vivo de la portada. Se baja aparte y después de que la
 * página ya se ve: trae el motor 3D entero. Con la escena quieta pasa a modo
 * foto (trazado de rayos) en los equipos que pueden.
 */
export default function HeroLive({ config, paused, draggable, photo, onReady, onPrice, onPhoto }: {
  config: FurnitureConfig;
  paused: boolean;
  /** con mouse se puede girar; con el dedo no, para no trabar el scroll de la página */
  draggable: boolean;
  photo: boolean;
  onReady: () => void;
  onPrice: (price: number) => void;
  onPhoto: (status: PhotoStatus) => void;
}) {
  const build = useMemo(() => buildFurniture(config), [config]);
  const price = useMemo(() => furniturePrice(config, build), [config, build]);
  useEffect(() => onPrice(price), [onPrice, price]);
  const look = useMemo<WardrobeConfig>(() => ({ ...DEFAULT_CONFIG, doors: "none", bodyMaterial: config.body, doorMaterial: config.front }), [config.body, config.front]);
  const fabric = fabricById(config.fabric);
  const shown = useMemo(() => undressed(build.assembly), [build.assembly]);

  return (
    <Scene
      config={look}
      // el mueble solo, sin almohadones de adorno: como en una foto de catálogo
      assembly={shown}
      selection={null}
      onSelect={noop}
      open={false}
      leafOffsets={{}}
      xray={false}
      explode={false}
      lights={false}
      environment={ENVIRONMENT}
      view={VIEW}
      fabric={fabric.color}
      weave={fabric.weave}
      confine
      // el lienzo existe un instante antes de tener algo dibujado
      onReady={() => setTimeout(onReady, 350)}
      intro={false}
      orbit={draggable ? "rotate" : "none"}
      sway={!photo}
      paused={paused}
      framing={HERO_SOFA_FRAMING}
      maxDpr={1.75}
      photo={photo}
      onPhoto={onPhoto}
    />
  );
}
