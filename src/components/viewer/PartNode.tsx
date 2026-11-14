"use client";

import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import type { Part } from "@/lib/assembly";

import { BOUNCY, clampDt, doorProgress, FIRM, spring, springFor, SpringVec, step, useSceneAnim } from "./anim";
import type { MaterialKit } from "./materials";
import { dressWith, meterUvs, tintFor } from "./photo";

export const MM = 0.001;

// geometrías unitarias compartidas: cada pieza es una de estas escalada
let shared: {
  box: THREE.BoxGeometry;
  soft: THREE.BufferGeometry;
  puff: THREE.BufferGeometry;
  cyl: THREE.BufferGeometry;
  cone: THREE.BufferGeometry;
  plane: THREE.PlaneGeometry;
  sphere: THREE.SphereGeometry;
  quarterLeft: THREE.CylinderGeometry;
  quarterRight: THREE.CylinderGeometry;
} | null = null;
function geometries() {
  if (!shared) {
    shared = {
      box: new THREE.BoxGeometry(1, 1, 1),
      soft: new RoundedBoxGeometry(1, 1, 1, 5, 0.13),
      // almohadón inflado: casi una píldora
      puff: new RoundedBoxGeometry(1, 1, 1, 8, 0.34),
      cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 40),
      // pata cónica: más fina abajo
      cone: new THREE.CylinderGeometry(0.5, 0.28, 1, 32),
      plane: new THREE.PlaneGeometry(1, 1),
      sphere: new THREE.SphereGeometry(0.5, 28, 18),
      // cuartos de cilindro de radio 1: escalados en x y z quedan elipses
      quarterLeft: new THREE.CylinderGeometry(1, 1, 1, 40, 1, false, -Math.PI / 2, Math.PI / 2),
      quarterRight: new THREE.CylinderGeometry(1, 1, 1, 40, 1, false, 0, Math.PI / 2),
    };
  }
  return shared;
}

/** prisma de base trapecial con origen en su esquina mínima; se rehace al animar */
function makeTrapezoid() {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(36 * 3), 3));
  g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(36 * 2), 2));
  return g;
}

function updateTrapezoid(g: THREE.BufferGeometry, w: number, hl: number, hr: number, d: number) {
  const v = [
    [0, 0, 0], [w, 0, 0], [w, hr, 0], [0, hl, 0],
    [0, 0, d], [w, 0, d], [w, hr, d], [0, hl, d],
  ];
  // caras: atrás, adelante, abajo, arriba (inclinada), izquierda, derecha
  const faces = [
    [1, 0, 3, 2], [4, 5, 6, 7], [0, 1, 5, 4], [7, 6, 2, 3], [0, 4, 7, 3], [5, 1, 2, 6],
  ];
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  let i = 0;
  for (const [a, b, c, e] of faces) {
    for (const k of [a, b, c, a, c, e]) {
      const p = v[k];
      pos.setXYZ(i, p[0] * MM, p[1] * MM, p[2] * MM);
      // en metros, con la veta vertical: la foto no se estira con la medida
      uv.setXY(i, p[0] * MM, p[1] * MM);
      i++;
    }
  }
  pos.needsUpdate = true;
  uv.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingSphere();
}

/**
 * Una pieza curva: la sección (un rectángulo de cantos redondeados) barrida a
 * lo largo del arco, con sus dos tapas. Queda centrada en la caja de la pieza,
 * que es el pivote del nodo.
 */
