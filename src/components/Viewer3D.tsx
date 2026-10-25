"use client";

import { ContactShadows, Edges, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";

import type { Part } from "@/lib/assembly";
import { materialById } from "@/lib/catalog";
import type { WardrobeConfig } from "@/lib/model";

const MM = 0.001;
const OPEN_ANGLE = (100 * Math.PI) / 180;

type Props = {
  config: WardrobeConfig;
  parts: Part[];
  doorsOpen: boolean;
  selectedModule: number | null;
  onSelectModule?: (module: number) => void;
};

/**
 * Vetas dibujadas en un canvas: no hay que bajar imágenes y cada material
 * nuevo del catálogo tiene su textura sin trabajo extra. "along" dice si las
 * vetas corren a lo largo de la U o de la V de la cara.
 */
const textureCache = new Map<string, THREE.Texture>();
function grainTexture(color: string, along: "u" | "v"): THREE.Texture {
  const key = `${color}-${along}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);

  // pseudoaleatorio con semilla fija: la misma veta en cada render
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 140; i++) {
    const offset = rand() * size;
    const wobble = 2 + rand() * 6;
    const freq = 0.004 + rand() * 0.01;
    ctx.strokeStyle = rand() > 0.5 ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.06)";
    ctx.lineWidth = 0.6 + rand() * 2.4;
    ctx.beginPath();
    for (let s = 0; s <= size; s += 8) {
      const d = offset + Math.sin(s * freq + i) * wobble;
      const [px, py] = along === "v" ? [d, s] : [s, d];
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  textureCache.set(key, texture);
  return texture;
}

function PartMesh({ part, config, highlighted, onSelect, opacity = 1 }: {
  part: Part;
  config: WardrobeConfig;
  highlighted: boolean;
  onSelect?: () => void;
  opacity?: number;
}) {
  const [sx, sy, sz] = part.size.map((v) => v * MM);
  const center: [number, number, number] = [
    (part.position[0] + part.size[0] / 2 - config.width / 2) * MM,
    (part.position[1] + part.size[1] / 2) * MM,
    (part.position[2] + part.size[2] / 2 - config.depth / 2) * MM,
  ];

  const material = useMemo(() => {
    if (part.material === "metal") return { color: "#b9bcc0", metalness: 0.8, roughness: 0.3 };
    if (part.material === "back") return { color: "#e9e4da", metalness: 0, roughness: 0.9 };
    const m = materialById(part.material);
    if (!m.grain) return { color: m.color, metalness: 0, roughness: 0.62 };
    // la veta sigue el largo de corte: vertical en laterales y puertas
    const vertical = part.cut ? Math.abs(part.cut.length - part.size[1]) < 1 : true;
    return { map: grainTexture(m.color, vertical ? "v" : "u"), color: "#ffffff", metalness: 0, roughness: 0.55 };
  }, [part]);

  return (
    <mesh
      position={center}
      castShadow
      receiveShadow
      onClick={
        onSelect
          ? (e) => {
              e.stopPropagation();
              onSelect();
            }
          : undefined
      }
    >
      <boxGeometry args={[sx, sy, sz]} />
      {/* cambiar transparent no recompila el shader: con la key se crea uno nuevo */}
      <meshStandardMaterial
        key={opacity < 1 ? "see-through" : "solid"}
        {...material}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity === 1}
      />
      <Edges color={highlighted ? "#8a5528" : "#3b352d"} lineWidth={highlighted ? 1.6 : 0.6} threshold={20} />
    </mesh>
  );
}

/** puerta batiente: gira sobre su borde de bisagra con un resorte suave */
function HingedDoor({ part, config, open }: { part: Part; config: WardrobeConfig; open: boolean }) {
  const pivot = useRef<THREE.Group>(null);
  const left = part.hinge !== "right";
  const pivotX = left ? part.position[0] : part.position[0] + part.size[0];
  const pivotZ = part.position[2];

  useFrame((_, delta) => {
    if (!pivot.current) return;
    const target = open ? (left ? -OPEN_ANGLE : OPEN_ANGLE) : 0;
    pivot.current.rotation.y = THREE.MathUtils.damp(pivot.current.rotation.y, target, 6, delta);
  });

  // la puerta se dibuja relativa al pivote para que el giro sea sobre la bisagra
  const local: Part = {
    ...part,
    position: [part.position[0] - pivotX + config.width / 2, part.position[1], part.position[2] - pivotZ + config.depth / 2],
  };

  return (
    <group ref={pivot} position={[(pivotX - config.width / 2) * MM, 0, (pivotZ - config.depth / 2) * MM]}>
      <PartMesh part={local} config={config} highlighted={false} />
      {config.handle !== "none" && (
        <Handle
          kind={config.handle}
          x={(left ? part.size[0] - 50 : 50 - part.size[0]) * MM}
          y={(part.position[1] + part.size[1] / 2) * MM}
          z={(part.size[2] + 12) * MM}
          height={part.size[1]}
        />
      )}
    </group>
  );
}

function Handle({ kind, x, y, z, height, horizontal = false }: {
  kind: "bar" | "knob";
  x: number;
  y: number;
  z: number;
  /** alto (o ancho, si es horizontal) del frente que lo lleva, en mm */
  height: number;
  horizontal?: boolean;
}) {
  if (kind === "knob")
    return (
      <mesh position={[x, y, z]} castShadow>
        <sphereGeometry args={[0.014, 20, 16]} />
        <meshStandardMaterial color="#2b2b2b" metalness={0.6} roughness={0.35} />
      </mesh>
    );
  const len = Math.min(0.32, height * MM * 0.18);
  return (
    <mesh position={[x, y, z]} castShadow>
      <boxGeometry args={horizontal ? [len, 0.012, 0.012] : [0.012, len, 0.012]} />
      <meshStandardMaterial color="#2b2b2b" metalness={0.6} roughness={0.35} />
    </mesh>
  );
}

function Wardrobe({ config, parts, doorsOpen, selectedModule, onSelectModule }: Props) {
  return (
    <group>
      {parts.map((part) => {
        if (part.kind === "door") return <HingedDoor key={part.id} part={part} config={config} open={doorsOpen} />;
        if (part.kind === "sliding-door")
          return <SlidingDoor key={part.id} part={part} config={config} open={doorsOpen} />;
        const highlighted = selectedModule !== null && part.module === selectedModule && part.kind !== "back";
        const mesh = (
          <PartMesh
            key={part.id}
            part={part}
            config={config}
            highlighted={highlighted}
            onSelect={part.module !== null && onSelectModule ? () => onSelectModule(part.module!) : undefined}
          />
        );
        // sin puertas, los cajones quedan a la vista y llevan su propio tirador
        if (part.kind === "drawer-front" && config.doors === "none" && config.handle !== "none")
          return (
            <group key={part.id}>
              {mesh}
              <Handle
                kind={config.handle}
                horizontal
                x={(part.position[0] + part.size[0] / 2 - config.width / 2) * MM}
                y={(part.position[1] + part.size[1] * 0.62) * MM}
                z={(part.position[2] + part.size[2] + 12 - config.depth / 2) * MM}
                height={part.size[0]}
              />
            </group>
          );
        return mesh;
      })}
    </group>
  );
}

/**
 * Las corredizas no se pueden abrir todas a la vez: para mostrar el interior
 * se vuelven casi transparentes, y el contorno sigue marcando dónde están.
 */
function SlidingDoor({ part, config, open }: { part: Part; config: WardrobeConfig; open: boolean }) {
  return <PartMesh part={part} config={config} highlighted={false} opacity={open ? 0.12 : 1} />;
}

/**
 * Encuadra el placard entero según el tamaño del visor. Corre al montar y
 * cuando cambian las medidas; girar o hacer zoom después no lo pisa.
 */
function FitCamera({ width, height }: { width: number; height: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const size = useThree((s) => s.size);

  useEffect(() => {
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const aspect = size.width / size.height;
    const fitHeight = (height * MM * 1.25) / (2 * Math.tan(fov / 2));
    const fitWidth = (width * MM * 1.3) / (2 * Math.tan(fov / 2) * aspect);
    const distance = Math.max(fitHeight, fitWidth) + 0.4;
    const target = new THREE.Vector3(0, height * MM * 0.5, 0);
    const direction = new THREE.Vector3(0.38, 0.22, 1).normalize();
    camera.position.copy(target).addScaledVector(direction, distance);
    camera.lookAt(target);
    if (controls) {
      controls.target.copy(target);
      controls.update();
    }
  }, [camera, controls, size.width, size.height, width, height]);

  return null;
}

export default function Viewer3D(props: Props) {
  const { config } = props;

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [1.5, 1.6, 5], fov: 36, near: 0.05, far: 60 }}
    >
      <color attach="background" args={["#ece7df"]} />
      <hemisphereLight args={["#ffffff", "#d9cfc0", 0.9]} />
      <directionalLight
        position={[-2.5, 4, 3.5]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-1}
      />
      <directionalLight position={[3, 2, 2]} intensity={0.45} />

      <FitCamera width={config.width} height={config.height} />
      <Wardrobe {...props} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#e4ddd2" roughness={1} />
      </mesh>
      <ContactShadows position={[0, 0, 0]} opacity={0.35} scale={8} blur={2.4} far={2.5} />

      <OrbitControls
        enablePan={false}
        minDistance={1.2}
        maxDistance={14}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2 - 0.05}
        makeDefault
      />
    </Canvas>
  );
}
