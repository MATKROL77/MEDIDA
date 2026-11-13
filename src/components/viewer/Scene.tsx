"use client";

import { ContactShadows, Edges, Environment, Lightformer, OrbitControls, PerformanceMonitor, SoftShadows } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import type { Assembly, RunAssembly } from "@/lib/assembly";
import { ledHex, type WardrobeConfig } from "@/lib/model";

import { clampDt, DRAWER, FIRM, HEAVY, type SceneAnim, SceneAnimContext, SOFT, spring, springFor, SpringVec, step, useSceneAnim } from "./anim";
import { drawerGroupsOf, isCovered, leavesOf, overlaps, sweep } from "@/lib/motion";
import { createKit, disposeKit, frontMaterials, GLASS_OPACITY, type MaterialKit } from "./materials";
import { MM, PartNode, Presence } from "./PartNode";
import type { FloorType } from "./constants";
import { PODIUM_HEIGHT, Room, type Walls } from "./Room";

export type ViewName = "front" | "three" | "side" | "top" | "back";

export type ViewerProps = {
  config: WardrobeConfig;
  assembly: Assembly;
  selection: { run: number; module: number } | null;
  onSelect: (run: number, module: number) => void;
  open: boolean;
  xray: boolean;
  explode: boolean;
  lights: boolean;
  environment: { mode: "room" | "studio"; wall: string; floor: FloorType };
  view: { name: ViewName; nonce: number };
  onReady?: () => void;
  /** cuánto corrió el cliente cada hoja corrediza (mm); vacío = cerradas */
  leafOffsets: Record<string, number>;
  onLeaf?: (id: string) => void;
  /** se llena con una función que devuelve una captura del 3D (JPEG, data URL) */
  captureRef?: React.MutableRefObject<(() => Promise<string | null>) | null>;
  /**
   * false: sin vuelo de cámara ni armado escalonado al cargar. La landing lo usa
   * para que el 3D aparezca igual a la imagen fija que había antes.
   */
  intro?: boolean;
  /** cuánto puede mover la cámara la persona: todo, solo girar, o nada */
  orbit?: "full" | "rotate" | "none";
  /** vaivén lento de la cámara mientras nadie la toca */
  sway?: boolean;
  /** deja de dibujar: el visor salió de la pantalla */
  paused?: boolean;
  /** color del fondo liso */
  backdrop?: string;
  /** la cámara no sale de la habitación: no se ve el ambiente desde arriba ni desde atrás de las paredes */
  confine?: boolean;
  /** color del tapizado, para los muebles que lo llevan */
  fabric?: string;
  /** el tipo de tela: lino, pana o bouclé (cambia la trama y el brillo) */
  weave?: string;
  /** tope de resolución del lienzo */
  maxDpr?: number;
  /** encuadre: menos de 1 acerca la cámara (sin barras encima del visor sobra margen) */
  framing?: number;
  /** fija la calidad, como ?calidad= en la dirección; la herramienta de capturas la cambia en vivo */
  quality?: "alta" | "baja";
  /** cuenta los cuadros dibujados en window.__medidaFrames, para la herramienta de capturas */
  countFrames?: boolean;
};

/** fondo liso de partida: un gris apenas cálido, para que la madera no se enfríe */
export const STUDIO_BACKDROP = "#f0efed";
/** cuánto más intenso entra el fondo liso para compensar el mapeo de tonos */
const STUDIO_GAIN = 1.75;

const VIEW_DIRS: Record<ViewName, [number, number, number]> = {
  front: [0, 0.14, 1],
  three: [0.62, 0.34, 1],
  side: [1, 0.18, 0.12],
  top: [0.001, 1, 0.04],
  back: [-0.25, 0.22, -1],
};