function arcGeometry(part: Part): THREE.BufferGeometry {
  const a = part.arc!;
  const [x0, , z0] = part.position;
  const [sx, h, sz] = part.size;
  const rc = Math.max(1, Math.min(a.round, h / 2 - 1, (a.rOut - a.rIn) / 2 - 1));
  // la sección, en sentido antihorario (radio hacia la derecha, alto hacia arriba): las normales quedan hacia afuera
  const profile: THREE.Vector2[] = [];
  const corner = (cr: number, cy: number, from: number) => {
    for (let k = 0; k <= 6; k++) {
      const t = from + (k / 6) * (Math.PI / 2);
      profile.push(new THREE.Vector2((cr + rc * Math.cos(t)) * MM, (cy + rc * Math.sin(t) - h / 2) * MM));
    }
  };
  corner(a.rOut - rc, rc, -Math.PI / 2);
  corner(a.rOut - rc, h - rc, 0);
  corner(a.rIn + rc, h - rc, Math.PI / 2);
  corner(a.rIn + rc, rc, Math.PI);
  profile.push(profile[0].clone());
  const body = new THREE.LatheGeometry(profile, Math.max(16, Math.round(a.length * 56)), a.start, a.length);
  // la tela corre a lo largo de la curva: U es el largo del arco y V el contorno de la sección, en metros,
  // así la trama no se corta donde cambia la cara
  let perimeter = 0;
  for (let i = 1; i < profile.length; i++) perimeter += profile[i].distanceTo(profile[i - 1]);
  const along = a.length * ((a.rIn + a.rOut) / 2) * MM;
  const uv = body.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * along, uv.getY(i) * perimeter);
  // las tapas de las puntas: la misma sección, girada al ángulo de cada punta
  const cap = (theta: number, flip: boolean) => {
    const g = new THREE.ShapeGeometry(new THREE.Shape(profile.slice(0, -1)));
    if (flip) {
      const index = g.getIndex()!;
      for (let i = 0; i < index.count; i += 3) {
        const b = index.getX(i + 1);
        index.setX(i + 1, index.getX(i + 2));
        index.setX(i + 2, b);
      }
      const n = g.getAttribute("normal");
      for (let i = 0; i < n.count; i++) n.setZ(i, -n.getZ(i));
    }
    g.rotateY(theta - Math.PI / 2);
    return g;
  };
  const merged = mergeGeometries([body.toNonIndexed(), cap(a.start, false).toNonIndexed(), cap(a.start + a.length, true).toNonIndexed()]);
  body.dispose();
  // del centro del arco al centro de la caja de la pieza
  merged.translate((a.cx - (x0 + sx / 2)) * MM, 0, (a.cz - (z0 + sz / 2)) * MM);
  return merged;
}

const gltf = typeof window === "undefined" ? null : new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const models = new Map<string, Promise<THREE.Object3D>>();

/** un objeto de ambientación (public/models): se baja una vez y cada uso es una copia que comparte geometría y texturas */
function loadModel(id: string): Promise<THREE.Object3D> {
  let p = models.get(id);
  if (!p) {
    p = gltf!.loadAsync(`/models/${id}.glb`).then((g) => {
      g.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      return g.scene;
    });
    p.catch(() => models.delete(id));
    models.set(id, p);
  }
  return p;
}

/**
 * Un objeto escaneado, apoyado en la base de su caja y centrado en ella, a su
 * medida real (si la caja es más chica, se achica entero, sin deformarse).
 */
function DecorModel({ id, size }: { id: string; size: number[] }) {
  const [object, setObject] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    let alive = true;
    loadModel(id)
      .then((scene) => {
        if (!alive) return;
        const copy = scene.clone(true);
        const box = new THREE.Box3().setFromObject(copy);
        const dims = box.getSize(new THREE.Vector3());
        const k = Math.min((size[0] * MM) / dims.x, (size[1] * MM) / dims.y, (size[2] * MM) / dims.z, 1.0001);
        copy.scale.setScalar(k);
        const fitted = new THREE.Box3().setFromObject(copy);
        const center = fitted.getCenter(new THREE.Vector3());
        copy.position.set(-center.x, -fitted.min.y - (size[1] * MM) / 2, -center.z);
        setObject(copy);
      })
      .catch(() => {
        // sin el modelo no se dibuja nada: es ambientación
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, size[0], size[1], size[2]]);
  return object ? <primitive object={object} /> : null;
}

function isVertical(p: Part) {
  return p.cut ? Math.abs(p.cut.length - p.size[1]) < 1 : true;
}

const tints = new Map<string, THREE.MeshStandardMaterial>();
/** color liso para la ambientación ("tint:#rrggbb" o "gloss:#rrggbb"); se comparte entre piezas */
function tinted(spec: string): THREE.MeshStandardMaterial {
  let m = tints.get(spec);
  if (!m) {
    const gloss = spec.startsWith("gloss:");
    // "rug:": alfombra de lana, con su trama de verdad
    if (spec.startsWith("rug:")) {
      m = dressWith(new THREE.MeshStandardMaterial({ color: spec.slice(4), roughness: 1, envMapIntensity: 0.2 }), "tela-lana", { normalScale: 1.4, roughness: 1 });
      tints.set(spec, m);
      return m;
    }
    // "veneer:": muebles de la ambientación, en chapa de nogal teñida al color pedido
    if (spec.startsWith("veneer:")) {
      const color = spec.slice(7);
      m = dressWith(new THREE.MeshStandardMaterial({ color, roughness: 0.6, envMapIntensity: 0.8 }), "nogal", { tint: tintFor("nogal", color), roughness: 0.6, normalScale: 0.6 });
      tints.set(spec, m);
      return m;
    }
    m = new THREE.MeshStandardMaterial({ color: spec.slice(spec.indexOf(":") + 1), roughness: gloss ? 0.12 : 0.92, metalness: gloss ? 0.35 : 0, envMapIntensity: gloss ? 1.1 : 0.4 });
    tints.set(spec, m);
  }
  return m;
}

