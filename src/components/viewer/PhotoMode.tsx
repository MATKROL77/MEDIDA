"use client";

/**
 * Modo foto: cuando la escena se queda quieta, el mismo 3D se recalcula con
 * trazado de rayos (three-gpu-pathtracer). La luz rebota de verdad: la madera
 * tiñe el piso, los LED iluminan lo que tienen cerca y las sombras se abren
 * con la distancia, como en una foto. Se refina de a poco, sin trabar la
 * página, y apenas algo se mueve vuelve el 3D rápido.
 *
 * Lo que en el 3D rápido es un truco (la mancha de luz pintada bajo un LED, la
 * sombra de contacto, la caja de selección) lleva `userData.fake` y el trazado
 * no lo ve. Lo que solo existe para el trazado (las luces de área de los LED y
 * el softbox) lleva `userData.photoOnly` y el 3D rápido no lo dibuja.
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { DenoiseMaterial, WebGLPathTracer } from "three-gpu-pathtracer";

import { photoVersion } from "./photo";

export type PhotoStatus = {
  /** off: apagado; waiting: hay movimiento; rendering: refinando; done: terminado */
  state: "off" | "waiting" | "rendering" | "done";
  /** de 0 a 1 */
  progress: number;
};

/** avisa al compositor de efectos cuándo la foto tapa todo el lienzo: ahí deja de dibujar */
export type PhotoBus = {
  shown: boolean;
  /** alguien va a leer el lienzo en este cuadro (una captura): hay que dibujarlo */
  draw: boolean;
  /** el trazado está calculando: el medidor de rendimiento no tiene que leer esos cuadros */
  busy: boolean;
  listeners: Set<() => void>;
};

export function createPhotoBus(): PhotoBus {
  return { shown: false, draw: false, busy: false, listeners: new Set() };
}

function setShown(bus: PhotoBus, shown: boolean) {
  if (bus.shown === shown) return;
  bus.shown = shown;
  bus.listeners.forEach((l) => l());
}

/** el equipo puede con el trazado: WebGL 2 con texturas de punto flotante */
export function photoCapable(gl: THREE.WebGLRenderer): boolean {
  const ctx = gl.getContext();
  return typeof WebGL2RenderingContext !== "undefined" && ctx instanceof WebGL2RenderingContext && !!ctx.getExtension("EXT_color_buffer_float");
}

/** cuánto tiene que estar quieta la escena (ms) antes de empezar */
const SCENE_QUIET = 500;
const CAMERA_QUIET = 220;
/**
 * En la foto, el relleno del ambiente baja y manda el softbox: así hay sombra
 * de apoyo y volumen, como en una foto de catálogo.
 */
const PHOTO_ENVIRONMENT = 0.7;

/**
 * Una huella numérica de todo lo que se ve: posiciones, medidas, opacidades,
 * colores e intensidades. Si cambia, algo se movió. Es entera (redondeada a
 * décimas de milímetro) para que un resorte que ya llegó no la siga moviendo.
 */
function fingerprint(scene: THREE.Scene): number {
  let sum = 0;
  let i = 0;
  const add = (v: number) => {
    sum += Math.round(v * 1e4) * (1 + (i++ % 13));
  };
  scene.traverseVisible((o) => {
    const mesh = o as THREE.Mesh;
    const light = o as THREE.Light;
    if (!mesh.isMesh && !light.isLight) return;
    const e = o.matrixWorld.elements;
    for (let k = 0; k < 15; k++) if (k % 4 !== 3) add(e[k]);
    if (light.isLight) {
      add(light.intensity);
      return;
    }
    const m = mesh.material as THREE.MeshStandardMaterial;
    if (!m || Array.isArray(m)) return;
    add(m.opacity);
    add(m.visible ? 1 : 0);
    if (m.color) add(m.color.r + m.color.g * 3 + m.color.b * 7);
    if (m.emissiveIntensity !== undefined) add(m.emissiveIntensity);
  });
  add(scene.environmentIntensity);
  if (scene.background instanceof THREE.Color) add(scene.background.r + scene.background.g * 3 + scene.background.b * 7);
  return sum + photoVersion() * 1e9;
}