/** pone los objetivos de los resortes globales y los avanza un paso por cuadro */
function AnimDriver({ props, kit }: { props: ViewerProps; kit: MaterialKit }) {
  const anim = useSceneAnim();
  const scene = useThree((s) => s.scene);
  const hasDoors = props.config.doors !== "none";
  // con sensor, la luz se prende sola al abrir las puertas
  const lightsOn = props.lights || (props.config.led.sensor && hasDoors && props.open);
  anim.explode.target = props.explode ? 1 : 0;
  anim.xray.target = props.xray ? 1 : 0;
  anim.lights.target = lightsOn ? 1 : 0;
  anim.room.target = props.environment.mode === "room" ? 1 : 0;

  const led = useMemo(() => new THREE.Color(ledHex(props.config)), [props.config]);
  const fronts = useMemo(() => frontMaterials(kit), [kit]);
  const backdrop = props.backdrop ?? STUDIO_BACKDROP;
  // el mapeo de tonos oscurece los claros: el fondo liso entra con ganancia para salir del color pedido
  const bg = useMemo(() => {
    const studio = new THREE.Color(backdrop).multiplyScalar(STUDIO_GAIN);
    return { studio, room: new THREE.Color("#e7e2db"), cur: studio.clone() };
  }, [backdrop]);

  const motion = useMemo(
    () => ({ leaves: leavesOf(props.assembly), groups: drawerGroupsOf(props.assembly) }),
    [props.assembly],
  );
  // lo que se pide y lo que está pasando se leen en cada cuadro desde acá
  const wanted = useRef({ open: props.open, offsets: props.leafOffsets, doors: props.config.doors });
  wanted.current = { open: props.open, offsets: props.open ? props.leafOffsets : {}, doors: props.config.doors };

  useFrame((_, dt) => {
    const d = clampDt(dt);
    sequence(anim, motion, wanted.current);
    step(anim.open, d, HEAVY);
    for (const s of anim.drawers.values()) step(s, d, DRAWER);
    for (const s of anim.leaves.values()) step(s, d, HEAVY);
    step(anim.explode, d, FIRM);
    step(anim.xray, d, SOFT);
    step(anim.lights, d, SOFT);
    step(anim.room, d, SOFT);

    const l = anim.lights.v;
    const x = anim.xray.v;
    const e = anim.explode.v;
    kit.led.emissive.copy(led);
    kit.led.emissiveIntensity = 0.02 + l * 5.5;
    const glowBase = l * (1 - 0.85 * e);
    kit.glow.z.color.copy(led);
    kit.glow.z.opacity = glowBase * 0.85;
    kit.glow.y.color.copy(led);
    kit.glow.y.opacity = glowBase * 0.6;
    kit.glow["x+"].color.copy(led);
    kit.glow["x+"].opacity = glowBase * 0.55;
    kit.glow["x-"].color.copy(led);
    kit.glow["x-"].opacity = glowBase * 0.55;
    for (const m of fronts) {
      m.opacity = 1 - 0.84 * x;
      m.depthWrite = m.opacity > 0.97;
    }
    kit.glass.opacity = GLASS_OPACITY * (1 - 0.7 * x);
    // de noche el ambiente baja para que se luzcan los LED
    scene.environmentIntensity = (props.confine ? 0.55 : 1) * (1 - 0.62 * l);
    bg.cur.copy(bg.studio).lerp(bg.room, anim.room.v).multiplyScalar(1 - 0.35 * l);
    scene.background = bg.cur;
  });
  return null;
}

/**
 * El orden real de las cosas, decidido cuadro a cuadro:
 * - al abrir, primero las puertas y después los cajones; al cerrar, al revés;
 * - una hoja corrediza no arranca si en su camino hay un cajón afuera: primero
 *   se cierra el cajón;
 * - un cajón sólo sale si ninguna hoja lo tapa, ni ahora ni donde van a
 *   quedar, y si ninguna puerta le queda delante.
 */
