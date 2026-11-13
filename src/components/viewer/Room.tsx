"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { clampDt, SOFT, SpringVec, useSceneAnim } from "./anim";
export { WALL_COLORS } from "./constants";
import type { FloorType } from "./constants";
import { concreteTexture, parquetTexture, pinoteaTexture, tileTexture } from "./materials";
import { MM } from "./PartNode";
import { dressWith, photoSet, PHOTOS, tintFor, type PhotoId } from "./photo";

export type Walls = "none" | "back" | "l-left" | "l-right";

type Props = {
  /** caja del mueble en coordenadas de mundo (mm) */
  min: [number, number, number];
  max: [number, number, number];
  /** qué paredes necesita: ninguna, una atrás, o dos para un placard en L */
  walls: Walls;
  wall: string;
  floor: FloorType;
};

/**
 * El estudio es un ciclorama: un piso redondo que se curva y sube en una pared
 * sin esquinas, como el fondo infinito de un estudio de fotografía. No tiene
 * horizonte ni bordes, y el trazado de rayos lo ve igual que el 3D rápido.
 */
/** hasta dónde el piso es plano; de ahí sube en una curva amplia (un cuarto de elipse) */
const COVE_FLAT = 6.5;
const COVE_RADIUS = 12.5;
const COVE_HEIGHT = 9;
/** el ciclorama, apenas más abajo que el piso con foto: así no pelean por el mismo plano */
const COVE_DROP = 0.004;
const COVE_COLOR = "#d6d2cc";
/** el piso con foto alrededor del mueble; hacia afuera se funde en el del ciclorama */
const FLOOR_SIZE = 14;
const FADE_FROM = 2.8;
const FADE_TO = 6.3;

