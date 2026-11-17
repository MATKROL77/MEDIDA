"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { clampDt, SOFT, SpringVec, useSceneAnim } from "./anim";
export { WALL_COLORS } from "./constants";
import type { FloorType } from "./constants";
import { concreteTexture, parquetTexture, pinoteaTexture, tileTexture } from "./materials";
import { MM } from "./PartNode";

import { dressWith, photoColor, photoSet, PHOTOS, type PhotoId } from "./photo";

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
/** el beige de la página: el mueble queda apoyado en el mismo color que lo rodea */
const COVE_COLOR = "#e3dbce";
/** el piso con foto alrededor del mueble; hacia afuera se funde en el del ciclorama */
const FLOOR_SIZE = 14;
const FADE_FROM = 3.6;
const FADE_TO = 6.7;

function coveGeometry(): THREE.BufferGeometry {
  // del centro hacia afuera; la curva arranca sin quiebre y termina vertical
  const pts = [new THREE.Vector2(0.01, 0), new THREE.Vector2(COVE_FLAT, 0)];
  const a = COVE_RADIUS - COVE_FLAT;
  for (let i = 1; i <= 32; i++) {
    const t = i / 32;
    const angle = t * (Math.PI / 2);
    pts.push(new THREE.Vector2(COVE_FLAT + Math.sin(angle) * a, COVE_HEIGHT * (1 - Math.cos(angle))));
  }
  // sin colores por vértice: el trazado de rayos los lee con una transparencia que no tienen y
  // el ciclorama desaparece. La caída de luz hacia el fondo la da la luz misma
  return new THREE.LatheGeometry(pts, 128);
}
const WALL_HEIGHT = 2900;
const WALL_THICK = 110;
/** cuánto sobra el tabique a cada lado del mueble */
const WALL_MARGIN = 1500;
/** el tabique más angosto que se dibuja (mm) */
const MIN_WALL = 5800;
/** el zócalo: una tabla pintada al pie de la pared, que es lo que la hace pared y no un panel */
const SKIRT_HEIGHT = 80;
const SKIRT_THICK = 14;

/** lo que aparece y desaparece con el ambiente */
const FADING = ["floor", "wall", "skirt", "cove"] as const;

type FloorLook = { map: THREE.Texture | null; normalMap: THREE.Texture | null; roughnessMap: THREE.Texture | null; roughness: number; relief: number; color: THREE.Color };

/**
 * Cada piso, con su foto y cómo se ve terminado: el plastificado brilla, el
 * cemento no. `roughness` multiplica el mapa de la foto: la madera clara queda
 * en ~0,55, mate como un roble al aceite; la pinotea plastificada, en ~0,42.
 * Más brillante, a contraluz y de lejos el piso chispea. Las fotos ya vienen
 * en su tono y, las de madera, armadas tabla por tabla para que no se repitan
 * a la vista (scripts/textures.mjs).
 */
