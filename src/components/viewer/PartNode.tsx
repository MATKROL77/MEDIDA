"use client";

import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
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
  shade: THREE.BufferGeometry;
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
      // pantalla de lámpara: abierta arriba y abajo, apenas más ancha abajo
      shade: new THREE.CylinderGeometry(0.42, 0.5, 1, 48, 1, true),
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
/**
 * Una esquina curva de madera doblada: un cuarto de caño extruido a lo largo
 * de la profundidad. La veta da la vuelta a la curva (V es el largo del arco),
 * como en una chapa enchapada curvada, y sigue en la tapa y el lateral.
 */
function bendGeometry(part: Part): THREE.BufferGeometry {
  const { corner, t } = part.bend!;
  const R = part.size[0] * MM;
  const D = part.size[2] * MM;
  const r = Math.max(0.001, R - t * MM);
  const [a0, cx, cy] = ({ tl: [Math.PI / 2, R / 2, -R / 2], tr: [0, -R / 2, -R / 2], bl: [Math.PI, R / 2, R / 2], br: [1.5 * Math.PI, -R / 2, R / 2] } as const)[corner];
  const seg = 24;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  type V = { p: number[]; n: number[]; uv: number[] };
  // un triángulo, dado vuelta si hace falta para que mire hacia su normal
  const tri = (a: V, b: V, c: V) => {
    const e1 = b.p.map((v, i) => v - a.p[i]);
    const e2 = c.p.map((v, i) => v - a.p[i]);
    const cross = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const n = [0, 1, 2].map((i) => a.n[i] + b.n[i] + c.n[i]);
    const list = cross[0] * n[0] + cross[1] * n[1] + cross[2] * n[2] < 0 ? [a, c, b] : [a, b, c];
    for (const v of list) {
      pos.push(...v.p);
      nor.push(...v.n);
      uv.push(...v.uv);
    }
  };
  const quad = (a: V, b: V, c: V, d: V) => {
    tri(a, b, c);
    tri(a, c, d);
  };
  const at = (k: number) => a0 + (Math.PI / 2) * (k / seg);
  for (let k = 0; k < seg; k++) {
    const [p, q] = [at(k), at(k + 1)];
    for (const [rad, sign] of [
      [R, 1],
      [r, -1],
    ] as const) {
      // las caras curvas, afuera y adentro: la normal es el radio
      const v = (a: number, z: number): V => ({ p: [cx + rad * Math.cos(a), cy + rad * Math.sin(a), z], n: [sign * Math.cos(a), sign * Math.sin(a), 0], uv: [z, rad * (a - a0)] });
      quad(v(p, -D / 2), v(q, -D / 2), v(q, D / 2), v(p, D / 2));
    }
    // los cantos de adelante y de atrás: el cuarto de anillo
    for (const z of [D / 2, -D / 2]) {
      const v = (rad: number, a: number): V => ({ p: [cx + rad * Math.cos(a), cy + rad * Math.sin(a), z], n: [0, 0, Math.sign(z)], uv: [cx + rad * Math.cos(a), cy + rad * Math.sin(a)] });
      quad(v(R, p), v(R, q), v(r, q), v(r, p));
    }
  }
  // las puntas, donde pega con la tapa y el lateral
  for (const k of [0, seg]) {
    const a = at(k);
    const n = k === 0 ? [Math.sin(a), -Math.cos(a), 0] : [-Math.sin(a), Math.cos(a), 0];
    const v = (rad: number, z: number): V => ({ p: [cx + rad * Math.cos(a), cy + rad * Math.sin(a), z], n, uv: [z, rad] });
    quad(v(R, -D / 2), v(r, -D / 2), v(r, D / 2), v(R, D / 2));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/** una placa vista de frente con las esquinas redondeadas y el canto apenas suavizado */
function cornersGeometry(part: Part): THREE.BufferGeometry {
  const [w, h, t] = part.size.map((v) => v * MM);
  const [tl, tr, br, bl] = part.corners!.map((v) => Math.min(v * MM, w / 2 - 1e-4, h / 2 - 1e-4));
  const edge = Math.min(0.0015, t / 4);
  // el contorno queda adentro del canto suavizado: el bisel lo lleva a la medida
  const [x0, x1, y0, y1] = [-w / 2 + edge, w / 2 - edge, -h / 2 + edge, h / 2 - edge];
  const r = (v: number) => Math.max(v - edge, 0.0005);
  const shape = new THREE.Shape();
  shape.moveTo(x0 + r(bl), y0);
  shape.lineTo(x1 - r(br), y0);
  shape.absarc(x1 - r(br), y0 + r(br), r(br), -Math.PI / 2, 0, false);
  shape.lineTo(x1, y1 - r(tr));
  shape.absarc(x1 - r(tr), y1 - r(tr), r(tr), 0, Math.PI / 2, false);
  shape.lineTo(x0 + r(tl), y1);
  shape.absarc(x0 + r(tl), y1 - r(tl), r(tl), Math.PI / 2, Math.PI, false);
  shape.lineTo(x0, y0 + r(bl));
  shape.absarc(x0 + r(bl), y0 + r(bl), r(bl), Math.PI, 1.5 * Math.PI, false);
  const g = new THREE.ExtrudeGeometry(shape, { depth: t - 2 * edge, bevelEnabled: true, bevelThickness: edge, bevelSize: edge, bevelSegments: 2, curveSegments: 16 });
  g.translate(0, 0, -(t - 2 * edge) / 2);
  return g.index ? g.toNonIndexed() : g;
}

function arcGeometry(part: Part): THREE.BufferGeometry {
  const a = part.arc!;
  const [x0, , z0] = part.position;
  const [sx, h, sz] = part.size;
  const rc = Math.max(1, Math.min(a.round, h / 2 - 1, (a.rOut - a.rIn) / 2 - 1));
  // el relleno: la cara de arriba y los costados se inflan en el medio (como en puffGeometry)
  const puff = part.puff ?? 0;
  const swell = (span: number) => puff * Math.min(1, span / 450);
  // la sección, en mm (radio, alto), en sentido antihorario: las normales quedan hacia afuera
  const pts: [number, number][] = [];
  const corner = (cr: number, cy: number, from: number) => {
    for (let k = 0; k <= 6; k++) {
      const t = from + (k / 6) * (Math.PI / 2);
      pts.push([cr + rc * Math.cos(t), cy + rc * Math.sin(t)]);
    }
  };
  // entre dos puntas, puntos cada 25 mm; `out` (radio, alto) es hacia dónde se infla
  const flat = (to: [number, number], bulge: number, out: [number, number]) => {
    const from = pts[pts.length - 1];
    const n = Math.floor(Math.hypot(to[0] - from[0], to[1] - from[1]) / 25);
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const b = bulge * Math.sin(Math.PI * t);
      pts.push([from[0] + (to[0] - from[0]) * t + out[0] * b, from[1] + (to[1] - from[1]) * t + out[1] * b]);
    }
  };
  const width = a.rOut - a.rIn - 2 * rc;
  const tall = h - 2 * rc;
  corner(a.rOut - rc, rc, -Math.PI / 2);
  flat([a.rOut, h - rc], swell(Math.min(tall, sx)) * 0.5, [1, 0]);
  corner(a.rOut - rc, h - rc, 0);
  flat([a.rIn + rc, h], swell(width), [0, 1]);
  corner(a.rIn + rc, h - rc, Math.PI / 2);
  flat([a.rIn, rc], swell(Math.min(tall, sx)) * 0.5, [-1, 0]);
  corner(a.rIn + rc, rc, Math.PI);
  flat([a.rOut - rc, 0], 0, [0, -1]);
  pts.push([...pts[0]]);
  const m = pts.length;
  // las puntas se redondean como un almohadón: en el último tramo (el mismo
  // radio que los cantos de la sección) la sección se achica en un cuarto de círculo
  const rMean = (a.rIn + a.rOut) / 2;
  const total = a.length * rMean;
  const endR = Math.min(rc, total / 4);
  const ds: number[] = [];
  for (let k = 0; k < 8; k++) ds.push(endR * (1 - Math.cos((k / 8) * (Math.PI / 2))));
  const mid = Math.max(1, Math.round((total - 2 * endR) / 40));
  for (let k = 0; k <= mid; k++) ds.push(endR + ((total - 2 * endR) * k) / mid);
  for (let k = 7; k >= 0; k--) ds.push(total - endR * (1 - Math.cos((k / 8) * (Math.PI / 2))));
  const cr = rMean;
  const cy = h / 2;
  const halfW = (a.rOut - a.rIn) / 2;
  const shrink = (d: number) => {
    const e = Math.min(d, total - d);
    if (e >= endR) return 0;
    const t = 1 - e / endR;
    return endR * (1 - Math.sqrt(Math.max(0, 1 - t * t)));
  };
  const section = (o: number) => {
    const fr = Math.max(0.05, 1 - o / halfW);
    const fy = Math.max(0.05, 1 - o / cy);
    return pts.map(([r, y]) => [cr + (r - cr) * fr, cy + (y - cy) * fy] as [number, number]);
  };
  // la tela corre a lo largo de la curva: U es el largo del arco y V el contorno
  // de la sección, en metros medidos de verdad (los puntos no están parejos),
  // así la trama no se corta ni se estira donde cambia la cara
  const cum = [0];
  for (let j = 1; j < m; j++) cum.push(cum[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]) * MM);
  const positions: number[] = [];
  const uvs: number[] = [];
  for (const d of ds) {
    const theta = a.start + (d / total) * a.length;
    for (const [j, [r, y]] of section(shrink(d)).entries()) {
      positions.push(r * Math.sin(theta) * MM, (y - h / 2) * MM, r * Math.cos(theta) * MM);
      uvs.push(d * MM, cum[j]);
    }
  }
  const index: number[] = [];
  for (let i = 0; i < ds.length - 1; i++)
    for (let j = 0; j < m - 1; j++) {
      const p0 = i * m + j;
      const p1 = (i + 1) * m + j;
      const p2 = (i + 1) * m + j + 1;
      const p3 = i * m + j + 1;
      index.push(p0, p1, p3, p2, p3, p1);
    }
  const body = new THREE.BufferGeometry();
  body.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  body.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  body.setIndex(index);
  body.computeVertexNormals();
  // las arrugas de la funda, que se apagan al llegar a las puntas (las tapas son lisas)
  if (part.wrinkle) {
    const before = Float32Array.from(body.getAttribute("position").array as Float32Array);
    let seed = 0;
    for (const ch of part.id) seed = (seed * 31 + ch.charCodeAt(0)) % 997;
    wrinkleGeometry(body, part.wrinkle, seed / 997);
    const pos = body.getAttribute("position") as THREE.BufferAttribute;
    ds.forEach((d, i) => {
      const w = Math.min(1, Math.min(d, total - d) / Math.max(endR, 1));
      for (let j = 0; j < m; j++) {
        const k = (i * m + j) * 3;
        for (let c = 0; c < 3; c++) pos.array[k + c] = before[k + c] + (pos.array[k + c] - before[k + c]) * w;
      }
    });
    pos.needsUpdate = true;
    body.computeVertexNormals();
  }
  const capProfile = section(endR)
    .slice(0, -1)
    .map(([r, y]) => new THREE.Vector2(r * MM, (y - h / 2) * MM));
  // las tapas de las puntas: la sección achicada, girada al ángulo de cada punta
  const cap = (theta: number, flip: boolean) => {
    const g = new THREE.ShapeGeometry(new THREE.Shape(capProfile));
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
          // la geometría viene comprimida en enteros (meshopt): el modo foto solo lee números comunes
          for (const [name, attr] of Object.entries(m.geometry.attributes)) {
            const a = attr as THREE.BufferAttribute;
            if (a.array instanceof Float32Array && !a.normalized) continue;
            const out = new Float32Array(a.count * a.itemSize);
            for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
            m.geometry.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
          }
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

/**
 * Capitoné: hunde la cara pedida en una grilla de puntos (donde van los
 * botones), con la tela que se frunce hacia cada uno. La geometría tiene que
 * venir subdividida.
 */
function tuftGeometry(g: THREE.BufferGeometry, size: number[], tuft: NonNullable<Part["tuft"]>) {
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const nor = g.getAttribute("normal") as THREE.BufferAttribute;
  const top = tuft.face === "top";
  // los ejes de la cara: en la de arriba, x y z; en la de adelante, x e y
  const ua = size[0];
  const va = top ? size[2] : size[1];
  const cu = ua / tuft.nx;
  const cv = va / tuft.ny;
  const depth = tuft.depth * MM;
  const pinch = Math.min(cu, cv) * 0.075;
  // 0 sobre la línea de botones, 1 a media celda: la tela se infla entre líneas
  // y hace un pliegue marcado en cada una (también afuera, hasta el canto)
  const swell = (w: number, c: number, n: number) => {
    const i = Math.min(n - 1, Math.max(0, Math.round(w / c - 0.5)));
    const t = Math.min(1, Math.abs(w - (i + 0.5) * c) / (c / 2));
    // celdas tirantes: planas arriba y con el pliegue bien marcado
    return { t: Math.pow(Math.sin((Math.PI / 2) * t), 0.4), at: (i + 0.5) * c };
  };
  for (let i = 0; i < pos.count; i++) {
    const n = top ? nor.getY(i) : nor.getZ(i);
    if (n < 0.25) continue;
    const u = pos.getX(i) + ua / 2;
    const v = (top ? pos.getZ(i) : pos.getY(i)) + va / 2;
    const su = swell(u, cu, tuft.nx);
    const sv = swell(v, cv, tuft.ny);
    // la celda inflada: alta en el medio, baja en los pliegues
    const dome = su.t * sv.t;
    // el botón tira la tela hacia adentro, más hondo que el pliegue
    const button = Math.exp(-((u - su.at) ** 2 + (v - sv.at) ** 2) / (2 * pinch * pinch));
    const k = 0.42 * (1 - dome) + 0.58 * button;
    // más suave sobre los cantos redondeados
    const d = depth * k * Math.min(1, (n - 0.25) / 0.45);
    if (top) pos.setY(i, pos.getY(i) - d);
    else pos.setZ(i, pos.getZ(i) - d);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
}

/**
 * El relleno de un almohadón: cada cara se infla hacia afuera, más en el medio
 * y nada en los cantos, como la funda tirante sobre la goma. Cuánto, según el
 * tamaño de la cara: la de arriba de un asiento mucho, el costado poco.
 */
function puffGeometry(g: THREE.BufferGeometry, size: number[], puff: number) {
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const nor = g.getAttribute("normal") as THREE.BufferAttribute;
  const half = size.map((v) => v / 2);
  const amount = [0, 1, 2].map((k) => {
    const [u, v] = [0, 1, 2].filter((x) => x !== k);
    return puff * MM * Math.min(1, Math.min(size[u], size[v]) / 0.45);
  });
  for (let i = 0; i < pos.count; i++) {
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const n = [nor.getX(i), nor.getY(i), nor.getZ(i)];
    const t = p.map((v, k) => Math.min(1, Math.abs(v) / half[k]));
    let d = 0;
    for (let k = 0; k < 3; k++) {
      const [u, v] = [0, 1, 2].filter((x) => x !== k);
      d += n[k] * n[k] * amount[k] * (1 - t[u] * t[u]) * (1 - t[v] * t[v]);
    }
    pos.setXYZ(i, p[0] + n[0] * d, p[1] + n[1] * d, p[2] + n[2] * d);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
}

/**
 * Un almohadón de adorno: grueso en el medio y fino en el borde, con las cuatro
 * puntas pellizcadas. El espesor (el eje más fino) se escala con una cúpula.
 */
function pinchGeometry(g: THREE.BufferGeometry, size: number[], pinch: number) {
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const k = size.indexOf(Math.min(...size));
  const [u, v] = [0, 1, 2].filter((x) => x !== k);
  for (let i = 0; i < pos.count; i++) {
    const tu = Math.min(1, Math.abs(pos.getComponent(i, u)) / (size[u] / 2));
    const tv = Math.min(1, Math.abs(pos.getComponent(i, v)) / (size[v] / 2));
    const dome = Math.sqrt(Math.max(0, (1 - tu * tu) * (1 - tv * tv)));
    pos.setComponent(i, k, pos.getComponent(i, k) * (pinch + (1 - pinch) * dome));
    // el relleno tira de la tela: el medio de cada borde se mete y las puntas quedan afuera
    pos.setComponent(i, u, pos.getComponent(i, u) * (1 - 0.08 * (1 - tv * tv) * tu * tu));
    pos.setComponent(i, v, pos.getComponent(i, v) * (1 - 0.08 * (1 - tu * tu) * tv * tv));
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
}

/**
 * Tela arrugada: la superficie se ondula con unos pliegues suaves, largos en
 * una dirección y cortos en la otra, como un acolchado o una funda; arriba más
 * que en los costados. Determinístico: el mismo mueble se ve siempre igual.
 */
function wrinkleGeometry(g: THREE.BufferGeometry, amplitude: number, seed: number) {
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const nor = g.getAttribute("normal") as THREE.BufferAttribute;
  const a = amplitude * MM;
  const ph = seed * 6.283;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const f =
      0.5 * Math.sin(x * 9.3 + z * 2.7 + ph) +
      0.3 * Math.sin(x * -3.9 + z * 12.1 + 1.3 + ph * 0.7) +
      0.2 * Math.sin((x + z) * 21 + y * 7 + 0.4 + ph * 1.3) +
      0.12 * Math.sin(x * 37 - z * 29 + ph * 2.1);
    // las arrugas se marcan arriba; en lo que cuelga y en el dobladillo, poco
    const up = Math.max(0.2, nor.getY(i));
    const k = a * f * up;
    pos.setXYZ(i, x + nor.getX(i) * k, y + nor.getY(i) * k, z + nor.getZ(i) * k);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
}

/**
 * La caída de una tela: lo que sobra del ancho y del largo de lo que cubre
 * dobla sobre el canto (un radio chico) y cuelga, como un acolchado sobre el
 * colchón. A los costados y adelante; atrás queda contra las almohadas.
 */
function drapeGeometry(g: THREE.BufferGeometry, size: number[], drape: NonNullable<Part["drape"]>) {
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const hw = (drape.w * MM) / 2;
  const front = -size[2] / 2 + drape.d * MM;
  const r = 0.045;
  const arc = (r * Math.PI) / 2;
  const drop = drape.drop * MM;
  // un punto que estaba `e` más allá del canto, a `h` del medio del espesor:
  // dobla alrededor del canto (el espesor se conserva: afuera queda más lejos)
  // y después cuelga derecho. Devuelve cuánto sale, cuánto baja y el seno y el
  // coseno del giro, para correr el espesor.
  const bend = (e: number) => {
    if (e <= 0) return { out: e, down: 0, s: 0, c: 1 };
    if (e <= arc) {
      const t = e / r;
      return { out: r * Math.sin(t), down: r * (1 - Math.cos(t)), s: Math.sin(t), c: Math.cos(t) };
    }
    return { out: r, down: Math.min(drop, r + (e - arc)), s: 1, c: 0 };
  };
  // los pliegues verticales de lo que cuelga: dos ondas que no se repiten igual
  const folds = (u: number) => 0.6 * Math.sin(u * 27 + 0.7) + 0.4 * Math.sin(u * 61 + 2.1);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = pos.getY(i);
    const bx = bend(Math.abs(x) - hw);
    const bz = bend(z - front);
    const down = Math.min(drop, bx.down + bz.down);
    // cuánto cuelga ya (0 arriba, 1 al fondo): ahí los pliegues se marcan
    const hx = Math.min(1, bx.down / 0.12);
    const hz = Math.min(1, bz.down / 0.12);
    const wave = 0.011;
    const nx = Math.abs(x) > hw ? Math.sign(x) * (hw + bx.out + h * bx.s + wave * hx * folds(z)) : x;
    const nz = z > front ? front + bz.out + h * bz.s + wave * hz * folds(x + 3.1) : z;
    pos.setXYZ(i, nx, -down + h * bx.c * bz.c, nz);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
}

/**
 * Una caja redondeada hecha de una malla pareja, para poder deformarla (el
 * capitoné, las arrugas, la caída de una tela). Cada cara es una grilla de
 * lado `cell` como mucho, más puntos de sobra cerca de los cantos para que el
 * redondeo salga liso; las caras comparten exactamente los vértices de sus
 * bordes, así que al soldarlas no quedan rajaduras.
 */
function gridRoundedBox(size: number[], radius: number, cell: number): THREE.BufferGeometry {
  const r = Math.min(radius, ...size.map((v) => v / 2 - 1e-5));
  const stops = (len: number) => {
    const h = len / 2;
    const inner = h - r;
    const out: number[] = [];
    // cerca de cada punta, puntos que caen parejos en el cuarto de círculo
    for (let k = 0; k < 4; k++) out.push(-h + r * (1 - Math.tan((Math.PI / 4) * (1 - k / 4))));
    const n = Math.max(1, Math.ceil((2 * inner) / cell));
    for (let k = 0; k <= n; k++) out.push(-inner + (2 * inner * k) / n);
    for (let k = 3; k >= 0; k--) out.push(h - r * (1 - Math.tan((Math.PI / 4) * (1 - k / 4))));
    const sorted = out.sort((a, b) => a - b);
    return sorted.filter((v, i) => i === 0 || v - sorted[i - 1] > 1e-6);
  };
  const axes = size.map(stops);
  const half = size.map((v) => v / 2);
  const positions: number[] = [];
  const index: number[] = [];
  // las seis caras: el eje que mira afuera, su signo y los dos ejes de la grilla
  for (const [w, sign] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]] as const) {
    const u = (w + 1) % 3;
    const v = (w + 2) % 3;
    const base = positions.length / 3;
    for (const b of axes[v])
      for (const a of axes[u]) {
        const p = [0, 0, 0];
        p[w] = sign * half[w];
        p[u] = a;
        p[v] = b;
        positions.push(...p);
      }
    const nu = axes[u].length;
    for (let j = 0; j < axes[v].length - 1; j++)
      for (let i = 0; i < nu - 1; i++) {
        const a = base + j * nu + i;
        const b = a + 1;
        const c = a + nu;
        const d = c + 1;
        // u × v apunta a +w: con el signo negativo se da vuelta el orden
        if (sign > 0) index.push(a, b, d, a, d, c);
        else index.push(a, d, b, a, c, d);
      }
  }
  // el redondeo: cada punto se lleva a la superficie de la caja interior inflada en r
  for (let i = 0; i < positions.length; i += 3) {
    const c = [0, 1, 2].map((k) => Math.max(-(half[k] - r), Math.min(half[k] - r, positions[i + k])));
    const d = [0, 1, 2].map((k) => positions[i + k] - c[k]);
    const len = Math.hypot(d[0], d[1], d[2]);
    if (len > 1e-9) for (let k = 0; k < 3; k++) positions[i + k] = c[k] + (d[k] / len) * r;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  const welded = mergeVertices(g, 1e-6);
  g.dispose();
  welded.computeVertexNormals();
  return welded;
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
    // "linen:": ropa de cama y fundas, con la trama del lino y el brillo rasante de la tela
    if (spec.startsWith("linen:")) {
      const color = spec.slice(6);
      m = dressWith(
        new THREE.MeshPhysicalMaterial({ color, roughness: 0.95, envMapIntensity: 0.35, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.3) }),
        "tela-lino",
        { normalScale: 1.2, roughness: 1, tint: new THREE.Color(color).multiplyScalar(1 / Math.pow(205 / 255, 2.2)) },
      );
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
  if (/^(tint|gloss|rug|veneer|linen):/.test(p.material)) return tinted(p.material);
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
  /** caras metidas en una ranura (máscara de hiddenFaces): van en sombra */
  hidden?: number;
};

/**
 * La variante en sombra de un material, para las caras metidas en una ranura:
 * más oscura y casi sin reflejo (adentro de una ranura de 3 mm no llega el cielo).
 */
const shadedCache = new WeakMap<THREE.Material, THREE.Material>();
function shadedOf(material: THREE.Material): THREE.Material {
  let out = shadedCache.get(material);
  if (!out) {
    out = material.clone();
    // clone() no copia los retoques del sombreador (la veta en metros, el detalle de la tela)
    out.onBeforeCompile = material.onBeforeCompile;
    out.customProgramCacheKey = material.customProgramCacheKey;
    const m = out as THREE.MeshStandardMaterial;
    if (m.color) m.color.multiplyScalar(0.3);
    if (typeof m.envMapIntensity === "number") m.envMapIntensity *= 0.15;
    shadedCache.set(material, out);
  }
  return out;
}

const twoSidedCache = new WeakMap<THREE.Material, THREE.Material>();
function twoSided(material: THREE.Material): THREE.Material {
  let out = twoSidedCache.get(material);
  if (!out) {
    out = material.clone();
    out.onBeforeCompile = material.onBeforeCompile;
    out.customProgramCacheKey = material.customProgramCacheKey;
    out.side = THREE.DoubleSide;
    twoSidedCache.set(material, out);
  }
  return out;
}

/**
 * Separa los triángulos (sin índice) en dos geometrías: las caras a la vista y
 * las metidas en una ranura. Van en dos mallas con un material cada una: el
 * trazador de rayos no respeta los grupos de materiales dentro de una malla.
 */
function splitHidden(g: THREE.BufferGeometry, hidden: number): { visible: THREE.BufferGeometry; shaded: THREE.BufferGeometry } | null {
  const nor = g.getAttribute("normal") as THREE.BufferAttribute;
  const tris = g.getAttribute("position").count / 3;
  const shade: boolean[] = [];
  for (let t = 0; t < tris; t++) {
    const n = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      n[0] += nor.getX(t * 3 + k);
      n[1] += nor.getY(t * 3 + k);
      n[2] += nor.getZ(t * 3 + k);
    }
    const a = n.map(Math.abs);
    const axis = a[0] >= a[1] && a[0] >= a[2] ? 0 : a[1] >= a[2] ? 1 : 2;
    shade.push(Boolean(hidden & (1 << (axis * 2 + (n[axis] > 0 ? 1 : 0)))));
  }
  const count = shade.filter(Boolean).length;
  if (count === 0) return null;
  const pick = (want: boolean) => {
    const out = new THREE.BufferGeometry();
    const n = want ? count : tris - count;
    for (const name of Object.keys(g.attributes)) {
      const attr = g.getAttribute(name) as THREE.BufferAttribute;
      const size = attr.itemSize;
      const src = attr.array as Float32Array;
      const dst = new Float32Array(n * 3 * size);
      let i = 0;
      for (let t = 0; t < tris; t++) if (shade[t] === want) dst.set(src.subarray(t * 3 * size, (t + 1) * 3 * size), i++ * 3 * size);
      out.setAttribute(name, new THREE.BufferAttribute(dst, size));
    }
    return out;
  };
  return { visible: pick(false), shaded: pick(true) };
}

export function PartNode({ part, exiting, kit, delay, onSelect, onLeaf, hidden = 0 }: NodeProps) {
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
  // una pantalla abierta se ve por adentro: su tela va de los dos lados
  const picked = pickMaterial(kit, part);
  const material = picked && part.geometry === "shade" ? twoSided(picked) : picked;

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
    if (part.geometry === "bend" && part.bend) return bendGeometry(part);
    if (part.corners) {
      const g = cornersGeometry(part);
      const front = part.front || part.kind === "door" || part.kind === "drawer-front";
      meterUvs(g, part.size.map((v) => v * MM), part.id, front ? part.position.map((v, i) => (v + part.size[i] / 2) * MM) : undefined);
      return g;
    }
    if (part.geometry !== "cushion" && !edged) return null;
    const [sx, sy, sz] = part.size.map((v) => Math.max(v, 1) * MM);
    const radius = part.geometry === "cushion" ? Math.min(part.radius ?? 60, Math.min(...part.size) / 2 - 0.5) : Math.min(2.2, Math.min(...part.size) * 0.22);
    // lo que se deforma necesita una malla pareja; lo demás, la caja redondeada liviana
    const cell = part.tuft ? 0.018 : part.drape ? 0.025 : part.puff ? 0.03 : 0.04;
    const g: THREE.BufferGeometry =
      part.tuft || part.wrinkle || part.puff || part.pinch ? gridRoundedBox([sx, sy, sz], radius * MM, cell) : new RoundedBoxGeometry(sx, sy, sz, part.geometry === "cushion" ? 7 : 2, radius * MM);
    // en una placa el redondeo mide menos de un píxel: con normales suaves, el
    // suavizado de bordes las lee fuera del triángulo y el canto brilla a
    // puntitos. Con facetas planas (sin índice, cada triángulo con su normal)
    // el brillo del canto sale parejo, una línea fina como en la madera real
    if (edged) g.computeVertexNormals();
    if (part.puff) puffGeometry(g, [sx, sy, sz], part.puff);
    if (part.pinch) pinchGeometry(g, [sx, sy, sz], part.pinch);
    if (part.tuft) tuftGeometry(g, [sx, sy, sz], part.tuft);
    if (part.wrinkle) {
      if (part.drape) drapeGeometry(g, [sx, sy, sz], part.drape);
      let h = 0;
      for (const ch of part.id) h = (h * 31 + ch.charCodeAt(0)) % 997;
      wrinkleGeometry(g, part.wrinkle, h / 997);
    }
    // los frentes (puertas, cajones) comparten la veta con sus vecinos
    const front = part.front || part.kind === "door" || part.kind === "drawer-front";
    const flat = g.index ? g.toNonIndexed() : g;
    if (flat !== g) g.dispose();
    meterUvs(flat, [sx, sy, sz], part.id, front ? part.position.map((v, i) => (v + part.size[i] / 2) * MM) : undefined);
    return flat;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part.geometry, edged, part.size[0], part.size[1], part.size[2], part.radius, part.arc && JSON.stringify(part.arc), part.bend && JSON.stringify(part.bend), part.corners && part.corners.join(","), part.tuft && JSON.stringify(part.tuft), part.wrinkle, part.puff, part.pinch, part.drape && JSON.stringify(part.drape), (part.front || part.kind === "door" || part.kind === "drawer-front") && part.position.join(",")]);
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
    if (part.geometry === "shade") return g.shade;
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
    // abierto o despiezado, la ranura deja de existir: todas las caras con el material de
    // siempre; con rayos X también (los frentes se vuelven transparentes y la copia no los sigue)
    if (m && closedBox && material) m.material = drawer > 0.01 || e > 0.01 || anim.xray.v > 0.01 ? material : closedBox;
    if (shadedMesh.current && shadedMaterial && material) {
      const apart = drawer > 0.01 || e > 0.01 || anim.xray.v > 0.01 || Math.abs(slideX) > 1 || (door !== null && anim.open.v > 0.01);
      shadedMesh.current.material = apart ? material : shadedMaterial;
    }
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
  // las caras en sombra van en una malla hija, con la variante oscura del material
  const split = useMemo(() => (cushion && edged && hidden ? splitHidden(cushion, hidden) : null), [cushion, edged, hidden]);
  useEffect(
    () => () => {
      split?.visible.dispose();
      split?.shaded.dispose();
    },
    [split],
  );
  const shadedMaterial = useMemo(() => (material && split ? shadedOf(material) : null), [material, split]);
  const shadedMesh = useRef<THREE.Mesh>(null);
  // la caja de un cajón cerrado solo se ve por la ranura entre frentes, donde es
  // sombra: va oscura hasta que el cajón sale
  const boxPart = part.kind === "drawer-side" || part.kind === "drawer-end" || part.kind === "drawer-bottom";
  const closedBox = useMemo(() => (boxPart && material ? shadedOf(material) : null), [boxPart, material]);

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
            geometry={trap && trapGeo ? trapGeo : (split?.visible ?? cushion ?? geometry)}
            material={material}
            rotation={part.geometry === "glow" ? glowRotation : undefined}
            castShadow={castShadow}
            receiveShadow={part.kind !== "glow"}
            onClick={handleClick}
            renderOrder={part.kind === "glow" ? 2 : part.front ? 1 : 0}
          >
            {/* hija de la malla: sigue su posición y su escala */}
            {split && shadedMaterial && <mesh ref={shadedMesh} geometry={split.shaded} material={shadedMaterial} castShadow={castShadow} receiveShadow />}
          </mesh>
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
const LED_NITS = 85;

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
