/**
 * Texturas fotográficas (de Poly Haven, CC0; las prepara scripts/textures.mjs)
 * y la forma de pegarlas sin que se estiren.
 *
 * Cada pieza es una caja de 1 × 1 × 1 escalada a su medida, así que sus
 * coordenadas de textura van de 0 a 1 en cualquier tamaño: un estante de 2 m y
 * uno de 40 cm mostrarían la misma veta, estirada o apretada. Acá la textura
 * se proyecta según la medida real de la pieza (en metros), con la veta a lo
 * largo de su lado más largo, como se corta una placa de verdad.
 */

import * as THREE from "three";

import manifest from "./textures.json";

export type PhotoId = keyof typeof manifest;
type Entry = { size: number[]; grain: "u" | "v" | null; maps: string[]; average?: number[] };

export const PHOTOS = manifest as Record<PhotoId, Entry>;

export type PhotoSet = { map?: THREE.Texture; normalMap?: THREE.Texture; roughnessMap?: THREE.Texture };

const loader = typeof window === "undefined" ? null : new THREE.TextureLoader();
const sets = new Map<PhotoId, Promise<PhotoSet>>();

/**
 * Las telas se ven a la distancia de una foto de catálogo: con el sillón
 * entero en pantalla, cada píxel cubre varios milímetros y una trama a escala
 * real (el rulo de un bouclé, el cruzado de un lino) se promedia y desaparece.
 * Como en la fotografía de producto, la trama se agranda un poco para que se
 * lea. Las chapas y los pisos van a escala real.
 */
const READABLE: Partial<Record<PhotoId, number>> = { "tela-lino": 2.2, "tela-pana": 1.6, "tela-boucle": 1.9, "tela-lana": 1.8, "tela-cuero": 1.3 };

/** cambia cada vez que un material recibe su foto: el modo foto rearma la escena cuando pasa */
let version = 0;
export const photoVersion = () => version;

function load(url: string, srgb: boolean): Promise<THREE.Texture> {
  return new Promise((resolve, reject) =>
    loader!.load(
      url,
      (t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = 8;
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        resolve(t);
      },
      undefined,
      reject,
    ),
  );
}

/** los mapas de una textura; se bajan una sola vez y se comparten */
export function photoSet(id: PhotoId): Promise<PhotoSet> {
  let p = sets.get(id);
  if (!p) {
    const e = PHOTOS[id];
    p = Promise.all([
      e.maps.includes("color") ? load(`/tex/${id}.webp`, true) : undefined,
      e.maps.includes("normal") ? load(`/tex/${id}-nor.webp`, false) : undefined,
      e.maps.includes("roughness") ? load(`/tex/${id}-rough.webp`, false) : undefined,
    ]).then(([map, normalMap, roughnessMap]) => {
      // las coordenadas de las piezas están en metros: la repetición lleva la foto a su medida real
      const k = READABLE[id] ?? 1;
      for (const t of [map, normalMap, roughnessMap]) t?.repeat.set(1 / (e.size[0] * k), 1 / (e.size[1] * k));
      return { map, normalMap, roughnessMap };
    });
    // si una textura no llega, el material se queda con su color liso: nunca negro
    p.catch(() => sets.delete(id));
    sets.set(id, p);
  }
  return p;
}

/**
 * El color por el que hay que multiplicar la foto para que su promedio quede
 * en el color pedido: así la chapa de nogal se ve del tono del catálogo.
 */
export function tintFor(id: PhotoId, target: string): THREE.Color {
  const avg = PHOTOS[id].average;
  const want = new THREE.Color(target);
  if (!avg) return want;
  const base = new THREE.Color().setRGB(avg[0] / 255, avg[1] / 255, avg[2] / 255, THREE.SRGBColorSpace);
  const clamp = (v: number) => Math.min(2.2, Math.max(0.05, v));
  return new THREE.Color(clamp(want.r / base.r), clamp(want.g / base.g), clamp(want.b / base.b));
}

/** un número estable a partir de un texto: de dónde arranca la foto en cada pieza */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

/**
 * Coordenadas de textura en metros, a la medida real de la pieza, con la veta
 * (la V) a lo largo de su lado más largo. Se escriben en la geometría, así
 * valen igual para el 3D rápido y para el modo foto.
 */
