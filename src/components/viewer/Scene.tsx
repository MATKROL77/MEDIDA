"use client";

import { Edges, Environment, Lightformer, OrbitControls, PerformanceMonitor, SoftShadows } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { aspectReach } from "@/lib/framing";
import type { Assembly, RunAssembly } from "@/lib/assembly";
import { ledHex, type WardrobeConfig } from "@/lib/model";
import { neutralInverse } from "@/lib/tone";

import { clampDt, DRAWER, FIRM, HEAVY, type SceneAnim, SceneAnimContext, SOFT, spring, springFor, SpringVec, step, useSceneAnim } from "./anim";
import { drawerGroupsOf, entranceOf, isCovered, leavesOf, overlaps, sweep } from "@/lib/motion";
import { createKit, disposeKit, frontMaterials, GLASS_OPACITY, type MaterialKit } from "./materials";
import { hiddenFaces } from "@/lib/gaps";
import { MM, PartNode, Presence } from "./PartNode";
import type { FloorType } from "./constants";
import { Grounding } from "./Grounding";
import { washMaterial } from "./ledWash";
import { createPhotoBus, photoCapable, type PhotoBus, PhotoMode, type PhotoStatus } from "./PhotoMode";
import { Room, type Walls } from "./Room";

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
  /** acercamiento que cambia en vivo: el visor del teléfono se achica al deslizar sin cambiar el tamaño del lienzo */
  zoom?: { current: number };
  /** fija la calidad, como ?calidad= en la dirección; la herramienta de capturas la cambia en vivo */
  quality?: "alta" | "baja";
  /** cuenta los cuadros dibujados en window.__medidaFrames, para la herramienta de capturas */
  countFrames?: boolean;
  /** modo foto: con la escena quieta, el 3D se recalcula con trazado de rayos */
  photo?: boolean;
  onPhoto?: (status: PhotoStatus) => void;
  /** muestras por píxel y tope de píxeles del modo foto (la herramienta de capturas pide más) */
  photoSamples?: number;
  photoPixels?: number;
};

/** fondo liso de partida: un gris apenas cálido, para que la madera no se enfríe */
export const STUDIO_BACKDROP = "#f0efed";

/** un color de fondo, con la luz que tiene que traer para salir de ese color después de la curva de tonos */
function backdropColor(hex: string): THREE.Color {
  const c = new THREE.Color(hex);
  const [r, g, b] = neutralInverse([c.r, c.g, c.b]);
  return c.setRGB(r, g, b);
}

/**
 * La luz del 3D rápido, como la de un planificador de muebles: mucha luz
 * pareja (la foto del estudio y un relleno de cielo y piso) para que los
 * blancos se lean blancos y los interiores se vean, y una luz principal suave
 * de costado, como de ventana, que da volumen y la sombra. `environment`, la
 * intensidad de la foto del estudio; `sky`, el relleno parejo; `key`, la luz
 * de ventana: la única luz directa y la única que hace sombra (cada luz
 * directa más se paga en cada píxel del mueble). Es la misma con paredes y
 * sobre fondo liso: el mueble no cambia de cara al cambiar de ambiente.
 */