function pickMaterial(kit: MaterialKit, p: Part): THREE.Material | null {
  if (/^(tint|gloss|rug|veneer):/.test(p.material)) return tinted(p.material);
  const along = isVertical(p) ? "v" : "u";
  switch (p.material) {
    case "none":
      return null;
    case "back":
      return kit.back;
    case "metal":
      return p.kind === "frame" ? kit.frame : kit.metal;
    case "handle":
      return kit.handle;
    case "groove":
      return kit.groove;
    case "mirror":
      return kit.mirror;
    case "glass":
      return kit.glass;
    case "led":
      return kit.led;
    case "glow":
      return kit.glow[p.glow ?? "z"];
    case "fabric":
      return kit.fabric;
    case "iron":
      return kit.iron;
    default:
      if (p.front || (p.material === kit.doorId && p.kind !== "drawer-front")) return kit.door[along];
      return p.kind === "drawer-front" ? kit.bodyFront[along] : kit.body[along];
  }
}

type NodeProps = {
  part: Part;
  exiting: boolean;
  kit: MaterialKit;
  /** segundos de espera antes de aparecer (la entrada escalonada) */
  delay: number;
  onSelect?: (run: number, module: number) => void;
  /** tocar una hoja corrediza la corre para el otro lado */
  onLeaf?: (id: string) => void;
};

/**
 * Una pieza animada. Medidas, posición y giro siguen a sus valores con
 * resortes; al aparecer crece con un rebote y al irse se encoge.
 */