export function meterUvs(geometry: THREE.BufferGeometry, size: number[], key: string, origin?: number[]) {
  // va triángulo por triángulo: la geometría tiene que venir sin índice
  if (geometry.index) throw new Error("meterUvs necesita una geometría sin índice");
  const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
  const nor = geometry.getAttribute("normal") as THREE.BufferAttribute;
  if (!pos || !nor) return;
  const g = size[0] >= size[1] && size[0] >= size[2] ? 0 : size[1] >= size[2] ? 1 : 2;
  // con origen, la foto se toma de la posición en el mueble: frentes vecinos comparten la veta,
  // como si salieran de la misma placa. Sin origen, cada pieza arranca en un lugar distinto
  const ox = origin ? 0 : hash(key) * 3;
  const oy = origin ? 0 : hash(`${key}:y`) * 3;
  const uv = new Float32Array(pos.count * 2);
  // la cara se elige por triángulo, no por vértice: en un canto redondeado un
  // triángulo con vértices proyectados en caras distintas estira la foto
  // entera en un hilo y el canto se ve con una costura clara punteada
  for (let t = 0; t + 2 < pos.count; t += 3) {
    const n = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      n[0] += nor.getX(t + k);
      n[1] += nor.getY(t + k);
      n[2] += nor.getZ(t + k);
    }
    const a = n.map(Math.abs);
    const face = a[0] >= a[1] && a[0] >= a[2] ? 0 : a[1] >= a[2] ? 1 : 2;
    // los dos ejes de la cara; el que va con la veta queda en V
    const axes = [0, 1, 2].filter((x) => x !== face);
    const along = axes.includes(g) ? g : axes[1];
    const across = axes.find((x) => x !== along)!;
    for (let i = t; i < t + 3; i++) {
      const p = origin ? [pos.getX(i) + origin[0], pos.getY(i) + origin[1], pos.getZ(i) + origin[2]] : [pos.getX(i), pos.getY(i), pos.getZ(i)];
      uv[i * 2] = p[across] + ox;
      uv[i * 2 + 1] = p[along] + oy;
    }
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

/**
 * Para lo que no tiene geometría propia (las paredes y la tarima, que son una
 * caja escalada): las coordenadas en metros se calculan en el shader.
 */
export function boxMapped<T extends THREE.Material>(material: T): T {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <uv_vertex>",
      `#include <uv_vertex>
      {
        vec3 sc = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));
        vec3 p = position * sc;
        vec3 an = abs(normal);
        vec2 bu = (an.x >= an.y && an.x >= an.z) ? p.zy : (an.y >= an.z ? p.xz : p.xy);
        #ifdef USE_MAP
          vMapUv = (mapTransform * vec3(bu, 1.0)).xy;
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv = (normalMapTransform * vec3(bu, 1.0)).xy;
        #endif
        #ifdef USE_ROUGHNESSMAP
          vRoughnessMapUv = (roughnessMapTransform * vec3(bu, 1.0)).xy;
        #endif
      }`,
    );
  };
  material.customProgramCacheKey = () => "box-meters";
  return material;
}

/**
 * Le pone a un material los mapas de una foto cuando terminan de bajar. Hasta
 * entonces se ve con su color liso, que ya es el del catálogo.
 */
export function dressWith<T extends THREE.MeshStandardMaterial>(material: T, id: PhotoId, opts: { tint?: THREE.Color; normalScale?: number; roughness?: number; project?: boolean } = {}): T {
  if (opts.project) boxMapped(material);
  photoSet(id)
    .then((set) => {
      if (set.map) material.map = set.map;
      if (set.normalMap) {
        material.normalMap = set.normalMap;
        material.normalScale.setScalar(opts.normalScale ?? 1);
      }
      if (set.roughnessMap) material.roughnessMap = set.roughnessMap;
      if (opts.roughness !== undefined) material.roughness = opts.roughness;
      if (opts.tint) material.color.copy(opts.tint);
      material.needsUpdate = true;
      version++;
    })
    .catch(() => {
      // sin la foto queda el color liso
    });
  return material;
}
