"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { Shape } from "@/lib/model";

import { clampDt, SOFT, SpringVec, useSceneAnim } from "./anim";
export { WALL_COLORS } from "./constants";
import type { FloorType } from "./constants";
import { concreteTexture, parquetTexture, pinoteaTexture, tileTexture } from "./materials";
import { MM } from "./PartNode";


type Props = {
  /** caja del placard en coordenadas de mundo (mm) */
  min: [number, number, number];
  max: [number, number, number];
  shape: Shape;
  wall: string;
  floor: FloorType;
};

const FLOOR_SIZE = 14;

/** textura, repetición y brillo de cada piso; se clonan para no pisar la repetición */
function floorLook(type: FloorType) {
  const make = (t: THREE.Texture, repeat: number) => {
    const c = t.clone();
    c.needsUpdate = true;
    c.repeat.set(repeat, repeat);
    return c;
  };
  switch (type) {
    // una repetición por metro: tablas de unos 16 cm
    case "madera":
      return { map: make(parquetTexture(), FLOOR_SIZE), roughness: 0.62 };
    case "pinotea":
      return { map: make(pinoteaTexture(), FLOOR_SIZE), roughness: 0.5 };
    case "cemento":
      return { map: make(concreteTexture(), FLOOR_SIZE / 3.5), roughness: 0.82 };
    // dos baldosas por textura: 60 cm cada una
    case "baldosa":
      return { map: make(tileTexture(), FLOOR_SIZE / 1.2), roughness: 0.38 };
  }
}

const ROOM_DEPTH = 4800;
const ROOM_HEIGHT = 2900;
const MARGIN = 650;

/**
 * La habitación: piso de parquet, paredes y zócalos. Las paredes y el piso son
 * de una sola cara, mirando hacia adentro: cuando la cámara pasa por detrás,
 * desaparecen solas y el placard se puede rodear entero.
 */
