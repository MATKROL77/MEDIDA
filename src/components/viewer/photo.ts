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
    ]).then(([map, normalMap, roughnessMap]) => ({ map, normalMap, roughnessMap }));
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

/**
 * Proyecta las texturas del material según la medida real de cada pieza.
 * `tile`: cuántos metros cubre la textura. `grain`: si la veta de la foto
 * corre a lo largo de su V ("v") o de su U ("u").
 */
export function boxMapped<T extends THREE.Material>(material: T, tile: number[], grain: "u" | "v" | null): T {
  const key = `box-${grain}-${tile[0].toFixed(3)}-${tile[1].toFixed(3)}`;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.boxTile = { value: new THREE.Vector2(1 / tile[0], 1 / tile[1]) };
    shader.vertexShader = `uniform vec2 boxTile;\n${shader.vertexShader}`.replace(
      "#include <uv_vertex>",
      `#include <uv_vertex>
      {
        // medida real de la pieza: la escala de su matriz, en metros
        vec3 sc = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));
        vec3 p = position * sc;
        vec3 an = abs(normal);
        // la veta corre a lo largo del lado más largo de la pieza
        float g = (sc.x >= sc.y && sc.x >= sc.z) ? 0.0 : (sc.y >= sc.z ? 1.0 : 2.0);
        vec2 q;
        if (an.x >= an.y && an.x >= an.z) q = g == 2.0 ? p.zy : p.yz;
        else if (an.y >= an.z) q = g == 2.0 ? p.zx : p.xz;
        else q = g == 1.0 ? p.yx : p.xy;
        // cada pieza arranca en otro lugar de la foto: dos estantes iguales no se ven calcados
        vec2 seed = vec2(fract(sc.x * 7.13 + sc.z * 3.71), fract(sc.y * 5.29 + sc.z * 1.87));
        vec2 bu = ${grain === "v" ? "q.yx" : "q"} * boxTile + seed;
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
  material.customProgramCacheKey = () => key;
  return material;
}

/**
 * Le pone a un material los mapas de una foto cuando terminan de bajar. Hasta
 * entonces se ve con su color liso, que ya es el del catálogo.
 */
export function dressWith<T extends THREE.MeshStandardMaterial>(material: T, id: PhotoId, opts: { tint?: THREE.Color; normalScale?: number; roughness?: number } = {}): T {
  const e = PHOTOS[id];
  boxMapped(material, e.size, e.grain);
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
    })
    .catch(() => {
      // sin la foto queda el color liso
    });
  return material;
}