function sequence(
  anim: SceneAnim,
  motion: { leaves: ReturnType<typeof leavesOf>; groups: ReturnType<typeof drawerGroupsOf> },
  want: { open: boolean; offsets: Record<string, number>; doors: WardrobeConfig["doors"] },
) {
  const current: Record<string, number> = {};
  const target: Record<string, number> = {};
  for (const l of motion.leaves) {
    current[l.id] = springFor(anim.leaves, l.id).v;
    target[l.id] = want.offsets[l.id] ?? 0;
  }
  // tramos que barren las hojas que todavía tienen que moverse
  const sweeps = motion.leaves
    .filter((l) => Math.abs(target[l.id] - current[l.id]) > 1)
    .map((l) => ({ leaf: l, span: sweep(l, current[l.id], target[l.id]) }));

  for (const g of motion.groups) {
    const s = springFor(anim.drawers, g.key);
    let out = want.open && !g.blocked;
    if (want.doors === "hinged") out &&= anim.open.v > 0.96;
    if (want.doors === "sliding") {
      out &&= !isCovered(motion.leaves, target, g) && !isCovered(motion.leaves, current, g);
      out &&= !sweeps.some((w) => w.leaf.run === g.run && overlaps(w.span, g));
    }
    s.target = out ? 1 : 0;
  }

  const drawerOut = (pred: (g: (typeof motion.groups)[number]) => boolean = () => true) =>
    motion.groups.some((g) => pred(g) && springFor(anim.drawers, g.key).v > 0.06);

  // batientes: no se cierran mientras quede un cajón afuera
  if (want.open) anim.open.target = 1;
  else if (!drawerOut()) anim.open.target = 0;

  // corredizas: cada hoja arranca cuando su camino está libre. Una hoja que
  // empuja a otra de su riel espera a que la otra arranque: si la empujada
  // está esperando que se cierre un cajón, la que empuja la atravesaría
  const started = (l: (typeof motion.leaves)[number]) => springFor(anim.leaves, l.id).target === target[l.id];
  for (const w of sweeps) {
    if (started(w.leaf)) continue;
    const drawerInWay = drawerOut((g) => g.run === w.leaf.run && overlaps(w.span, g));
    const mateInWay = sweeps.some(
      (o) =>
        o.leaf !== w.leaf &&
        o.leaf.run === w.leaf.run &&
        o.leaf.track === w.leaf.track &&
        !started(o.leaf) &&
        Math.min(w.span[1], o.leaf.home + current[o.leaf.id] + o.leaf.width) - Math.max(w.span[0], o.leaf.home + current[o.leaf.id]) > 1,
    );
    if (!drawerInWay && !mateInWay) springFor(anim.leaves, w.leaf.id).target = target[w.leaf.id];
  }
}

function KeyLight({ span, shape, rich }: { span: number; shape: WardrobeConfig["shape"]; rich: boolean }) {
  // en un ambiente armado la luz viene de un lado y el relleno baja: hay sombra y volumen
  const keyPower = rich ? 3.1 : 2.1;
  const fill = rich ? 0.26 : 0.55;
  const anim = useSceneAnim();
  const key = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const side = shape === "l-right" ? -1 : 1;
  useFrame(() => {
    const night = 1 - 0.7 * anim.lights.v;
    if (key.current) key.current.intensity = keyPower * night;
    if (hemi.current) hemi.current.intensity = fill * night;
  });
  const reach = Math.max(3, span * MM);
  return (
    <>
      <hemisphereLight ref={hemi} args={["#ffffff", "#d8ccbb", 0.55]} />
      <directionalLight
        ref={key}
        position={[side * 4.5, 4.2, 3.6]}
        intensity={2.1}
        color="#fff3e2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
        shadow-camera-left={-reach}
        shadow-camera-right={reach}
        shadow-camera-top={reach}
        shadow-camera-bottom={-reach * 0.4}
        shadow-camera-near={0.5}
        shadow-camera-far={16}
      />
    </>
  );
}

/** el tramo entero se desliza o gira con resorte cuando cambia la forma o el largo */
function RunGroup({ run, children }: { run: RunAssembly; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const target = [run.offset[0], run.offset[2], run.rotationY];
  const sv = useRef<SpringVec | null>(null);
  if (!sv.current) sv.current = new SpringVec(target);
  sv.current.set(target);
  useFrame((_, dt) => {
    sv.current!.step(clampDt(dt), FIRM);
    const [x, z, r] = sv.current!.v;
    if (ref.current) {
      ref.current.position.set(x * MM, 0, z * MM);
      ref.current.rotation.set(0, r, 0);
    }
  });
  return <group ref={ref}>{children}</group>;
}

/** recuadro del módulo elegido mientras se edita el interior */
function SelectionBox({ run, module }: { run: RunAssembly; module: number }) {
  const parts = run.parts.filter((p) => p.module === module && p.kind !== "glow" && p.kind !== "led" && !p.front && p.kind !== "door");
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], p.position[k]);
      max[k] = Math.max(max[k], p.position[k] + p.size[k]);
    }
  }
  const target = parts.length ? [min[0], min[1], min[2], max[0] - min[0], max[1] - min[1], max[2] - min[2]] : [0, 0, 0, 0, 0, 0];
  const sv = useRef<SpringVec | null>(null);
  if (!sv.current) sv.current = new SpringVec(target);
  sv.current.set(target);
  const ref = useRef<THREE.Mesh>(null);
  const anim = useSceneAnim();
  useFrame((_, dt) => {
    sv.current!.step(clampDt(dt), FIRM);
    const [x, y, z, w, h, d] = sv.current!.v;
    const e = anim.explode.v;
    if (ref.current) {
      ref.current.position.set((x + w / 2) * MM, (y + h / 2) * MM, (z + d / 2) * MM);
      ref.current.scale.set(Math.max(w, 1) * MM * 1.01, Math.max(h, 1) * MM * 1.004, Math.max(d, 1) * MM * 1.01);
      ref.current.visible = e < 0.2;
    }
  });
  return (
    <mesh ref={ref} raycast={() => null}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      <Edges color="#c06a26" lineWidth={1.8} renderOrder={5} transparent opacity={0.9} />
    </mesh>
  );
}