function cameraPrint(camera: THREE.Camera): number {
  let sum = 0;
  camera.matrixWorld.elements.forEach((v, k) => (sum += Math.round(v * 1e4) * (k + 1)));
  const p = camera as THREE.PerspectiveCamera;
  return sum + Math.round((p.fov ?? 0) * 100) + Math.round((p.aspect ?? 0) * 1e4) * 31;
}

type Props = {
  enabled: boolean;
  bus: PhotoBus;
  onStatus?: (s: PhotoStatus) => void;
  /** tope de píxeles calculados: en un teléfono, menos */
  maxPixels: number;
  /** muestras por píxel para dar la foto por terminada */
  samples: number;
};

export function PhotoMode({ enabled, bus, onStatus, maxPixels, samples }: Props) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const st = useRef({
    pt: null as WebGLPathTracer | null,
    denoise: null as FullScreenQuad | null,
    failed: false,
    active: false,
    built: false,
    sceneDirty: true,
    camDirty: true,
    sceneSig: NaN,
    camSig: NaN,
    sceneAt: 0,
    camAt: 0,
    perFrame: 1,
    slow: 0,
    fast: 0,
    opacity: 0,
    reported: "",
    /** cuántas pasadas había la última vez que se pasó la foto a pantalla */
    drawn: -1,
  });
  const status = useRef(onStatus);
  status.current = onStatus;

  const report = (s: PhotoStatus) => {
    const key = `${s.state}:${Math.round(s.progress * 40)}`;
    if (st.current.reported === key) return;
    st.current.reported = key;
    status.current?.(s);
  };

  useEffect(
    () => () => {
      st.current.pt?.dispose();
      st.current.pt = null;
      st.current.denoise?.dispose();
      (st.current.denoise?.material as THREE.Material | undefined)?.dispose();
      st.current.denoise = null;
      setShown(bus, false);
    },
    [bus],
  );

  const stop = () => {
    const s = st.current;
    if (!s.active) return;
    s.active = false;
    s.drawn = -1;
    bus.busy = false;
    s.opacity = 0;
    s.pt?.reset();
    setShown(bus, false);
  };

  /** arma la escena del trazado: sin los trucos del 3D rápido y con las luces que solo existen para la foto */
  const build = (pt: WebGLPathTracer) => {
    const hidden: THREE.Object3D[] = [];
    const shown: THREE.Object3D[] = [];
    scene.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (o.visible && (o.userData.fake || (mat && !Array.isArray(mat) && mat.userData.fake))) hidden.push(o);
      if (o.userData.photoOnly && !o.visible) shown.push(o);
    });
    hidden.forEach((o) => (o.visible = false));
    shown.forEach((o) => (o.visible = true));
    const environment = scene.environmentIntensity;
    scene.environmentIntensity = environment * PHOTO_ENVIRONMENT;
    try {
      pt.setScene(scene, camera);
    } finally {
      hidden.forEach((o) => (o.visible = true));
      shown.forEach((o) => (o.visible = false));
      scene.environmentIntensity = environment;
    }
  };

  useFrame((_, dt) => {
    const s = st.current;
    if (!enabled || s.failed) {
      stop();
      report({ state: "off", progress: 0 });
      return;
    }
    // con el compositor apagado nadie más actualiza las matrices
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    const now = performance.now();
    const sig = fingerprint(scene);
    const cam = cameraPrint(camera);
    if (sig !== s.sceneSig) {
      s.sceneSig = sig;
      s.sceneAt = now;
      s.sceneDirty = true;
    }
    if (cam !== s.camSig) {
      s.camSig = cam;
      s.camAt = now;
      s.camDirty = true;
    }
    if (now - s.sceneAt < SCENE_QUIET || now - s.camAt < CAMERA_QUIET) {
      stop();
      report({ state: "waiting", progress: 0 });
      return;
    }

    if (!s.active) {
      try {
        if (!s.pt) {
          const pt = new WebGLPathTracer(gl);
          pt.rasterizeScene = false;
          // sin grano: la foto tapa el 3D recién cuando tiene casi todas sus pasadas;
          // hasta ahí se ve el 3D de siempre con el porcentaje calculado
          pt.minSamples = Math.max(6, Math.floor(samples * 0.85));
          pt.fadeDuration = 650;
          pt.renderDelay = 0;
          pt.bounces = 6;
          pt.filterGlossyFactor = 0.5;
          pt.tiles.set(2, 2);
          // al pasar a pantalla, un filtro que alisa el grano sin borronear los cantos:
          // fuerte en las primeras pasadas, casi nada cuando la foto ya está limpia
          const denoise = new FullScreenQuad(new DenoiseMaterial({ transparent: true, premultipliedAlpha: gl.getContextAttributes().premultipliedAlpha }));
          s.denoise = denoise;
          pt.renderToCanvasCallback = (target, renderer, quad) => {
            const opacity = (quad.material as THREE.ShaderMaterial & { opacity: number }).opacity;
            s.opacity = opacity;
            const m = denoise.material as DenoiseMaterial;
            const progress = Math.min(1, pt.samples / samples);
            m.uniforms.map.value = target.texture;
            m.uniforms.opacity.value = opacity;
            m.uniforms.sigma.value = 1.2 + 3.3 * (1 - progress) ** 2;
            m.uniforms.kSigma.value = 1.2;
            m.uniforms.threshold.value = 0.06 - 0.03 * progress;
            m.blending = opacity < 1 ? THREE.NormalBlending : THREE.NoBlending;
            const auto = renderer.autoClear;
            renderer.autoClear = false;
            denoise.render(renderer);
            renderer.autoClear = auto;
          };
          s.pt = pt;
        }
        const pt = s.pt;
        if (s.sceneDirty || !s.built) {
          build(pt);
          s.built = true;
        } else if (s.camDirty) pt.updateCamera();
        else pt.reset();
        s.sceneDirty = false;
        s.camDirty = false;
        pt.pausePathTracing = false;
        s.active = true;
        bus.busy = true;
      } catch (err) {
        // si el equipo no puede, queda el 3D rápido y no se vuelve a intentar
        console.warn("Modo foto no disponible", err);
        s.failed = true;
        stop();
        return;
      }
    }

    const pt = s.pt!;
    // resolución: la del lienzo, con un tope de píxeles
    const buf = gl.getDrawingBufferSize(new THREE.Vector2());
    pt.renderScale = Math.min(1, Math.sqrt(maxPixels / Math.max(1, buf.x * buf.y)));

    // más pasadas por cuadro si el equipo va holgado; menos si se traba
    if (dt < 1 / 50) s.fast++;
    else if (dt > 1 / 28) s.slow++;
    if (s.fast > 20) {
      s.perFrame = Math.min(4, s.perFrame + 1);
      s.fast = 0;
    }
    if (s.slow > 4) {
      s.perFrame = Math.max(1, s.perFrame - 1);
      s.slow = 0;
    }

    const done = pt.samples >= samples;
    pt.pausePathTracing = done;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    try {
      for (let k = 0; k < (done ? 1 : s.perFrame); k++) {
        // a pantalla solo cuando hay una pasada entera nueva, durante el fundido, o si
        // alguien lee el lienzo: lo dibujado queda en pantalla hasta el próximo cuadro
        const last = k === (done ? 0 : s.perFrame - 1);
        const fresh = Math.floor(pt.samples) !== s.drawn;
        pt.renderToCanvas = last && (fresh || s.opacity < 1 || !bus.shown || bus.draw);
        pt.renderSample();
        if (pt.renderToCanvas) s.drawn = Math.floor(pt.samples);
      }
    } finally {
      gl.toneMapping = THREE.NoToneMapping;
      pt.renderToCanvas = true;
      bus.draw = false;
    }
    if (s.opacity >= 1) setShown(bus, true);
    report({ state: done ? "done" : "rendering", progress: Math.min(1, pt.samples / samples) });
  }, 2);

  return null;
}