const LIGHT = { environment: 0.72, sky: 1.15, key: 2.2 } as const;
/** con los LED prendidos el ambiente baja, como al atardecer: no a oscuras */
const DUSK = 0.5;
/** cuánto brilla el difusor de una tira prendida: lo justo para pasar el umbral del resplandor y dejar un halo suave */
const LENS_GLOW = 4.6;
/** cuánto blanco lleva el difusor prendido, y cuánto la luz que cae sobre las placas */
const LENS_WHITE = 0.45;
const WASH_WHITE = 0.5;

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
  // el difusor encendido se ve casi blanco, con el tono de la tira: así el halo es de luz y no una aureola de color
  const lens = useMemo(() => led.clone().lerp(new THREE.Color("#ffffff"), LENS_WHITE), [led]);
  // la luz que cae sobre una placa es menos teñida que la tira que la da: sobre un blanco se ve blanca cálida, no naranja
  const tint = useMemo(() => led.clone().lerp(new THREE.Color("#ffffff"), WASH_WHITE), [led]);
  const wash = useMemo(() => washMaterial(kit), [kit]);
  useEffect(() => () => wash.dispose(), [wash]);
  const fronts = useMemo(() => frontMaterials(kit), [kit]);
  const backdrop = props.backdrop ?? STUDIO_BACKDROP;
  // la curva de tonos aprieta los claros: el fondo liso entra con la luz justa para salir del color pedido
  const bg = useMemo(() => {
    const studio = backdropColor(backdrop);
    return { studio, room: backdropColor("#ece5d8"), cur: studio.clone() };
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
    let moving = step(anim.open, d, HEAVY);
    for (const s of anim.drawers.values()) moving = step(s, d, DRAWER) || moving;
    for (const s of anim.leaves.values()) moving = step(s, d, HEAVY) || moving;
    moving = step(anim.explode, d, FIRM) || moving;
    moving = step(anim.xray, d, SOFT) || moving;
    moving = step(anim.lights, d, SOFT) || moving;
    moving = step(anim.room, d, SOFT) || moving;
    if (moving) anim.activeAt = performance.now();

    const l = anim.lights.v;
    const x = anim.xray.v;
    const e = anim.explode.v;
    // el resorte de las luces rebota apenas: nunca por debajo de apagado
    const on = Math.max(0, l);
    kit.led.emissive.copy(lens);
    kit.led.emissiveIntensity = 0.02 + on * LENS_GLOW;
    // la luz sobre el hueco: su color y cuánto está prendida; despiezado, se apaga con las piezas que se van
    wash.uniforms.tint.value.copy(tint);
    wash.uniforms.strength.value = on * (1 - e) * (1 - e);
    for (const m of fronts) {
      m.opacity = 1 - 0.84 * x;
      m.depthWrite = m.opacity > 0.97;
    }
    kit.glass.opacity = GLASS_OPACITY * (1 - 0.7 * x);
    // con los LED prendidos el ambiente baja un poco, como al atardecer: no a oscuras
    scene.environmentIntensity = LIGHT.environment * (1 - DUSK * l);
    bg.cur.copy(bg.studio).lerp(bg.room, anim.room.v).multiplyScalar(1 - 0.2 * l);
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

/**
 * El softbox del modo foto: la luz principal del trazado de rayos, con la
 * intensidad con la que se calibró esa foto (no sigue a la luz del 3D rápido).
 */
const SOFTBOX = { room: 3.1 * 7.5, studio: 2.1 * 7.5 };

function KeyLight({ span, shape, rich }: { span: number; shape: WardrobeConfig["shape"]; rich: boolean }) {
  const anim = useSceneAnim();
  const key = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const softbox = useRef<THREE.RectAreaLight>(null);
  const side = shape === "l-right" ? -1 : 1;
  // la ventana: de costado y de frente, a media altura; la luz entra hasta el fondo de un placard abierto
  const keyPos = useMemo(() => new THREE.Vector3(side * 3.9, 4.4, 4.6), [side]);
  const softPos = useMemo(() => new THREE.Vector3(side * 4.5, 4.2, 3.6), [side]);
  useEffect(() => softbox.current?.lookAt(0, 0.6, 0), [softPos]);
  useFrame(() => {
    const night = 1 - DUSK * anim.lights.v;
    if (key.current) key.current.intensity = LIGHT.key * night;
    if (hemi.current) hemi.current.intensity = LIGHT.sky * night;
    if (softbox.current) softbox.current.intensity = (rich ? SOFTBOX.room : SOFTBOX.studio) * night;
  });
  const reach = Math.max(3, span * MM);
  return (
    <>
      {/* relleno: cielo blanco arriba y, más bajo, el rebote cálido del piso; así lo que mira para abajo
          queda más oscuro y las formas se leen. Va inclinado hacia el frente y hacia el lado contrario
          a la ventana: el costado que no mira a la luz no se apaga */}
      <hemisphereLight ref={hemi} args={["#ffffff", "#b4ada3", LIGHT.sky]} position={[-side * 0.45, 1, 0.55]} />
      {/* en la foto la luz principal es un softbox de verdad: sombras que se abren con la distancia */}
      <rectAreaLight ref={softbox} position={softPos} width={2.4} height={2.4} color="#fff3e2" visible={false} userData={{ photoOnly: true }} />
      <directionalLight
        ref={key}
        userData={{ fake: true }}
        position={keyPos}
        intensity={LIGHT.key}
        color="#fff9f1"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
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
  const inner = run.parts.filter((p) => p.module === module && p.kind !== "glow" && p.kind !== "led" && !p.front && p.kind !== "door");
  // un módulo que es solo una puerta (un cuerpo del mueble de TV): se marca la puerta
  const parts = inner.length ? inner : run.parts.filter((p) => p.module === module && p.kind !== "glow" && p.kind !== "led");
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
    <mesh ref={ref} raycast={() => null} userData={{ fake: true }}>
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
  const anim = useSceneAnim();
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
    dist *= aspectReach(aspect);
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
      anim.activeAt = performance.now();
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
function Capturer({ captureRef, countFrames, bus }: { captureRef?: ViewerProps["captureRef"]; countFrames?: boolean; bus: PhotoBus }) {
  const gl = useThree((s) => s.gl);
  const pending = useRef<((url: string | null) => void)[]>([]);
  useEffect(() => {
    if (!captureRef) return;
    captureRef.current = () =>
      new Promise((resolve) => {
        // el modo foto no redibuja si no cambió nada: para leer el lienzo hay que pedírselo
        bus.draw = true;
        pending.current.push(resolve);
      });
    return () => {
      captureRef.current = null;
    };
  }, [captureRef, bus]);
  useFrame(() => {
    if (countFrames) {
      const w = window as unknown as { __medidaFrames?: number };
      w.__medidaFrames = (w.__medidaFrames ?? 0) + 1;
    }
    if (!pending.current.length) return;
    // este cuadro lo dibujó el modo foto sin el pedido: se lee en el próximo
    if (bus.busy && bus.draw) return;
    let url: string | null = null;
    try {
      url = gl.domElement.toDataURL("image/jpeg", 0.92);
    } catch {
      url = null;
    }
    pending.current.splice(0).forEach((resolve) => resolve(url));
  }, 3);
  return null;
}

function useShown(bus: PhotoBus) {
  return useSyncExternalStore(
    (cb) => {
      bus.listeners.add(cb);
      return () => bus.listeners.delete(cb);
    },
    () => bus.shown,
    () => false,
  );
}

function Effects({ hq, rich, bus }: { hq: boolean; rich: boolean; bus: PhotoBus }) {
  // mientras la foto tapa todo, el compositor no dibuja: la placa de video queda para el trazado
  const enabled = !useShown(bus);
  // curva de tonos neutra (la de Khronos para mostrar productos): los colores salen como son
  // y solo se aprietan los brillos; una melamina blanca se lee blanca, sin quemarse
  const tone = ToneMappingMode.NEUTRAL;
  // el resplandor es solo de los LED y de algún brillo del metal: ni el fondo liso ni un blanco a plena luz llegan
  const threshold = 1.45;
  // la oclusión marca los rincones y el apoyo, sin tapar los huecos: corta y suave, en un marrón oscuro
  const ao = { aoRadius: 0.3, distanceFalloff: 1, color: "#22160d", halfRes: true } as const;
  // dos composiciones fijas: el compositor no admite hijos que aparecen y desaparecen
  if (hq)
    return (
      <EffectComposer enabled={enabled} multisampling={2} enableNormalPass={false}>
        <N8AO {...ao} intensity={rich ? 2.2 : 1.8} quality="medium" />
        <Bloom mipmapBlur intensity={0.7} luminanceThreshold={threshold} luminanceSmoothing={0.3} radius={0.7} />
        <Vignette offset={0.3} darkness={0.2} />
        <ToneMapping mode={tone} />
      </EffectComposer>
    );
  // en equipos chicos se va la oclusión, que es lo más caro; el brillo de los LED queda
  return (
    <EffectComposer enabled={enabled} multisampling={0} enableNormalPass={false}>
      {/* sin oclusión un tapizado parece plástico: en los ambientes armados queda, a media resolución */}
      {rich ? <N8AO {...ao} intensity={2} quality="performance" /> : <></>}
      <Bloom mipmapBlur intensity={0.7} luminanceThreshold={threshold} luminanceSmoothing={0.3} radius={0.7} />
      <Vignette offset={0.3} darkness={0.2} />
      <ToneMapping mode={tone} />
      <SMAA />
    </EffectComposer>
  );
}

/** qué paredes necesita lo que se muestra: el placard siempre va contra la pared, recto o en L */
export function wallsOf(props: Pick<ViewerProps, "assembly" | "config">): Walls {
  return props.assembly.walls ?? (props.config.shape === "straight" ? "back" : props.config.shape);
}

function Wardrobe({ props, kit, hq }: { props: ViewerProps; kit: MaterialKit; hq: boolean }) {
  const anim = useSceneAnim();
  const walls = wallsOf(props);
  // las caras metidas en ranuras (entre frentes, detrás de ellos): van en sombra
  const hidden = useMemo(() => new Map(props.assembly.runs.map((r) => [r.index, hiddenFaces(r.parts)])), [props.assembly]);
  // la caja de cada tramo: de ahí sale de qué lado llega cada pieza al armarse
  const boxes = useMemo(() => {
    const map = new Map<number, { min: [number, number, number]; max: [number, number, number] }>();
    for (const r of props.assembly.runs) {
      const min: [number, number, number] = [Infinity, Infinity, Infinity];
      const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
      for (const p of r.parts) {
        if (p.decor || p.kind === "glow") continue;
        for (let i = 0; i < 3; i++) {
          min[i] = Math.min(min[i], p.position[i]);
          max[i] = Math.max(max[i], p.position[i] + p.size[i]);
        }
      }
      map.set(r.index, { min, max });
    }
    return map;
  }, [props.assembly]);
  // qué módulo hay en cada posición a lo ancho: tocar el fondo o un estante corrido elige el módulo de ese lugar
  const moduleAt = useMemo(() => {
    const map = new Map<number, (x: number) => number | null>();
    for (const r of props.assembly.runs) {
      const spans = new Map<number, [number, number]>();
      for (const p of r.parts) {
        if (p.module === null || p.decor || p.kind === "glow" || p.kind === "led") continue;
        const s = spans.get(p.module);
        spans.set(p.module, s ? [Math.min(s[0], p.position[0]), Math.max(s[1], p.position[0] + p.size[0])] : [p.position[0], p.position[0] + p.size[0]]);
      }
      map.set(r.index, (x: number) => {
        let best: number | null = null;
        let gap = 40;
        for (const [m, [a, b]] of spans) {
          const d = x < a ? a - x : x > b ? x - b : 0;
          // adentro de dos a la vez (un divisor compartido): el de centro más cercano
          const off = d + Math.abs(x - (a + b) / 2) * 1e-3;
          if (off < gap) {
            gap = off;
            best = m;
          }
        }
        return best;
      });
    }
    return map;
  }, [props.assembly]);
  // cómo entra cada pieza: se decide una vez, cuando aparece
  const entrances = useRef(new Map<string, { delay: number; from: [number, number, number] | null }>());
  return (
    <Centered assembly={props.assembly}>
      <Room
        min={(props.assembly.room ?? props.assembly.bounds).min}
        max={(props.assembly.room ?? props.assembly.bounds).max}
        walls={walls}
        wall={props.environment.wall}
        floor={props.environment.floor}
      />
      {/* sombra de apoyo: lo que hace que el mueble pise el piso en vez de flotar */}
      <Grounding assembly={props.assembly} hq={hq} strength={props.environment.mode === "room" ? 0.62 : 0.5} />
      {props.assembly.runs.map((run) => (
        <RunGroup key={run.index} run={run}>
          <Presence parts={run.parts}>
            {(p, gone) => {
              const key = `${run.index}:${p.id}`;
              let entrance = entrances.current.get(key);
              if (gone) entrances.current.delete(key);
              else if (!entrance) {
                // al cargar, el mueble se arma pieza por pieza, en orden de taller; después,
                // lo que se agrega (un módulo, un estante, un cajón) llega enseguida
                const age = typeof performance === "undefined" ? 0 : (performance.now() - anim.bornAt) / 1000;
                const e = entranceOf(p, boxes.get(run.index)!, walls);
                const first = props.intro !== false && age < 1.2;
                entrance = { delay: first ? 0.25 + e.order * 1.45 + run.index * 0.15 : 0.02 + e.order * 0.4, from: props.intro === false ? null : e.from };
                entrances.current.set(key, entrance);
              }
              return <PartNode key={p.id} part={p} exiting={gone} kit={kit} delay={entrance?.delay ?? 0} from={entrance?.from} moduleAt={moduleAt.get(run.index)} onSelect={props.onSelect} onLeaf={props.onLeaf} hidden={hidden.get(run.index)?.get(p.id)} />;
            }}
          </Presence>
          {props.selection && props.selection.run === run.index && <SelectionBox run={run} module={props.selection.module} />}
        </RunGroup>
      ))}
    </Centered>
  );
}

/** mientras baja la foto del estudio: una habitación clara armada con paneles de luz */
function StudioFallback() {
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={["#d8d2c8"]} />
      <Lightformer form="rect" intensity={0.55} color="#9a7350" position={[0, -2.5, 0]} rotation-x={-Math.PI / 2} scale={[30, 30, 1]} />
      <Lightformer form="rect" intensity={1.6} position={[0, 6, 1]} rotation-x={Math.PI / 2} scale={[12, 8, 1]} />
      <Lightformer form="rect" intensity={2.6} color="#fff1df" position={[6, 2.2, 2.5]} rotation-y={-Math.PI / 2} scale={[3, 2.4, 1]} />
      <Lightformer form="rect" intensity={0.7} color="#e8eef5" position={[-6, 2, 2]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} />
      <Lightformer form="rect" intensity={0.9} position={[0, 1.8, 7]} scale={[8, 3, 1]} />
    </Environment>
  );
}

/**
 * Con todo quieto, el 3D deja de dibujar: un cuadro con sombras suaves,
 * oclusión y brillo cuesta lo mismo aunque nada cambie, y redibujarlo 60
 * veces por segundo calienta la compu y traba el teléfono. Cualquier toque,
 * cambio de opción, deslizamiento o textura que termina de bajar lo despierta;
 * se vuelve a dormir cuando pasaron unos segundos sin nada (las puertas,
 * los cajones y la cámara ya llegaron a su lugar).
 *
 * Antes de dormirse pide el cuadro final a toda nitidez (`onStill`): mientras
 * algo se mueve el 3D usa la resolución que el equipo aguanta fluido, y quieto
 * queda dibujado con la mejor que la pantalla puede mostrar.
 */
const SLEEP_AFTER_MS = 2200;
const SHARP_FRAMES_MS = 450;
function Sleeper({ keepAwake, still, onStill }: { keepAwake: boolean; still: boolean; onStill: (still: boolean) => void }) {
  const setFrameloop = useThree((s) => s.setFrameloop);
  const get = useThree((s) => s.get);
  const invalidate = useThree((s) => s.invalidate);
  const element = useThree((s) => s.gl.domElement);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const anim = useSceneAnim();
  const state = useRef({ last: performance.now(), asleep: false, sharpAt: 0, still, seen: 0, quiet: 0 });
  const wake = useRef(() => {});
  wake.current = () => {
    state.current.last = performance.now();
    if (state.current.sharpAt) {
      state.current.sharpAt = 0;
      onStill(false);
    }
    if (state.current.asleep) {
      state.current.asleep = false;
      setFrameloop("always");
    }
    invalidate();
  };
  // cada vez que cambia algo de la escena (una opción, abrir, rayos X…) o el tamaño del visor,
  // que hace volar la cámara a su nuevo encuadre
  useEffect(() => {
    // pasar al cuadro nítido (o volver) también redibuja este componente: eso no es un cambio
    if (state.current.still !== still) state.current.still = still;
    else wake.current();
  });
  const size = useThree((s) => s.size);
  useEffect(() => wake.current(), [size.width, size.height]);
  useEffect(() => {
    // mover el mouse por encima sin apretar no cambia nada: no despierta
    const on = (e?: Event) => {
      if (e?.type === "pointermove" && !(e as PointerEvent).buttons) return;
      wake.current();
    };
    // los toques llegan al contenedor del lienzo (ahí escuchan la cámara y la selección)
    const host = element.parentElement?.parentElement ?? element;
    const opts = { passive: true } as const;
    for (const type of ["pointerdown", "pointermove", "wheel", "touchstart"] as const) host.addEventListener(type, on, opts);
    window.addEventListener("scroll", on, opts);
    window.addEventListener("keydown", on);
    const onControls = () => wake.current();
    controls?.addEventListener("change", onControls);
    // lo que termina de bajar (texturas, la foto del estudio, la decoración) también despierta
    const manager = THREE.DefaultLoadingManager;
    const prevLoad = manager.onLoad;
    const prevProgress = manager.onProgress;
    manager.onLoad = () => {
      prevLoad?.();
      on();
    };
    manager.onProgress = (...a) => {
      prevProgress?.(...a);
      on();
    };
    return () => {
      for (const type of ["pointerdown", "pointermove", "wheel", "touchstart"] as const) host.removeEventListener(type, on);
      window.removeEventListener("scroll", on);
      window.removeEventListener("keydown", on);
      controls?.removeEventListener("change", onControls);
      manager.onLoad = prevLoad;
      manager.onProgress = prevProgress;
    };
  }, [element, controls]);
  useEffect(() => {
    if (keepAwake) wake.current();
  }, [keepAwake]);
  useFrame(() => {
    const st = state.current;
    // el lienzo puede volver a "always" desde afuera (al redibujarse el componente): se lee el real
    if (get().frameloop !== "always") return;
    st.asleep = false;
    // mientras una pieza, una puerta o la cámara se mueven, no se duerme
    const now = performance.now();
    // además del tiempo, tienen que haber pasado unos cuadros quietos: en un equipo lento
    // dos segundos pueden ser dos cuadros, y las sombras todavía se están acomodando
    if (anim.activeAt !== st.seen) {
      st.seen = anim.activeAt;
      st.quiet = 0;
    } else st.quiet++;
    if (keepAwake || st.quiet < 8 || now - Math.max(st.last, anim.activeAt) < SLEEP_AFTER_MS) return;
    if (!st.sharpAt) {
      st.sharpAt = now;
      onStill(true);
      return;
    }
    if (now - st.sharpAt < SHARP_FRAMES_MS) return;
    st.asleep = true;
    setFrameloop("demand");
  });
  return null;
}

/**
 * Girar la cámara no cambia las sombras: el mapa de sombras solo se vuelve a
 * dibujar mientras algo del mueble se mueve (una medida, una puerta, una pieza
 * que llega) o termina de bajar un modelo. Dar vueltas alrededor del mueble,
 * que es lo que más se hace, cuesta así un dibujo de la escena en vez de dos.
 */
function ShadowGate() {
  const anim = useSceneAnim();
  const gl = useThree((s) => s.gl);
  const dirtyUntil = useRef(0);
  // cuadros que faltan rehacer: se cuenta en cuadros además de en tiempo, así en un equipo
  // lento la sombra no queda como estaba a mitad de un movimiento
  const pending = useRef({ frames: 6, seen: 0 });
  // cada vez que cambia lo que se muestra, y un rato después por si algo se acomoda
  useEffect(() => {
    dirtyUntil.current = performance.now() + 400;
    pending.current.frames = Math.max(pending.current.frames, 4);
  });
  useEffect(() => {
    const manager = THREE.DefaultLoadingManager;
    const prev = manager.onLoad;
    manager.onLoad = () => {
      prev?.();
      dirtyUntil.current = performance.now() + 400;
      pending.current.frames = Math.max(pending.current.frames, 4);
    };
    return () => {
      manager.onLoad = prev;
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);
  useFrame(() => {
    const now = performance.now();
    gl.shadowMap.autoUpdate = false;
    const p = pending.current;
    if (anim.activeAt !== p.seen) {
      p.seen = anim.activeAt;
      p.frames = Math.max(p.frames, 4);
    }
    if (p.frames > 0 || now < dirtyUntil.current || now - anim.activeAt < 300) {
      gl.shadowMap.needsUpdate = true;
      if (p.frames > 0) p.frames--;
    }
  }, -1);
  return null;
}

/** el acercamiento en vivo del visor del teléfono (ver `useScrollShrink`) */
function ViewZoom({ zoom }: { zoom?: { current: number } }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useFrame(() => {
    const z = zoom?.current ?? 1;
    if (Math.abs(camera.zoom - z) < 1e-4) return;
    camera.zoom = z;
    camera.updateProjectionMatrix();
  });
  return null;
}

/** foto HDR de un estudio fotográfico real (Poly Haven, CC0): reflejos y luz de relleno creíbles */
export const STUDIO_HDRI = "/env/studio_small_09-1k.hdr";

function SceneContents(props: ViewerProps & { hq: boolean; bus: PhotoBus; photoOn: boolean; mobile: boolean; awake: boolean; still: boolean; onStill: (still: boolean) => void }) {
  const kit = useMemo(() => createKit(props.config.bodyMaterial, props.config.doorMaterial, props.fabric, props.weave), [props.config.bodyMaterial, props.config.doorMaterial, props.fabric, props.weave]);
  useEffect(() => () => disposeKit(kit), [kit]);
  const { min, max } = props.assembly.bounds;
  const span = Math.max(max[0] - min[0], max[2] - min[2], max[1]);

  return (
    <>
      <AnimDriver props={props} kit={kit} />
      {/* reflejos y luz de relleno: la foto HDR de un estudio, para que el espejo,
          el metal y el laqueado reflejen ventanas y paneles de luz de verdad */}
      <Suspense fallback={<StudioFallback />}>
        <Environment files={STUDIO_HDRI} />
      </Suspense>
      <KeyLight span={span} shape={props.config.shape} rich={!!props.confine} />
      {/* sombras de borde difuso, que se abren con la distancia, como bajo la luz de un showroom */}
      <SoftShadows size={22} samples={8} focus={0.55} />
      <Wardrobe props={props} kit={kit} hq={props.hq} />
      <ViewZoom zoom={props.zoom} />
      <ShadowGate />
      {/* el trazado de rayos, las capturas y la calidad fija necesitan cuadros sin parar */}
      <Sleeper keepAwake={props.photoOn || props.awake || !!props.countFrames || !!props.sway} still={props.still} onStill={props.onStill} />
      <CameraRig assembly={props.assembly} view={props.view} intro={props.intro !== false} sway={!!props.sway && !props.photoOn} framing={props.framing ?? 1} minRadius={props.confine ? 1.05 : 0} />
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
      <Effects hq={props.hq} rich={!!props.confine} bus={props.bus} />
      <PhotoMode enabled={props.photoOn} bus={props.bus} onStatus={props.onPhoto} maxPixels={props.photoPixels ?? (props.mobile ? 5e5 : 1.4e6)} samples={props.photoSamples ?? (props.mobile ? 160 : 420)} />
      <Capturer captureRef={props.captureRef} countFrames={props.countFrames} bus={props.bus} />
    </>
  );
}

/**
 * Tope de resolución por cantidad de píxeles: en una pantalla Retina grande,
 * el doble de densidad son cuatro veces los píxeles y la oclusión y las
 * sombras suaves se calculan en cada uno. Con ~2,4 millones de píxeles el
 * mueble se ve nítido y el 3D anda fluido en una notebook.
 */
function pixelCap(maxDpr: number): number {
  if (typeof window === "undefined") return 1;
  const area = Math.max(1, window.innerWidth * window.innerHeight);
  return Math.max(1, Math.min(maxDpr, Math.sqrt(2.4e6 / area)));
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
  // la calidad fija alta es para grabar: usa la densidad de la pantalla que la pide
  const fixedDpr = forcedHigh && typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
  const [dpr, setDpr] = useState(forcedLow || forcedHigh ? fixedDpr : Math.min(1.5, maxDpr, pixelCap(maxDpr)));
  const intro = props.intro !== false;
  // quieto, el último cuadro se dibuja con la mejor nitidez que la pantalla muestra
  const [still, setStill] = useState(false);
  const stillRef = useRef(false);
  stillRef.current = still;
  const sharpDpr = still && !forcedLow && !forcedHigh && typeof window !== "undefined" ? Math.max(dpr, Math.min(maxDpr, window.devicePixelRatio || 1, pixelCap(maxDpr))) : dpr;
  // la calidad fijada puede cambiar con la escena ya andando
  useEffect(() => {
    if (!forcedLow && !forcedHigh) return;
    setHq(forcedHigh);
    setDpr(fixedDpr);
  }, [forcedLow, forcedHigh, fixedDpr]);
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
      activeAt: 0,
    }),
    // el estado de la escena se crea una sola vez
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const bus = useMemo(createPhotoBus, []);
  const [capable, setCapable] = useState(false);
  const [mobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
  const photoOn = !!props.photo && capable && !forcedLow;
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
        dpr={sharpDpr}
        frameloop={props.paused ? "never" : "always"}
        gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
        camera={{ position: [4, 3, 7], fov: 34, near: 0.05, far: 80 }}
        onCreated={({ gl }) => {
          setCapable(photoCapable(gl));
          onReady?.();
        }}
      >
        {/* la calidad baja sola si el equipo no llega a 60 cuadros */}
        <PerformanceMonitor
          onIncline={() => {
            if (forcedLow || forcedHigh || bus.busy) return;
            setHq(true);
            setDpr(Math.min(maxDpr, window.devicePixelRatio, pixelCap(maxDpr)));
          }}
          onDecline={() => {
            // el trazado usa la placa a propósito: esos cuadros lentos no cuentan
            // (tampoco los del cuadro final a toda nitidez)
            if (forcedHigh || bus.busy || stillRef.current) return;
            setHq(false);
            setDpr(1);
          }}
          flipflops={3}
          onFallback={() => {
            if (forcedHigh || bus.busy || stillRef.current) return;
            setHq(false);
            setDpr(1);
          }}
        />
        <SceneAnimContext.Provider value={anim}>
          <SceneContents {...props} hq={hq} bus={bus} photoOn={photoOn} mobile={mobile} awake={forcedHigh} still={still} onStill={setStill} />
        </SceneAnimContext.Provider>
      </Canvas>
    </SceneAnimContext.Provider>
  );
}
