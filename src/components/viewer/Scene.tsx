"use client";

import { Edges, Environment, Lightformer, OrbitControls, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import type { Assembly, RunAssembly } from "@/lib/assembly";
import { ledHex, type WardrobeConfig } from "@/lib/model";

import { clampDt, FIRM, type SceneAnim, SceneAnimContext, SOFT, spring, SpringVec, step, useSceneAnim } from "./anim";
import { createKit, disposeKit, frontMaterials, type MaterialKit } from "./materials";
import { MM, PartNode, Presence } from "./PartNode";
import { Room } from "./Room";

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
  environment: { mode: "room" | "studio"; wall: string };
  view: { name: ViewName; nonce: number };
  onReady?: () => void;
};

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
  anim.open.target = props.open ? 1 : 0;
  anim.explode.target = props.explode ? 1 : 0;
  anim.xray.target = props.xray ? 1 : 0;
  anim.lights.target = lightsOn ? 1 : 0;
  anim.room.target = props.environment.mode === "room" ? 1 : 0;

  const led = useMemo(() => new THREE.Color(ledHex(props.config)), [props.config]);
  const fronts = useMemo(() => frontMaterials(kit), [kit]);
  const bg = useMemo(() => ({ studio: new THREE.Color("#ebe6df"), room: new THREE.Color("#e9e4dc"), cur: new THREE.Color("#ebe6df") }), []);

  useFrame((_, dt) => {
    const d = clampDt(dt);
    step(anim.open, d, FIRM);
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
    kit.glow.z.opacity = glowBase * 0.7;
    kit.glow.y.color.copy(led);
    kit.glow.y.opacity = glowBase * 0.5;
    kit.glow["x+"].color.copy(led);
    kit.glow["x+"].opacity = glowBase * 0.45;
    kit.glow["x-"].color.copy(led);
    kit.glow["x-"].opacity = glowBase * 0.45;
    for (const m of fronts) {
      m.opacity = 1 - 0.84 * x;
      m.depthWrite = m.opacity > 0.97;
    }
    kit.glass.opacity = 0.55 * (1 - 0.7 * x);
    // de noche el ambiente baja para que se luzcan los LED
    scene.environmentIntensity = 1 - 0.62 * l;
    bg.cur.copy(bg.studio).lerp(bg.room, anim.room.v).multiplyScalar(1 - 0.35 * l);
    scene.background = bg.cur;
  });
  return null;
}

function KeyLight({ span, shape }: { span: number; shape: WardrobeConfig["shape"] }) {
  const anim = useSceneAnim();
  const key = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const side = shape === "l-right" ? -1 : 1;
  useFrame(() => {
    const night = 1 - 0.7 * anim.lights.v;
    if (key.current) key.current.intensity = 2.1 * night;
    if (hemi.current) hemi.current.intensity = 0.55 * night;
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
function CameraRig({ assembly, view }: { assembly: Assembly; view: ViewerProps["view"] }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const size = useThree((s) => s.size);
  const flight = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const first = useRef(true);
  const { min, max } = assembly.bounds;
  const dims = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const key = dims.map((d) => Math.round(d / 50)).join("x");

  const fit = (dir: THREE.Vector3) => {
    const radius = 0.5 * Math.hypot(dims[0], dims[1], dims[2]) * MM;
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const aspect = size.width / size.height;
    // margen para la barra de arriba y la de abajo del visor
    let dist = (radius / Math.sin(fov / 2)) * 1.1;
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
      // entrada: arranca lejos y alto y llega volando
      const f = fit(new THREE.Vector3(...VIEW_DIRS.three));
      camera.position.copy(f.pos.clone().multiplyScalar(1.9).add(new THREE.Vector3(1.5, 1.2, 0)));
      flight.current = f;
      first.current = false;
      return;
    }
    const dir = camera.position.clone().sub(controls?.target ?? new THREE.Vector3());
    flight.current = fit(dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, size.width, size.height]);

  useEffect(() => {
    if (!controls) return;
    const stop = () => (flight.current = null);
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [controls]);

  useFrame((_, dt) => {
    const f = flight.current;
    if (!f || !controls) return;
    const k = 1 - Math.exp(-clampDt(dt) * 3.2);
    camera.position.lerp(f.pos, k);
    controls.target.lerp(f.target, k);
    controls.update();
    if (camera.position.distanceTo(f.pos) < 0.003 && controls.target.distanceTo(f.target) < 0.003) flight.current = null;
  });
  return null;
}

function Effects({ hq }: { hq: boolean }) {
  // dos composiciones fijas: el compositor no admite hijos que aparecen y desaparecen
  if (hq)
    return (
      <EffectComposer multisampling={4} enableNormalPass={false}>
        <N8AO aoRadius={0.45} intensity={2.4} distanceFalloff={0.9} quality="medium" />
        <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.92} luminanceSmoothing={0.25} radius={0.7} />
        <ToneMapping mode={ToneMappingMode.AGX} />
      </EffectComposer>
    );
  // en equipos chicos se va la oclusión, que es lo más caro; el brillo de los LED queda
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.92} luminanceSmoothing={0.25} radius={0.7} />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <SMAA />
    </EffectComposer>
  );
}