/** centra el placard en el origen, con resorte, para que la cámara gire alrededor */
function Centered({ assembly, children }: { assembly: Assembly; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const { min, max } = assembly.bounds;
  const target = [-(min[0] + max[0]) / 2, -(min[2] + max[2]) / 2];
  const sv = useRef<SpringVec | null>(null);
  if (!sv.current) sv.current = new SpringVec(target);
  sv.current.set(target);
  useFrame((_, dt) => {
    sv.current!.step(clampDt(dt), FIRM);
    ref.current?.position.set(sv.current!.v[0] * MM, 0, sv.current!.v[1] * MM);
  });
  return <group ref={ref}>{children}</group>;
}

/**
 * Cámara: vuela suave a cada vista y se reencuadra cuando cambia el tamaño.
 * Si la persona agarra la cámara, el vuelo se corta y manda ella.
 */
function CameraRig({ assembly, view, intro, sway, framing, minRadius }: { assembly: Assembly; view: ViewerProps["view"]; intro: boolean; sway: boolean; framing: number; minRadius: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const size = useThree((s) => s.size);
  const flight = useRef<{ pos: THREE.Vector3; target: THREE.Vector3; snap?: boolean } | null>(null);
  const first = useRef(true);
  // vaivén: desde qué ángulo oscila, desde cuándo, y si la persona tiene la cámara
  const swing = useRef({ base: 0, since: 0, held: false, releasedAt: -Infinity, flying: true });
  const { min, max } = assembly.bounds;
  const dims = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const key = dims.map((d) => Math.round(d / 50)).join("x");

  const fit = (dir: THREE.Vector3) => {
    // un mueble chico no se mira con la cámara pegada: se ve con algo de su ambiente
    const radius = Math.max(minRadius, 0.5 * Math.hypot(dims[0], dims[1], dims[2]) * MM);
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const aspect = size.width / size.height;
    // margen para la barra de arriba y la de abajo del visor
    let dist = (radius / Math.sin(fov / 2)) * 1.1 * framing;
    if (aspect < 1) dist /= Math.pow(aspect, 0.85);
    const target = new THREE.Vector3(0, dims[1] * 0.46 * MM, 0);
    return { pos: target.clone().addScaledVector(dir.clone().normalize(), dist), target };
  };

  // vista pedida desde la barra
  useEffect(() => {
    if (first.current) return;
    flight.current = fit(new THREE.Vector3(...VIEW_DIRS[view.name]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.nonce]);

  // cambio de tamaño: mismo ángulo, nueva distancia
  useEffect(() => {
    if (first.current) {
      const f = fit(new THREE.Vector3(...VIEW_DIRS[view.name]));
      if (intro) {
        // entrada: arranca lejos y alto y llega volando
        camera.position.copy(f.pos.clone().multiplyScalar(1.9).add(new THREE.Vector3(1.5, 1.2, 0)));
        flight.current = f;
      } else {
        // sin entrada: la cámara ya está en su lugar desde el primer cuadro
        camera.position.copy(f.pos);
        camera.lookAt(f.target);
        flight.current = { ...f, snap: true };
      }
      first.current = false;
      return;
    }
    const dir = camera.position.clone().sub(controls?.target ?? new THREE.Vector3());
    flight.current = fit(dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, size.width, size.height]);

  useEffect(() => {
    if (!controls) return;
    const stop = () => {
      flight.current = null;
      swing.current.held = true;
    };
    const release = () => {
      swing.current.held = false;
      swing.current.releasedAt = performance.now();
    };
    controls.addEventListener("start", stop);
    controls.addEventListener("end", release);
    return () => {
      controls.removeEventListener("start", stop);
      controls.removeEventListener("end", release);
    };
  }, [controls]);

  useFrame((state, dt) => {
    if (!controls) return;
    const f = flight.current;
    const w = swing.current;
    if (f) {
      w.flying = true;
      if (f.snap) {
        camera.position.copy(f.pos);
        controls.target.copy(f.target);
        controls.update();
        flight.current = null;
        return;
      }
      const k = 1 - Math.exp(-clampDt(dt) * 3.2);
      camera.position.lerp(f.pos, k);
      controls.target.lerp(f.target, k);
      controls.update();
      if (camera.position.distanceTo(f.pos) < 0.003 && controls.target.distanceTo(f.target) < 0.003) flight.current = null;
      return;
    }
    if (!sway) return;
    // después de que la persona suelta la cámara, espera un rato antes de volver a moverla
    const idle = !w.held && performance.now() - w.releasedAt > 3500;
    if (!idle) {
      w.flying = true;
      return;
    }
    const t = state.clock.elapsedTime;
    if (w.flying) {
      // retoma desde donde quedó la cámara, sin salto
      w.base = controls.getAzimuthalAngle();
      w.since = t;
      w.flying = false;
    }
    controls.setAzimuthalAngle(w.base + Math.sin((t - w.since) * 0.32) * 0.26);
    controls.update();
  });
  return null;
}

/**
 * Captura del 3D para la tapa del PDF. Se lee justo después de que el
 * compositor dibuja el cuadro, antes de que el navegador limpie el lienzo.
 */
function Capturer({ captureRef, countFrames }: { captureRef?: ViewerProps["captureRef"]; countFrames?: boolean }) {
  const gl = useThree((s) => s.gl);
  const pending = useRef<((url: string | null) => void)[]>([]);
  useEffect(() => {
    if (!captureRef) return;
    captureRef.current = () => new Promise((resolve) => pending.current.push(resolve));
    return () => {
      captureRef.current = null;
    };
  }, [captureRef]);
  useFrame(() => {
    if (countFrames) {
      const w = window as unknown as { __medidaFrames?: number };
      w.__medidaFrames = (w.__medidaFrames ?? 0) + 1;
    }
    if (!pending.current.length) return;
    let url: string | null = null;
    try {
      url = gl.domElement.toDataURL("image/jpeg", 0.92);
    } catch {
      url = null;
    }
    pending.current.splice(0).forEach((resolve) => resolve(url));
  }, 2);
  return null;
}

function Effects({ hq, studio, rich }: { hq: boolean; studio: boolean; rich: boolean }) {
  // en un ambiente armado, una curva de película: negros más profundos y color más lleno
  const tone = rich ? ToneMappingMode.ACES_FILMIC : ToneMappingMode.AGX;
  // sobre fondo liso el fondo es más brillante que cualquier superficie: el
  // umbral del brillo sube para que solo brillen los LED, y la viñeta se afloja
  const threshold = studio ? 2.4 : 0.92;
  const darkness = studio ? 0.24 : 0.45;
  // dos composiciones fijas: el compositor no admite hijos que aparecen y desaparecen
  if (hq)
    return (
      <EffectComposer multisampling={4} enableNormalPass={false}>
        <N8AO aoRadius={rich ? 0.6 : 0.45} intensity={rich ? 3.4 : 2.4} distanceFalloff={0.9} quality="medium" />
        <Bloom mipmapBlur intensity={0.85} luminanceThreshold={threshold} luminanceSmoothing={0.25} radius={0.7} />
        <Vignette offset={0.3} darkness={darkness} />
        <ToneMapping mode={tone} />
      </EffectComposer>
    );
  // en equipos chicos se va la oclusión, que es lo más caro; el brillo de los LED queda
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {/* sin oclusión un tapizado parece plástico: en los ambientes armados queda, a media resolución */}
      {rich ? <N8AO aoRadius={0.6} intensity={3} distanceFalloff={0.9} quality="performance" halfRes /> : <></>}
      <Bloom mipmapBlur intensity={0.85} luminanceThreshold={threshold} luminanceSmoothing={0.25} radius={0.7} />
      <Vignette offset={0.3} darkness={darkness} />
      <ToneMapping mode={tone} />
      <SMAA />
    </EffectComposer>
  );
}

function Grounding({ assembly }: { assembly: Assembly }) {
  const { min, max } = assembly.room ?? assembly.bounds;
  const w = (max[0] - min[0]) * MM;
  const d = (max[2] - min[2]) * MM + 1.2;
  return (
    <ContactShadows
      position={[((min[0] + max[0]) / 2) * MM, 0.016, (min[2] * MM + d / 2)]}
      scale={[w, d]}
      resolution={512}
      far={0.9}
      blur={2.2}
      opacity={0.62}
      color="#1a120c"
      frames={Infinity}
    />
  );
}

/** qué paredes necesita lo que se muestra: el placard siempre va contra la pared, recto o en L */
export function wallsOf(props: Pick<ViewerProps, "assembly" | "config">): Walls {
  return props.assembly.walls ?? (props.config.shape === "straight" ? "back" : props.config.shape);
}

/** lo suelto se muestra sobre la tarima del showroom: sube con ella, y baja cuando se pasa a fondo liso */
function Lift({ on, children }: { on: boolean; children: React.ReactNode }) {
  const anim = useSceneAnim();
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    ref.current?.position.set(0, on ? PODIUM_HEIGHT * MM * anim.room.v : 0, 0);
  });
  return <group ref={ref}>{children}</group>;
}

function Wardrobe({ props, kit }: { props: ViewerProps; kit: MaterialKit }) {
  const anim = useSceneAnim();
  const totalH = Math.max(1, props.assembly.bounds.max[1]);
  const walls = wallsOf(props);
  return (
    <Centered assembly={props.assembly}>
      <Room
        min={(props.assembly.room ?? props.assembly.bounds).min}
        max={(props.assembly.room ?? props.assembly.bounds).max}
        walls={walls}
        wall={props.environment.wall}
        floor={props.environment.floor}
      />
      <Lift on={walls === "none"}>
      {/* sombra de apoyo: lo que hace que el mueble pise el piso en vez de flotar */}
      {props.confine && <Grounding assembly={props.assembly} />}
      {props.assembly.runs.map((run) => (
        <RunGroup key={run.index} run={run}>
          <Presence parts={run.parts}>
            {(p, gone) => {
              // al cargar, el placard se arma de abajo hacia arriba
              const age = typeof performance === "undefined" ? 0 : (performance.now() - anim.bornAt) / 1000;
              const delay = props.intro !== false && age < 1.2 ? 0.15 + (p.position[1] / totalH) * 0.55 + run.index * 0.12 : 0;
              return <PartNode key={p.id} part={p} exiting={gone} kit={kit} delay={delay} onSelect={props.onSelect} onLeaf={props.onLeaf} />;
            }}
          </Presence>
          {props.selection && props.selection.run === run.index && <SelectionBox run={run} module={props.selection.module} />}
        </RunGroup>
      ))}
      </Lift>
    </Centered>
  );
}

function SceneContents(props: ViewerProps & { hq: boolean }) {
  const kit = useMemo(() => createKit(props.config.bodyMaterial, props.config.doorMaterial, props.fabric, props.weave), [props.config.bodyMaterial, props.config.doorMaterial, props.fabric, props.weave]);
  useEffect(() => () => disposeKit(kit), [kit]);
  const { min, max } = props.assembly.bounds;
  const span = Math.max(max[0] - min[0], max[2] - min[2], max[1]);

  return (
    <>
      <AnimDriver props={props} kit={kit} />
      {/* reflejos: una habitación clara con piso de madera, para que el espejo y el
          metal reflejen algo creíble y no un fondo negro */}
      <Environment resolution={256} frames={1}>
        <color attach="background" args={["#d8d2c8"]} />
        <Lightformer form="rect" intensity={0.55} color="#9a7350" position={[0, -2.5, 0]} rotation-x={-Math.PI / 2} scale={[30, 30, 1]} />
        <Lightformer form="rect" intensity={1.6} position={[0, 6, 1]} rotation-x={Math.PI / 2} scale={[12, 8, 1]} />
        <Lightformer form="rect" intensity={2.6} color="#fff1df" position={[6, 2.2, 2.5]} rotation-y={-Math.PI / 2} scale={[3, 2.4, 1]} />
        <Lightformer form="rect" intensity={0.7} color="#e8eef5" position={[-6, 2, 2]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} />
        <Lightformer form="rect" intensity={0.9} position={[0, 1.8, 7]} scale={[8, 3, 1]} />
      </Environment>
      <KeyLight span={span} shape={props.config.shape} rich={!!props.confine} />
      {/* sombras de borde difuso, que se abren con la distancia, como bajo la luz de un showroom */}
      <SoftShadows size={22} samples={10} focus={0.55} />
      <Wardrobe props={props} kit={kit} />
      <CameraRig assembly={props.assembly} view={props.view} intro={props.intro !== false} sway={!!props.sway} framing={props.framing ?? 1} minRadius={props.confine ? 1.05 : 0} />
      <OrbitControls
        makeDefault
        enabled={props.orbit !== "none"}
        enableZoom={!props.orbit || props.orbit === "full"}
        enablePan={!props.orbit || props.orbit === "full"}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.75}
        zoomSpeed={0.8}
        minDistance={0.6}
        maxDistance={props.confine ? 9 : 18}
        minPolarAngle={props.confine ? 0.5 : 0}
        maxPolarAngle={props.confine ? 1.52 : Math.PI}
        // contra una pared no se puede ir por detrás; lo suelto se rodea entero
        minAzimuthAngle={props.confine && wallsOf(props) !== "none" ? -1.05 : -Infinity}
        maxAzimuthAngle={props.confine && wallsOf(props) !== "none" ? 1.05 : Infinity}
      />
      <Effects hq={props.hq} studio={props.environment.mode === "studio"} rich={!!props.confine} />
      <Capturer captureRef={props.captureRef} countFrames={props.countFrames} />
    </>
  );
}

export default function Scene(props: ViewerProps) {
  // ?calidad=baja fuerza el modo liviano, para equipos muy viejos;
  // ?calidad=alta la deja fija arriba (para grabar videos cuadro a cuadro)
  const [forced] = useState(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("calidad")));
  const wanted = props.quality ?? forced;
  const forcedLow = wanted === "baja";
  const forcedHigh = wanted === "alta";
  const [hq, setHq] = useState(!forcedLow);
  const maxDpr = props.maxDpr ?? 2;
  const [dpr, setDpr] = useState(forcedLow || forcedHigh ? 1 : Math.min(1.5, maxDpr));
  const intro = props.intro !== false;
  // la calidad fijada puede cambiar con la escena ya andando
  useEffect(() => {
    if (!forcedLow && !forcedHigh) return;
    setHq(forcedHigh);
    setDpr(1);
  }, [forcedLow, forcedHigh]);
  const anim = useMemo<SceneAnim>(
    () => ({
      open: spring(),
      drawers: new Map(),
      leaves: new Map(),
      explode: spring(),
      xray: spring(),
      lights: spring(),
      room: spring(props.environment.mode === "room" ? 1 : 0),
      bornAt: typeof performance === "undefined" ? 0 : performance.now(),
      // sin entrada: lo que se monta en el primer momento aparece ya armado
      settledUntil: intro || typeof performance === "undefined" ? 0 : performance.now() + 500,
    }),
    // el estado de la escena se crea una sola vez
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const { onReady } = props;
  // al grabar un video, el guion lee el estado de puertas, cajones y luces
  // cuadro a cuadro para poner los sonidos donde de verdad se mueven las cosas
  useEffect(() => {
    if (forcedHigh) (window as unknown as { __medidaAnim?: SceneAnim }).__medidaAnim = anim;
  }, [forcedHigh, anim]);

  return (
    <SceneAnimContext.Provider value={anim}>
      <Canvas
        shadows="soft"
        flat
        dpr={dpr}
        frameloop={props.paused ? "never" : "always"}
        gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
        camera={{ position: [4, 3, 7], fov: 34, near: 0.05, far: 80 }}
        onCreated={() => onReady?.()}
      >
        {/* la calidad baja sola si el equipo no llega a 60 cuadros */}
        <PerformanceMonitor
          onIncline={() => {
            if (forcedLow || forcedHigh) return;
            setHq(true);
            setDpr(Math.min(maxDpr, window.devicePixelRatio));
          }}
          onDecline={() => {
            if (forcedHigh) return;
            setHq(false);
            setDpr(1);
          }}
          flipflops={3}
          onFallback={() => {
            if (forcedHigh) return;
            setHq(false);
            setDpr(1);
          }}
        />
        <SceneAnimContext.Provider value={anim}>
          <SceneContents {...props} hq={hq} />
        </SceneAnimContext.Provider>
      </Canvas>
    </SceneAnimContext.Provider>
  );
}