type PhotoFloor = Exclude<FloorType, "estudio">;
const FLOOR_PHOTOS: Record<PhotoFloor, { id: PhotoId; roughness: number; relief: number }> = {
  madera: { id: "piso-madera", roughness: 1.45, relief: 0.8 },
  pinotea: { id: "piso-pinotea", roughness: 0.9, relief: 0.6 },
  cemento: { id: "piso-cemento", roughness: 1.15, relief: 0.45 },
  baldosa: { id: "piso-baldosa", roughness: 0.75, relief: 0.45 },
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
async function photoFloor(type: PhotoFloor): Promise<FloorLook> {
  const spec = FLOOR_PHOTOS[type];
  const set = await photoSet(spec.id);
  const size = PHOTOS[spec.id].size;
  // copias: la foto compartida queda con su repetición en metros
  const fit = (t?: THREE.Texture) => {
    if (!t) return null;
    const c = t.clone();
    c.repeat.set(FLOOR_SIZE / size[0], FLOOR_SIZE / size[1]);
    c.needsUpdate = true;
    return c;
  };
  return { map: fit(set.map), normalMap: fit(set.normalMap), roughnessMap: fit(set.roughnessMap), roughness: spec.roughness, relief: spec.relief, color: new THREE.Color("#ffffff") };
}

/** el piso de un color parejo, el promedio de su foto: lo que se ve hasta que la foto baja */
function plainFloor(type: PhotoFloor): FloorLook {
  return { map: null, normalMap: null, roughnessMap: null, roughness: 0.6, relief: 0, color: photoColor(FLOOR_PHOTOS[type].id, "#cfcbc4") };
}

/** el piso dibujado, para el primer cuadro y por si la foto no llega */
function drawnFloor(type: PhotoFloor): FloorLook {
  const make = (t: THREE.Texture, repeat: number) => {
    const c = t.clone();
    c.needsUpdate = true;
    c.repeat.set(repeat, repeat);
    return c;
  };
  const looks: Record<PhotoFloor, () => { map: THREE.Texture; roughness: number }> = {
    madera: () => ({ map: make(parquetTexture(), FLOOR_SIZE), roughness: 0.62 }),
    pinotea: () => ({ map: make(pinoteaTexture(), FLOOR_SIZE), roughness: 0.5 }),
    cemento: () => ({ map: make(concreteTexture(), FLOOR_SIZE / 3.5), roughness: 0.82 }),
    baldosa: () => ({ map: make(tileTexture(), FLOOR_SIZE / 1.2), roughness: 0.38 }),
  };
  const look = looks[type]();
  return { map: look.map, normalMap: null, roughnessMap: null, roughness: look.roughness, relief: 0, color: new THREE.Color("#ffffff") };
}

function applyFloor(m: THREE.MeshStandardMaterial, look: FloorLook) {
  m.map = look.map;
  m.normalMap = look.normalMap;
  m.roughnessMap = look.roughnessMap;
  m.roughness = look.roughness;
  // relieve suave: marcado, a contraluz y de lejos el piso chispea
  m.normalScale.setScalar(look.relief);
  m.userData.relief = look.relief;
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
  // con un mueble chico (una mesa de luz) el tabique no puede quedar angosto: se le ve el borde
  const middle = (min[0] + max[0]) / 2;
  const target = [
    left ? min[0] : Math.min(min[0] - WALL_MARGIN, middle - MIN_WALL / 2),
    right ? max[0] : Math.max(max[0] + WALL_MARGIN, middle + MIN_WALL / 2),
    min[2],
    max[2] + WALL_MARGIN,
  ];
  const sv = useRef(new SpringVec(target));
  sv.current.set(target);

  const backWall = useRef<THREE.Mesh>(null);
  const leftWall = useRef<THREE.Mesh>(null);
  const rightWall = useRef<THREE.Mesh>(null);
  const backSkirt = useRef<THREE.Mesh>(null);
  const leftSkirt = useRef<THREE.Mesh>(null);
  const rightSkirt = useRef<THREE.Mesh>(null);

  const mats = useMemo(() => {
    // arranca del color del piso elegido: cuando llega la foto, entra sobre su mismo tono
    const { relief: _relief, ...first } = plainFloor(floor === "estudio" ? "madera" : floor);
    const fade = fadeTexture();
    return {
      floor: new THREE.MeshStandardMaterial({ ...first, alphaMap: fade, transparent: true }),
      /** el piso nuevo entra con un fundido encima del anterior */
      floorNext: new THREE.MeshStandardMaterial({ ...first, alphaMap: fade, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }),
      // pintura sobre revoque: un relieve apenas visible cuando la luz pega de costado
      wall: dressWith(new THREE.MeshStandardMaterial({ color: wall, roughness: 0.95, transparent: true }), "pared", { normalScale: 0.35, project: true }),
      // esmalte satinado, apenas más claro que la pared
      skirt: new THREE.MeshStandardMaterial({ color: "#f3f0ea", roughness: 0.5, transparent: true }),
      shadow: new THREE.ShadowMaterial({ opacity: 0.16, transparent: true }),
      // pintura mate del ciclorama: del tono del cemento, para que el piso se funda sin costura
      // en el modo foto no hace sombra: la luz del ambiente entra como en un estudio abierto
      cove: Object.assign(new THREE.MeshStandardMaterial({ color: COVE_COLOR, roughness: 0.94, side: THREE.DoubleSide, transparent: true }), { castShadow: false }),
    };
    // el color de pared se anima aparte; no rehace los materiales
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  const wallColor = useRef(new THREE.Color(wall));
  useEffect(() => {
    wallColor.current.set(wall);
  }, [wall]);

  const root = useRef<THREE.Group>(null);
  const ground = useRef<THREE.Group>(null);
  const fade = useRef({ v: 1, active: false });
  const next = useRef<THREE.Mesh>(null);
  const base = useRef<THREE.Mesh>(null);
  useEffect(() => {
    let alive = true;
    // en el estudio liso no hay piso propio: el mueble apoya en el fondo
    if (floor === "estudio") return;
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
    const [l, r, zb, zf] = sv.current.v;
    const room = anim.room.v;
    // el piso y el fondo quedan quietos bajo la cámara: el mueble se centra corriéndose (ver
    // `Centered`) y el piso deshace ese corrimiento. Así el borde donde el piso se pierde
    // queda igual de lejos para todos lados, también con un sillón en el medio del ambiente,
    // y la veta no se desliza cuando cambia una medida
    const shift = root.current?.parent?.position;
    if (shift && ground.current) ground.current.position.set(-shift.x, 0, -shift.z);
    mats.wall.color.lerp(wallColor.current, 1 - Math.exp(-d * 6));
    for (const m of FADING) {
      const material = mats[m];
      material.opacity = room;
      material.depthWrite = room > 0.98;
      material.visible = room > 0.01;
    }
    // fundido del piso: cuando el nuevo tapa al viejo, pasa a ser el de abajo
    const f = fade.current;
    const plain = floor === "estudio";
    if (next.current) next.current.visible = f.active && !plain;
    if (base.current) base.current.visible = !plain;
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
          relief: mats.floorNext.userData.relief ?? 0,
          color: mats.floorNext.color,
        });
        mats.floorNext.opacity = 0;
        f.active = false;
      }
    }
    // sobre fondo liso no hay piso: la sombra de la luz principal se pinta sola
    mats.shadow.opacity = 0.26 * (1 - room);
    mats.shadow.visible = room < 0.99;

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
    // el zócalo corre al pie de cada pared, por la cara que da al ambiente
    const sh = SKIRT_HEIGHT * MM;
    const st = SKIRT_THICK * MM;
    if (backSkirt.current) {
      backSkirt.current.visible = back;
      backSkirt.current.position.set(((l + r) / 2) * MM, sh / 2, zb * MM + st / 2);
      backSkirt.current.scale.set((r - l) * MM, sh, st);
    }
    if (leftSkirt.current) {
      leftSkirt.current.visible = left;
      leftSkirt.current.position.set(l * MM + st / 2, sh / 2, ((zb + zf) / 2) * MM + st / 2);
      leftSkirt.current.scale.set(st, sh, (zf - zb) * MM - st);
    }
    if (rightSkirt.current) {
      rightSkirt.current.visible = right;
      rightSkirt.current.position.set(r * MM - st / 2, sh / 2, ((zb + zf) / 2) * MM + st / 2);
      rightSkirt.current.scale.set(st, sh, (zf - zb) * MM - st);
    }
  });

  const cove = useMemo(coveGeometry, []);
  useEffect(() => () => cove.dispose(), [cove]);

  return (
    <group ref={root} userData={{ noContact: true }}>
      <group ref={ground}>
      <mesh geometry={cove} material={mats.cove} position={[0, -COVE_DROP, 0]} receiveShadow />
      {/* piso: en el showroom se pierde en el fondo; en estudio solo queda la sombra */}
      <mesh ref={base} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow material={mats.floor}>
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
      </mesh>
      <mesh ref={next} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0002, 0]} receiveShadow material={mats.floorNext}>
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0005, 0]} receiveShadow material={mats.shadow} userData={{ fake: true }}>
        <planeGeometry args={[14, 14]} />
      </mesh>
      </group>

      <mesh ref={backWall} material={mats.wall} receiveShadow castShadow>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh ref={leftWall} material={mats.wall} receiveShadow castShadow>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh ref={rightWall} material={mats.wall} receiveShadow castShadow>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh ref={backSkirt} material={mats.skirt} receiveShadow castShadow>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh ref={leftSkirt} material={mats.skirt} receiveShadow castShadow>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh ref={rightSkirt} material={mats.skirt} receiveShadow castShadow>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
    </group>
  );
}
