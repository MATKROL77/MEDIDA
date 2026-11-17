import * as THREE from "three";
import type { Part } from "@/lib/assembly";
import { AIR_REACH, END, GATE, HALO_REACH, SOFT, washMesh } from "@/lib/led";

/**
 * La luz de las tiras LED en el 3D rápido: un material que calcula, en cada
 * píxel de las caras de un hueco, cuánta luz le llega desde la tira (la misma
 * cuenta que `irradiance` en `lib/led.ts`) y multiplica lo que hay debajo. Un
 * nogal alumbrado es un nogal más claro y apenas más cálido; una melamina
 * blanca llega a brillar. No hay luces de verdad: no encarece el sombreado del
 * resto del mueble, y son un rectángulo o dos por tira.
 *
 * Es un truco del 3D rápido (`userData.fake`): el trazado de rayos no lo ve,
 * ahí cada tira es una luz de área.
 */

const MM = 0.001;

/** cuánto aclara la luz lo que toca, por unidad de luz que llega */
const GAIN = 0.26;
/** la cortina (lo que la tira alumbra en el aire del hueco) pesa menos que las caras */
const AIR_GAIN = 0.045;
/** el resplandor del difusor sobre la placa que lleva la tira, pegado al perfil */
const HALO_GAIN = 1.6;
/** tope de cuánto se aclara una placa pegada a la tira: no se quema */
const CEILING = 1.6;

const VERTEX = /* glsl */ `
attribute vec3 rel;
attribute vec4 aim;
attribute vec4 edge;
attribute float span;
varying vec3 vRel;
varying vec4 vAim;
varying vec4 vEdge;
varying vec2 vUv;
varying float vSpan;
void main() {
  vRel = rel;
  vAim = aim;
  vEdge = edge;
  vUv = uv;
  vSpan = span;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 tint;
uniform float strength;
varying vec3 vRel;
varying vec4 vAim;
varying vec4 vEdge;
varying vec2 vUv;
varying float vSpan;

// apaga la luz hacia un borde abierto: f es el ancho del apagado, t la distancia al borde
float fade(float f, float t) {
  return f > 0.0 ? smoothstep(0.0, f, t) : 1.0;
}
void main() {
  // del plano de la tira para atrás no llega luz; el difusor asoma, así que no corta en seco
  float gate = smoothstep(0.0, ${GATE.toFixed(4)}, -vRel.y);
  float u1 = -vRel.x;
  float u2 = vSpan - vRel.x;
  float e;
  if (vAim.w > 1.5) {
    // la placa que lleva la tira: el resplandor del difusor, pegado al perfil
    float r = sqrt(vRel.z * vRel.z + ${(HALO_REACH * HALO_REACH).toFixed(8)});
    e = (atan(u2 / r) - atan(u1 / r)) * ${(HALO_REACH / Math.PI).toFixed(6)} / r * ${HALO_GAIN.toFixed(4)};
  } else if (vAim.w > 0.5) {
    // la cortina: la luz que cruza el aire del hueco
    float r = sqrt(vRel.y * vRel.y + ${(AIR_REACH * AIR_REACH).toFixed(6)});
    e = gate * (atan(u2 / r) - atan(u1 / r)) / r * ${AIR_GAIN.toFixed(4)};
  } else {
    float r2 = vRel.y * vRel.y + vRel.z * vRel.z + ${(SOFT * SOFT).toFixed(6)};
    float a = -(vAim.y * vRel.y + vAim.z * vRel.z);
    float d1 = sqrt(r2 + u1 * u1);
    float d2 = sqrt(r2 + u2 * u2);
    e = gate * (a * (u2 / d2 - u1 / d1) / r2 + ${END.toFixed(3)} * vAim.x * (1.0 / d1 - 1.0 / d2)) * ${GAIN.toFixed(4)};
  }
  e = max(e, 0.0) * fade(vEdge.x, vUv.x) * fade(vEdge.y, 1.0 - vUv.x) * fade(vEdge.z, vUv.y) * fade(vEdge.w, 1.0 - vUv.y);
  // cerca de la tira la luz se aprieta en vez de quemar
  float lift = ${CEILING.toFixed(2)} * (1.0 - exp(-e / ${CEILING.toFixed(2)}));
  // un grano mínimo: un degradé tan suave, sobre una placa lisa, si no hace escalones
  float grain = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5;
  lift *= 1.0 + grain * 0.03;
  gl_FragColor = vec4(tint * lift * strength, 1.0);
}
`;