export function PartNode({ part, exiting, kit, delay, onSelect, onLeaf }: NodeProps) {
  const anim = useSceneAnim();
  const outer = useRef<THREE.Group>(null);
  const rot = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const details = useRef<THREE.Group>(null);
  // crece al aparecer, salvo en una escena que arranca ya armada
  const appear = useRef(spring(typeof performance !== "undefined" && performance.now() < anim.settledUntil ? 1 : 0));
  const born = useRef<number | null>(null);
  const door = part.kind === "door" && part.hinge ? part.hinge : null;
  const trap = part.geometry === "trapezoid";
  const material = pickMaterial(kit, part);

  const target = [...part.position, ...part.size, part.rotationZ ?? 0, part.trapezoid?.left ?? 0, part.trapezoid?.right ?? 0];
  const sv = useRef<SpringVec | null>(null);
  if (!sv.current) sv.current = new SpringVec(target);
  sv.current.set(target);

  const trapGeo = useMemo(() => (trap ? makeTrapezoid() : null), [trap]);
  useEffect(() => () => trapGeo?.dispose(), [trapGeo]);

  // un almohadón se modela a su tamaño real: así el redondeo es parejo en todos los cantos.
  // Las placas también: un canto vivo perfecto no existe, y el redondeo de 2 mm
  // es lo que agarra el brillo a lo largo del borde, como en un mueble de verdad
  const edged = part.geometry === "box" && part.kind !== "led" && part.kind !== "glow" && Math.min(...part.size) >= 2;
  const cushion = useMemo(() => {
    if (part.geometry === "arc" && part.arc) return arcGeometry(part);
    if (part.geometry !== "cushion" && !edged) return null;
    const [sx, sy, sz] = part.size.map((v) => Math.max(v, 1) * MM);
    const radius = part.geometry === "cushion" ? Math.min(part.radius ?? 60, Math.min(...part.size) / 2 - 0.5) : Math.min(2.2, Math.min(...part.size) * 0.22);
    const g = new RoundedBoxGeometry(sx, sy, sz, part.geometry === "cushion" ? 7 : 2, radius * MM);
    // los frentes (puertas, cajones) comparten la veta con sus vecinos
    const front = part.front || part.kind === "door" || part.kind === "drawer-front";
    meterUvs(g, [sx, sy, sz], part.id, front ? part.position.map((v, i) => (v + part.size[i] / 2) * MM) : undefined);
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part.geometry, edged, part.size[0], part.size[1], part.size[2], part.radius, part.arc && JSON.stringify(part.arc), (part.front || part.kind === "door" || part.kind === "drawer-front") && part.position.join(",")]);
  useEffect(() => () => cushion?.dispose(), [cushion]);

  const geometry = useMemo(() => {
    const g = geometries();
    if (part.geometry === "quarter") return part.quarter === "left" ? g.quarterLeft : g.quarterRight;
    if (part.geometry === "knob") return g.sphere;
    if (part.geometry === "glow") return g.plane;
    if (part.geometry === "soft") return g.soft;
    if (part.geometry === "puff") return g.puff;
    if (part.geometry === "cyl") return g.cyl;
    if (part.geometry === "cone") return g.cone;
    return g.box;
  }, [part.geometry, part.quarter]);

  const glowRotation = useMemo<[number, number, number]>(() => {
    if (part.glow === "y") return [-Math.PI / 2, 0, 0];
    if (part.glow === "x+") return [0, Math.PI / 2, 0];
    if (part.glow === "x-") return [0, -Math.PI / 2, 0];
    return [0, 0, 0];
  }, [part.glow]);

  useFrame((state, dt) => {
    const d = clampDt(dt);
    const now = state.clock.elapsedTime;
    if (born.current === null) born.current = now;
    const s = sv.current!;
    s.step(d, FIRM);
    appear.current.target = exiting ? 0 : now - born.current >= delay ? 1 : 0;
    step(appear.current, d, BOUNCY);

    const [px, py, pz, sx, sy, sz, rz, tl, tr] = s.v;
    const e = anim.explode.v;
    const ex = part.explode;
    // los cajones siguen al resorte de su módulo; las hojas corredizas, al suyo
    const drawer = part.openShift && part.module !== null ? springFor(anim.drawers, `${part.run}:${part.module}`).v : 0;
    const os = part.openShift;
    const slideX = part.slide ? springFor(anim.leaves, part.id).v : 0;
    const a = Math.max(appear.current.v, 1e-4);

    // pivote: en las puertas, el canto de adelante del lado de la bisagra (así no
    // se mete en el lateral al girar); en lo demás, el centro
    const pivot = door ? [door === "right" ? px + sx : px, py, pz + sz] : [px + sx / 2, py + sy / 2, pz + sz / 2];
    if (outer.current) {
      outer.current.position.set(
        (pivot[0] + ex[0] * e + (os ? os[0] * drawer : 0) + slideX) * MM,
        (pivot[1] + ex[1] * e + (os ? os[1] * drawer : 0)) * MM,
        (pivot[2] + ex[2] * e + (os ? os[2] * drawer : 0)) * MM,
      );
    }
    if (rot.current) {
      if (door) {
        const angle = (part.openAngle ?? Math.PI / 2) * doorProgress(anim.open.v, part.openDelay);
        if (door === "bottom") rot.current.rotation.set(angle, 0, 0);
        else rot.current.rotation.set(0, (door === "left" ? -1 : 1) * angle, 0);
      } else rot.current.rotation.set(0, part.rotationY ?? 0, rz);
    }

    const m = mesh.current;
    if (m) {
      if (trap && trapGeo) {
        updateTrapezoid(trapGeo, sx, tl, tr, sz);
        // el trapecio tiene su origen en la esquina mínima
        const ox = door ? (door === "right" ? -sx : 0) : -sx / 2;
        const oy = door ? 0 : -sy / 2;
        const oz = door ? -sz : -sz / 2;
        m.position.set(ox * MM * a, oy * MM * a, oz * MM * a);
        m.scale.setScalar(a);
      } else if (part.geometry === "quarter") {
        // el cuarto de elipse tiene su origen en el centro de la elipse
        m.position.set((part.quarter === "left" ? sx / 2 : -sx / 2) * MM, 0, (-sz / 2) * MM);
        m.scale.set(sx * MM * a, sy * MM * a, sz * MM * a);
      } else if (part.geometry === "glow") {
        if (part.glow === "y") m.scale.set(sx * MM * a, sz * MM * a, 1);
        else if (part.glow === "x+" || part.glow === "x-") m.scale.set(sz * MM * a, sy * MM * a, 1);
        else m.scale.set(sx * MM * a, sy * MM * a, 1);
      } else {
        if (door) m.position.set(((door === "right" ? -sx : sx) / 2) * MM, (sy / 2) * MM, (-sz / 2) * MM);
        // el almohadón ya tiene su medida: solo acompaña la animación
        if (cushion) m.scale.set((sx / Math.max(part.size[0], 1)) * a, (sy / Math.max(part.size[1], 1)) * a, (sz / Math.max(part.size[2], 1)) * a);
        else m.scale.set(Math.max(sx, 0.01) * MM * a, Math.max(sy, 0.01) * MM * a, Math.max(sz, 0.01) * MM * a);
      }
    }
    if (details.current) {
      const ox = door ? (door === "right" ? -sx : 0) : -sx / 2;
      details.current.position.set(ox * MM, (door ? 0 : -sy / 2) * MM, (door ? -sz : -sz / 2) * MM);
    }
  });

  const selectable = onSelect && part.module !== null && part.kind !== "glow" && part.kind !== "led";
  const handleClick = selectable
    ? (e: ThreeEvent<MouseEvent>) => {
        // un arrastre para girar no cuenta como clic
        if (e.delta > 6) return;
        e.stopPropagation();
        onSelect(part.run, part.module!);
      }
    : undefined;

  // las terminaciones de menos de un milímetro de relieve no proyectan sombra:
  // el mapa de sombras no las resuelve y salpica la puerta de rayas
  const castShadow = !["glow", "glass", "groove", "mirror", "led"].includes(part.kind);

  const leafClick =
    part.slide && onLeaf
      ? (e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 6) return;
          e.stopPropagation();
          onLeaf(part.id);
        }
      : undefined;

  return (
    <group ref={outer} onClick={leafClick}>
      <group ref={rot}>
        {material && (
          <mesh
            ref={mesh}
            geometry={trap && trapGeo ? trapGeo : (cushion ?? geometry)}
            material={material}
            rotation={part.geometry === "glow" ? glowRotation : undefined}
            castShadow={castShadow}
            receiveShadow={part.kind !== "glow"}
            onClick={handleClick}
            renderOrder={part.kind === "glow" ? 2 : part.front ? 1 : 0}
          />
        )}
        {part.kind === "led" && <LedLight part={part} kit={kit} />}
        {part.geometry === "model" && part.model && <DecorModel id={part.model} size={part.size} />}
        {part.details && part.details.length > 0 && (
          <group ref={details}>
            <Presence parts={part.details}>
              {(d, gone) => <PartNode key={d.id} part={d} exiting={exiting || gone} kit={kit} delay={delay + 0.15} />}
            </Presence>
          </group>
        )}
      </group>
    </group>
  );
}