function Wardrobe({ props, kit }: { props: ViewerProps; kit: MaterialKit }) {
  const anim = useSceneAnim();
  const totalH = Math.max(1, props.assembly.bounds.max[1]);
  return (
    <Centered assembly={props.assembly}>
      <Room min={props.assembly.bounds.min} max={props.assembly.bounds.max} shape={props.config.shape} wall={props.environment.wall} />
      {props.assembly.runs.map((run) => (
        <RunGroup key={run.index} run={run}>
          <Presence parts={run.parts}>
            {(p, gone) => {
              // al cargar, el placard se arma de abajo hacia arriba
              const age = typeof performance === "undefined" ? 0 : (performance.now() - anim.bornAt) / 1000;
              const delay = age < 1.2 ? 0.15 + (p.position[1] / totalH) * 0.55 + run.index * 0.12 : 0;
              return <PartNode key={p.id} part={p} exiting={gone} kit={kit} delay={delay} onSelect={props.onSelect} />;
            }}
          </Presence>
          {props.selection && props.selection.run === run.index && <SelectionBox run={run} module={props.selection.module} />}
        </RunGroup>
      ))}
    </Centered>
  );
}

function SceneContents(props: ViewerProps & { hq: boolean }) {
  const kit = useMemo(() => createKit(props.config.bodyMaterial, props.config.doorMaterial), [props.config.bodyMaterial, props.config.doorMaterial]);
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
      <KeyLight span={span} shape={props.config.shape} />
      <Wardrobe props={props} kit={kit} />
      <CameraRig assembly={props.assembly} view={props.view} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.75}
        zoomSpeed={0.8}
        minDistance={0.6}
        maxDistance={18}
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
      />
      <Effects hq={props.hq} />
    </>
  );
}

export default function Scene(props: ViewerProps) {
  // ?calidad=baja fuerza el modo liviano, para equipos muy viejos
  const [forcedLow] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("calidad") === "baja");
  const [hq, setHq] = useState(!forcedLow);
  const [dpr, setDpr] = useState(forcedLow ? 1 : 1.5);
  const anim = useMemo<SceneAnim>(
    () => ({ open: spring(), explode: spring(), xray: spring(), lights: spring(), room: spring(1), bornAt: typeof performance === "undefined" ? 0 : performance.now() }),
    [],
  );
  const { onReady } = props;

  return (
    <SceneAnimContext.Provider value={anim}>
      <Canvas
        shadows="soft"
        flat
        dpr={dpr}
        gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
        camera={{ position: [4, 3, 7], fov: 34, near: 0.05, far: 80 }}
        onCreated={() => onReady?.()}
      >
        {/* la calidad baja sola si el equipo no llega a 60 cuadros */}
        <PerformanceMonitor
          onIncline={() => {
            if (forcedLow) return;
            setHq(true);
            setDpr(Math.min(2, window.devicePixelRatio));
          }}
          onDecline={() => {
            setHq(false);
            setDpr(1);
          }}
          flipflops={3}
          onFallback={() => {
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