function coveGeometry(): THREE.BufferGeometry {
  // del centro hacia afuera; la curva arranca sin quiebre y termina vertical
  const pts = [new THREE.Vector2(0.01, 0), new THREE.Vector2(COVE_FLAT, 0)];
  const a = COVE_RADIUS - COVE_FLAT;
  for (let i = 1; i <= 32; i++) {
    const t = i / 32;
    const angle = t * (Math.PI / 2);
    pts.push(new THREE.Vector2(COVE_FLAT + Math.sin(angle) * a, COVE_HEIGHT * (1 - Math.cos(angle))));
  }
  const g = new THREE.LatheGeometry(pts, 128);
  // la luz cae hacia el fondo, como en un estudio de verdad: el ciclorama se
  // oscurece de a poco con la distancia y la altura, y la curva no se lee como un borde
  const pos = g.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  const ease = (a: number, b: number, v: number) => {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getZ(i));
    const y = pos.getY(i);
    const k = 1 - 0.08 * ease(3.5, COVE_FLAT + 1, r) - 0.12 * ease(0, COVE_HEIGHT * 0.6, y);
    colors.set([k, k, k], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}
const WALL_HEIGHT = 2900;
const WALL_THICK = 110;
/** cuánto sobra el tabique a cada lado del mueble */
const WALL_MARGIN = 900;
/** la tarima de los muebles sueltos: baja y apenas más grande que el mueble */
export const PODIUM_HEIGHT = 50;
const PODIUM_MARGIN = 380;

type FloorLook = { map: THREE.Texture | null; normalMap: THREE.Texture | null; roughnessMap: THREE.Texture | null; roughness: number; color: THREE.Color };

/** cada piso, con su foto y cómo se ve terminado: el plastificado brilla, el cemento no */
const FLOOR_PHOTOS: Record<FloorType, { id: PhotoId; roughness: number; color?: string }> = {
  madera: { id: "piso-madera", roughness: 0.6 },
  // la pinotea plastificada es más rojiza y oscura que la madera cruda de la foto
  pinotea: { id: "piso-pinotea", roughness: 0.42, color: "#a8693a" },
  // cemento alisado claro, como el de una galería
  cemento: { id: "piso-cemento", roughness: 0.72, color: "#c6c2bb" },
  baldosa: { id: "piso-baldosa", roughness: 0.4 },
};

/**
 * El borde del piso: opaco alrededor del mueble y cada vez más transparente
 * hacia el fondo, hasta desaparecer en el color de la sala. Hace lo que hacía
 * la niebla, pero lo ven igual el 3D rápido y el modo foto.
 */
function fadeTexture(): THREE.Texture {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const r0 = (FADE_FROM / (FLOOR_SIZE / 2)) * (size / 2);
  const r1 = (FADE_TO / (FLOOR_SIZE / 2)) * (size / 2);
  const g = ctx.createRadialGradient(size / 2, size / 2, r0, size / 2, size / 2, r1);
  // curva suave: sin escalón donde arranca ni donde termina
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const v = Math.round(255 * (1 - t * t * (3 - 2 * t)));
    g.addColorStop(t, `rgb(${v},${v},${v})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/** el piso con su foto, repetida a su medida real */
async function photoFloor(type: FloorType): Promise<FloorLook> {
  const spec = FLOOR_PHOTOS[type];
  const set = await photoSet(spec.id);
  const size = PHOTOS[spec.id].size;
  // copias: la tarima usa la misma foto con otra repetición
  const fit = (t?: THREE.Texture) => {
    if (!t) return null;
    const c = t.clone();
    c.repeat.set(FLOOR_SIZE / size[0], FLOOR_SIZE / size[1]);
    c.needsUpdate = true;
    return c;
  };
  return {
    map: fit(set.map),
    normalMap: fit(set.normalMap),
    roughnessMap: fit(set.roughnessMap),
    roughness: spec.roughness,
    color: spec.color ? tintFor(spec.id, spec.color) : new THREE.Color("#ffffff"),
  };
}

/** el piso dibujado, para el primer cuadro y por si la foto no llega */
function drawnFloor(type: FloorType): FloorLook {
  const make = (t: THREE.Texture, repeat: number) => {
    const c = t.clone();
    c.needsUpdate = true;
    c.repeat.set(repeat, repeat);
    return c;
  };
  const looks: Record<FloorType, () => { map: THREE.Texture; roughness: number }> = {
    madera: () => ({ map: make(parquetTexture(), FLOOR_SIZE), roughness: 0.62 }),
    pinotea: () => ({ map: make(pinoteaTexture(), FLOOR_SIZE), roughness: 0.5 }),
    cemento: () => ({ map: make(concreteTexture(), FLOOR_SIZE / 3.5), roughness: 0.82 }),
    baldosa: () => ({ map: make(tileTexture(), FLOOR_SIZE / 1.2), roughness: 0.38 }),
  };
  const look = looks[type]();
  return { map: look.map, normalMap: null, roughnessMap: null, roughness: look.roughness, color: new THREE.Color("#ffffff") };
}

function applyFloor(m: THREE.MeshStandardMaterial, look: FloorLook) {
  m.map = look.map;
  m.normalMap = look.normalMap;
  m.roughnessMap = look.roughnessMap;
  m.roughness = look.roughness;
  m.color.copy(look.color);
  m.needsUpdate = true;
}

/**
 * El showroom: un piso que se pierde en un fondo parejo, como en una galería.
 * No hay habitación alrededor. Lo que se apoya o se cuelga de una pared (la
 * tele, un placard, una biblioteca, una cama) tiene un tabique detrás, y un
 * segundo si el placard es en L. Lo que va suelto (una mesa, un sillón) se
 * muestra sobre una tarima baja.
 */
export function Room({ min, max, walls, wall, floor }: Props) {
  const anim = useSceneAnim();

  const back = walls !== "none";
  const left = walls === "l-left";
  const right = walls === "l-right";
  const target = [
    min[0] - (left ? 0 : WALL_MARGIN),
    max[0] + (right ? 0 : WALL_MARGIN),
    min[2],
    max[2] + WALL_MARGIN,
    min[0] - PODIUM_MARGIN,
    max[0] + PODIUM_MARGIN,
    min[2] - PODIUM_MARGIN,
    max[2] + PODIUM_MARGIN,
  ];
  const sv = useRef(new SpringVec(target));
  sv.current.set(target);

  const backWall = useRef<THREE.Mesh>(null);
  const leftWall = useRef<THREE.Mesh>(null);
  const rightWall = useRef<THREE.Mesh>(null);
  const podium = useRef<THREE.Mesh>(null);

  const mats = useMemo(() => {
    const first = drawnFloor("cemento");
    const fade = fadeTexture();
    return {
      floor: new THREE.MeshStandardMaterial({ ...first, alphaMap: fade, transparent: true }),
      /** el piso nuevo entra con un fundido encima del anterior */
      floorNext: new THREE.MeshStandardMaterial({ ...first, alphaMap: fade, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }),
      // pintura sobre revoque: un relieve apenas visible cuando la luz pega de costado
      wall: dressWith(new THREE.MeshStandardMaterial({ color: wall, roughness: 0.95, transparent: true }), "pared", { normalScale: 0.35, project: true }),
      // la tarima: cemento alisado claro, como un pedestal de museo
      podium: dressWith(new THREE.MeshStandardMaterial({ color: "#dcd8d1", roughness: 0.75, transparent: true }), "piso-cemento", {
        tint: tintFor("piso-cemento", "#d6d2cb"),
        roughness: 0.7,
        normalScale: 0.4,
        project: true,
      }),
      shadow: new THREE.ShadowMaterial({ opacity: 0.16, transparent: true }),
      // pintura mate del ciclorama: del tono del cemento, para que el piso se funda sin costura
      // en el modo foto no hace sombra: la luz del ambiente entra como en un estudio abierto
      cove: Object.assign(new THREE.MeshStandardMaterial({ color: COVE_COLOR, roughness: 0.94, side: THREE.DoubleSide, transparent: true, vertexColors: true }), { castShadow: false }),
    };
    // el color de pared se anima aparte; no rehace los materiales
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  const wallColor = useRef(new THREE.Color(wall));
  useEffect(() => {
    wallColor.current.set(wall);
  }, [wall]);

  const fade = useRef({ v: 1, active: false });
  const next = useRef<THREE.Mesh>(null);
  useEffect(() => {
    let alive = true;
    photoFloor(floor)
      .catch(() => drawnFloor(floor))
      .then((look) => {
        if (!alive) return;
        applyFloor(mats.floorNext, look);
        fade.current = { v: 0, active: true };
      });
    return () => {
      alive = false;
    };
  }, [floor, mats]);

  useFrame((_, dt) => {
    const d = clampDt(dt);
    sv.current.step(d, SOFT);
    const [l, r, zb, zf, pl, pr, pb, pf] = sv.current.v;
    const room = anim.room.v;
    mats.wall.color.lerp(wallColor.current, 1 - Math.exp(-d * 6));
    for (const m of [mats.floor, mats.wall, mats.podium, mats.cove]) {
      m.opacity = room;
      m.depthWrite = room > 0.98;
      m.visible = room > 0.01;
    }
    // fundido del piso: cuando el nuevo tapa al viejo, pasa a ser el de abajo
    const f = fade.current;
    if (next.current) next.current.visible = f.active;
    if (f.active) {
      f.v = Math.min(1, f.v + d * 2.2);
      mats.floorNext.opacity = f.v * room;
      mats.floorNext.visible = room > 0.01;
      if (f.v >= 1) {
        applyFloor(mats.floor, {
          map: mats.floorNext.map,
          normalMap: mats.floorNext.normalMap,
          roughnessMap: mats.floorNext.roughnessMap,
          roughness: mats.floorNext.roughness,
          color: mats.floorNext.color,
        });
        mats.floorNext.opacity = 0;
        f.active = false;
      }
    }
    // sobre fondo liso la sombra es lo único que apoya el mueble en el piso
    mats.shadow.opacity = 0.3 * (1 - room);


    const h = WALL_HEIGHT * MM;
    const t = WALL_THICK * MM;
    if (backWall.current) {
      backWall.current.visible = back;
      backWall.current.position.set(((l + r) / 2) * MM, h / 2, zb * MM - t / 2);
      backWall.current.scale.set((r - l + (left || right ? WALL_THICK : 0)) * MM, h, t);
      if (left) backWall.current.position.x -= t / 2;
      if (right) backWall.current.position.x += t / 2;
    }
    if (leftWall.current) {
      leftWall.current.visible = left;
      leftWall.current.position.set(l * MM - t / 2, h / 2, ((zb + zf) / 2) * MM);
      leftWall.current.scale.set(t, h, (zf - zb) * MM);
    }
    if (rightWall.current) {
      rightWall.current.visible = right;
      rightWall.current.position.set(r * MM + t / 2, h / 2, ((zb + zf) / 2) * MM);
      rightWall.current.scale.set(t, h, (zf - zb) * MM);
    }
    if (podium.current) {
      podium.current.visible = !back && room > 0.01;
      podium.current.position.set(((pl + pr) / 2) * MM, (PODIUM_HEIGHT / 2) * MM, ((pb + pf) / 2) * MM);
      podium.current.scale.set((pr - pl) * MM, PODIUM_HEIGHT * MM, (pf - pb) * MM);
    }
  });

  const cove = useMemo(coveGeometry, []);
  useEffect(() => () => cove.dispose(), [cove]);

  return (
    <group>
      <mesh geometry={cove} material={mats.cove} position={[0, -COVE_DROP, 0]} receiveShadow />
      {/* piso: en el showroom se pierde en el fondo; en estudio solo queda la sombra */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow material={mats.floor}>
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
      </mesh>
      <mesh ref={next} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0002, 0]} receiveShadow material={mats.floorNext}>
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0005, 0]} receiveShadow material={mats.shadow} userData={{ fake: true }}>
        <planeGeometry args={[14, 14]} />
      </mesh>

      <mesh ref={backWall} material={mats.wall} receiveShadow castShadow>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh ref={leftWall} material={mats.wall} receiveShadow castShadow>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh ref={rightWall} material={mats.wall} receiveShadow castShadow>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh ref={podium} material={mats.podium} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
    </group>
  );
}