/** brillo de una tira LED encendida en el modo foto (luminancia, como en una lámpara real) */
const LED_NITS = 34;

/**
 * La luz de una tira LED en el modo foto: un rectángulo que emite del lado
 * hacia donde apunta la tira. Las tiras horizontales iluminan hacia abajo; los
 * perfiles verticales de un placard, hacia el centro del módulo. El 3D rápido
 * no la dibuja (ahí la luz es la mancha pintada).
 */
function LedLight({ part, kit }: { part: Part; kit: MaterialKit }) {
  const anim = useSceneAnim();
  const ref = useRef<THREE.RectAreaLight>(null);
  const [sx, sy, sz] = part.size;
  const vertical = sy > sx && sy > sz;
  const toRight = /L$/.test(part.id);
  useEffect(() => {
    const l = ref.current;
    if (!l) return;
    if (vertical) {
      l.position.set(((toRight ? 1 : -1) * (sx / 2 + 1)) * MM, 0, 0);
      l.rotation.set(0, toRight ? -Math.PI / 2 : Math.PI / 2, 0);
      l.width = sz * MM;
      l.height = sy * MM;
    } else {
      l.position.set(0, -(sy / 2 + 1) * MM, 0);
      l.rotation.set(-Math.PI / 2, 0, 0);
      l.width = sx * MM;
      l.height = sz * MM;
    }
  }, [vertical, toRight, sx, sy, sz]);
  useFrame(() => {
    const l = ref.current;
    if (!l) return;
    l.color.copy(kit.led.emissive);
    l.intensity = LED_NITS * anim.lights.v;
  });
  return <rectAreaLight ref={ref} visible={false} userData={{ photoOnly: true }} />;
}

/**
 * Mantiene en escena las piezas que se fueron hasta que terminan de
 * encogerse, así no desaparecen de golpe.
 */
export function Presence({ parts, children }: { parts: Part[]; children: (p: Part, exiting: boolean) => ReactNode }) {
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const registry = useRef(new Map<string, { part: Part; exitAt: number | null }>());
  const now = typeof performance === "undefined" ? 0 : performance.now();
  const live = new Set(parts.map((p) => p.id));
  for (const p of parts) registry.current.set(p.id, { part: p, exitAt: null });
  for (const [id, entry] of registry.current) {
    if (live.has(id)) continue;
    if (entry.exitAt === null) entry.exitAt = now + 600;
    else if (entry.exitAt < now) registry.current.delete(id);
  }
  const pending = [...registry.current.values()].some((e) => e.exitAt !== null);
  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(rerender, 650);
    return () => clearTimeout(id);
  });
  return <>{[...registry.current.values()].map((e) => children(e.part, e.exitAt !== null))}</>;
}