export type WashMaterial = THREE.ShaderMaterial & { uniforms: { tint: { value: THREE.Color }; strength: { value: number } } };

/** el material de la luz: lo que dibuja se multiplica por lo que hay debajo y se le suma */
export function createWashMaterial(): WashMaterial {
  const m = new THREE.ShaderMaterial({
    uniforms: { tint: { value: new THREE.Color("#ffffff") }, strength: { value: 0 } },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.DstColorFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  }) as WashMaterial;
  m.userData.fake = true;
  return m;
}

const washes = new WeakMap<object, WashMaterial>();
/** un material de luz por juego de materiales: cada escena prende y apaga las suyas */
export function washMaterial(kit: object): WashMaterial {
  let m = washes.get(kit);
  if (!m) {
    m = createWashMaterial();
    washes.set(kit, m);
  }
  return m;
}

/** la malla de la luz de una tira, en metros, centrada en la caja del hueco */
export function washGeometry(part: Part): THREE.BufferGeometry | null {
  if (!part.wash) return null;
  const mesh = washMesh(part.size, part.wash);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(mesh.position.map((v) => v * MM), 3));
  g.setAttribute("rel", new THREE.Float32BufferAttribute(mesh.rel, 3));
  g.setAttribute("aim", new THREE.Float32BufferAttribute(mesh.aim, 4));
  g.setAttribute("edge", new THREE.Float32BufferAttribute(mesh.edge, 4));
  g.setAttribute("span", new THREE.Float32BufferAttribute(mesh.span, 1));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(mesh.uv, 2));
  g.setIndex(mesh.index);
  return g;
}

/**
 * El perfil de una tira: un canal de aluminio y, del lado que alumbra, el
 * difusor opalino, que es lo que brilla. Las dos formas ocupan una caja de
 * 1 × 1 × 1 que el 3D estira a la medida de la tira; hay un juego por
 * orientación (acostada a lo ancho, acostada a lo hondo, parada mirando a un
 * lado o al otro), compartido entre todas las tiras.
 */
export type StripShape = { channel: THREE.BufferGeometry; diffuser: THREE.BufferGeometry };
const shapes = new Map<string, StripShape>();
/** qué parte del alto de la tira es el canal de aluminio; el resto es el difusor */
const CHANNEL = 0.24;
/** el difusor es apenas más angosto que el canal: asoma la pestaña de aluminio */
const LENS = 0.84;

export function stripOrientation(part: Part): "x" | "z" | "y+" | "y-" {
  const [sx, sy, sz] = part.size;
  if (sy > sx && sy > sz) return /L$/.test(part.id) ? "y+" : "y-";
  return sx >= sz ? "x" : "z";
}

export function stripShape(orientation: "x" | "z" | "y+" | "y-"): StripShape {
  const cached = shapes.get(orientation);
  if (cached) return cached;
  // de base: la tira corre en x y alumbra hacia abajo
  const channel = new THREE.BoxGeometry(1, CHANNEL, 1);
  channel.translate(0, 0.5 - CHANNEL / 2, 0);
  // medio caño acostado: la parte redonda hacia abajo
  const diffuser = new THREE.CylinderGeometry(0.5, 0.5, 1, 20, 1, false, Math.PI / 2, Math.PI);
  diffuser.rotateZ(Math.PI / 2);
  diffuser.rotateX(-Math.PI / 2);
  fit(diffuser);
  diffuser.scale(1, 1 - CHANNEL, LENS);
  diffuser.translate(0, -CHANNEL / 2, 0);
  for (const g of [channel, diffuser]) {
    if (orientation === "z") g.rotateY(Math.PI / 2);
    // parada: el largo en y, la luz hacia +x o hacia −x
    else if (orientation === "y+") g.rotateZ(Math.PI / 2);
    else if (orientation === "y-") g.rotateZ(-Math.PI / 2);
  }
  const shape = { channel, diffuser };
  shapes.set(orientation, shape);
  return shape;
}

/** lleva una geometría a ocupar justo la caja de 1 × 1 × 1 centrada en el origen */
function fit(g: THREE.BufferGeometry) {
  g.computeBoundingBox();
  const b = g.boundingBox!;
  const size = b.getSize(new THREE.Vector3());
  const center = b.getCenter(new THREE.Vector3());
  g.translate(-center.x, -center.y, -center.z);
  g.scale(1 / Math.max(size.x, 1e-6), 1 / Math.max(size.y, 1e-6), 1 / Math.max(size.z, 1e-6));
}