export function Room({ min, max, shape, wall, floor }: Props) {
  const anim = useSceneAnim();
  const left = shape === "l-left" ? 0 : min[0] - MARGIN;
  const right = shape === "l-right" ? max[0] : max[0] + MARGIN;
  const height = Math.max(ROOM_HEIGHT, max[1] + 300);
  const sv = useRef(new SpringVec([left, right, height]));
  sv.current.set([left, right, height]);

  const backWall = useRef<THREE.Mesh>(null);
  const leftWall = useRef<THREE.Mesh>(null);
  const rightWall = useRef<THREE.Mesh>(null);
  const baseBack = useRef<THREE.Mesh>(null);
  const baseLeft = useRef<THREE.Mesh>(null);
  const baseRight = useRef<THREE.Mesh>(null);
  const windowGroup = useRef<THREE.Group>(null);
  const windowInner = useRef<THREE.Group>(null);
  const daylight = useMemo(() => new THREE.Color("#fff6e8"), []);

  const mats = useMemo(() => {
    const first = floorLook("madera");
    return {
      floor: new THREE.MeshStandardMaterial({ ...first, transparent: true }),
      /** el piso nuevo entra con un fundido encima del anterior */
      floorNext: new THREE.MeshStandardMaterial({ ...first, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }),
      wall: new THREE.MeshStandardMaterial({ color: wall, roughness: 0.95, transparent: true }),
      base: new THREE.MeshStandardMaterial({ color: "#f4f2ee", roughness: 0.6, transparent: true }),
      glass: new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff6e8").multiplyScalar(2.2), toneMapped: false, transparent: true }),
      frame: new THREE.MeshStandardMaterial({ color: "#f4f2ee", roughness: 0.5, transparent: true }),
      shadow: new THREE.ShadowMaterial({ opacity: 0.16, transparent: true }),
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
  useEffect(() => {
    const look = floorLook(floor);
    mats.floorNext.map = look.map;
    mats.floorNext.roughness = look.roughness;
    mats.floorNext.needsUpdate = true;
    fade.current = { v: 0, active: true };
  }, [floor, mats]);

  useFrame((_, dt) => {
    const d = clampDt(dt);
    sv.current.step(d, SOFT);
    const [l, r, h] = sv.current.v;
    const room = anim.room.v;
    const night = 1 - 0.55 * anim.lights.v;
    mats.wall.color.lerp(wallColor.current, 1 - Math.exp(-d * 6));
    for (const m of [mats.floor, mats.wall, mats.base, mats.frame, mats.glass]) {
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
        mats.floor.map = mats.floorNext.map;
        mats.floor.roughness = mats.floorNext.roughness;
        mats.floor.needsUpdate = true;
        mats.floorNext.opacity = 0;
        f.active = false;
      }
    }
    mats.glass.color.copy(daylight).multiplyScalar(2.2 * night);
    // sobre fondo liso la sombra es lo único que apoya el mueble en el piso
    mats.shadow.opacity = 0.3 * (1 - room);

    const w = r - l;
    const cx = (l + r) / 2;
    if (backWall.current) {
      backWall.current.position.set(cx * MM, (h / 2) * MM, -2 * MM);
      backWall.current.scale.set(w * MM, h * MM, 1);
    }
    if (leftWall.current) {
      leftWall.current.position.set(l * MM, (h / 2) * MM, (ROOM_DEPTH / 2) * MM);
      leftWall.current.scale.set(ROOM_DEPTH * MM, h * MM, 1);
    }
    if (rightWall.current) {
      rightWall.current.position.set(r * MM, (h / 2) * MM, (ROOM_DEPTH / 2) * MM);
      rightWall.current.scale.set(ROOM_DEPTH * MM, h * MM, 1);
    }
    if (baseBack.current) {
      baseBack.current.position.set(cx * MM, 0.045, 12 * MM);
      baseBack.current.scale.set(w * MM, 0.09, 1);
    }
    if (baseLeft.current) {
      baseLeft.current.position.set((l + 12) * MM, 0.045, (ROOM_DEPTH / 2) * MM);
      baseLeft.current.scale.set(ROOM_DEPTH * MM, 0.09, 1);
    }
    if (baseRight.current) {
      baseRight.current.position.set((r - 12) * MM, 0.045, (ROOM_DEPTH / 2) * MM);
      baseRight.current.scale.set(ROOM_DEPTH * MM, 0.09, 1);
    }
    // la ventana va en la pared que no tiene placard
    if (windowGroup.current) {
      const onRight = shape !== "l-right";
      windowGroup.current.position.set((onRight ? r - 1 : l + 1) * MM, 0, 0);
      windowGroup.current.rotation.set(0, onRight ? -Math.PI / 2 : Math.PI / 2, 0);
      // girada, la x local corre hacia el frente en una pared y hacia atrás en la otra
      if (windowInner.current) windowInner.current.position.set(onRight ? 2.2 : -2.2, 0, 0);
    }
  });

  return (
    <group>
      {/* piso: parquet en habitación, solo sombra en estudio */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow material={mats.floor}>
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0002, 0]} receiveShadow material={mats.floorNext}>
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0005, 0]} receiveShadow material={mats.shadow}>
        <planeGeometry args={[14, 14]} />
      </mesh>

      <mesh ref={backWall} material={mats.wall} receiveShadow>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh ref={leftWall} material={mats.wall} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh ref={rightWall} material={mats.wall} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[1, 1]} />
      </mesh>

      <mesh ref={baseBack} material={mats.base}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh ref={baseLeft} material={mats.base} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh ref={baseRight} material={mats.base} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[1, 1]} />
      </mesh>

      {/* ventana: un paño luminoso con su marco, sobre la pared libre */}
      <group ref={windowGroup}>
        <group ref={windowInner}>
          <mesh position={[0, 1.55, 0.002]} material={mats.glass}>
            <planeGeometry args={[1.5, 1.35]} />
          </mesh>
          {[
            [0, 1.55 + 0.69, 1.6, 0.04],
            [0, 1.55 - 0.69, 1.6, 0.04],
            [-0.77, 1.55, 0.04, 1.42],
            [0.77, 1.55, 0.04, 1.42],
            [0, 1.55, 0.03, 1.35],
          ].map(([x, y, w, h], i) => (
            <mesh key={i} position={[x, y, 0.004]} material={mats.frame}>
              <planeGeometry args={[w, h]} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}
