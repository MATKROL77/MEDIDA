"use client";

import { useFrame, useThree } from "@react-three/fiber";
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

/** el piso es grande: se pierde en el fondo, sin bordes a la vista */
const FLOOR_SIZE = 60;
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
  cemento: { id: "piso-cemento", roughness: 0.72, color: "#bdb8b0" },
  baldosa: { id: "piso-baldosa", roughness: 0.4 },
};

/** el piso con su foto, repetida a su medida real */
async function photoFloor(type: FloorType): Promise<FloorLook> {
  const spec = FLOOR_PHOTOS[type];
  const set = await photoSet(spec.id);
  const size = PHOTOS[spec.id].size;
  const fit = (t?: THREE.Texture) => {
    if (!t) return null;
    t.repeat.set(FLOOR_SIZE / size[0], FLOOR_SIZE / size[1]);
    return t;
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
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const fog = useMemo(() => new THREE.Fog("#e6e1da", 8, 20), []);

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
    return {
      floor: new THREE.MeshStandardMaterial({ ...first, transparent: true }),
      /** el piso nuevo entra con un fundido encima del anterior */
      floorNext: new THREE.MeshStandardMaterial({ ...first, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }),
      // pintura sobre revoque: un relieve apenas visible cuando la luz pega de costado
      wall: dressWith(new THREE.MeshStandardMaterial({ color: wall, roughness: 0.95, transparent: true }), "pared", { normalScale: 0.35 }),
      // la tarima: cemento alisado claro, como un pedestal de museo
      podium: dressWith(new THREE.MeshStandardMaterial({ color: "#dcd8d1", roughness: 0.75, transparent: true }), "piso-cemento", {
        tint: tintFor("piso-cemento", "#d6d2cb"),
        roughness: 0.7,
        normalScale: 0.4,
      }),
      shadow: new THREE.ShadowMaterial({ opacity: 0.16, transparent: true }),
    };
    // el color de pared se anima aparte; no rehace los materiales
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  useEffect(
    () => () => {
      if (scene.fog === fog) scene.fog = null;
    },
    [scene, fog],
  );

  const wallColor = useRef(new THREE.Color(wall));
  useEffect(() => {
    wallColor.current.set(wall);
  }, [wall]);

  const fade = useRef({ v: 1, active: false });
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
    for (const m of [mats.floor, mats.wall, mats.podium]) {
      m.opacity = room;
      m.depthWrite = room > 0.98;
      m.visible = room > 0.01;
    }
    // fundido del piso: cuando el nuevo tapa al viejo, pasa a ser el de abajo
    const f = fade.current;
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

    // el piso se pierde en el fondo: niebla del mismo color, más allá del mueble
    if (room > 0.5 && scene.background instanceof THREE.Color) {
      const dist = camera.position.length();
      fog.color.copy(scene.background);
      fog.near = dist + 1.4;
      fog.far = dist + 9;
      scene.fog = fog;
    } else if (scene.fog === fog) scene.fog = null;

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

  return (
    <group>
      {/* piso: en el showroom se pierde en el fondo; en estudio solo queda la sombra */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow material={mats.floor}>
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0002, 0]} receiveShadow material={mats.floorNext}>
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0005, 0]} receiveShadow material={mats.shadow}>
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
