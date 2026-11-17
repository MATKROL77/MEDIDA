"use client";

/**
 * Sombra de apoyo: lo que hace que el mueble pise el piso en vez de flotar.
 *
 * Es la sombra que deja la luz pareja del ambiente debajo y alrededor de lo
 * que está cerca del piso: oscura donde el mueble toca, cada vez más clara
 * con la altura. Se saca mirando el mueble desde abajo (una cámara a ras del
 * piso que apunta para arriba y guarda qué tan cerca está cada cosa), se
 * desenfoca y se pinta sobre el piso.
 *
 * Es un truco del 3D rápido (`userData.fake`): en el modo foto la sombra de
 * verdad la calcula el trazado.
 *
 * Costo: mientras algo se mueve, un dibujo más del mueble por cuadro en un
 * mapa chico (256 px en calidad alta, 128 en la liviana) y cuatro pasadas de
 * desenfoque sobre ese mapa. Con todo quieto se refresca cada tanto y nada más.
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";

import type { Assembly } from "@/lib/assembly";

import { type SceneAnim, useSceneAnim } from "./anim";

const MM = 0.001;
/** hasta qué altura (m) algo oscurece el piso que tiene debajo */
const REACH = 0.6;
/** cuánto sobra el mapa alrededor del mueble (m): entran las puertas abiertas y el desenfoque */
const MARGIN = 0.85;
/** la cámara va apenas bajo el piso: lo que apoya justo en el piso no queda cortado */
const DROP = 0.01;
/** el desenfoque, en metros: una pasada fina y otra amplia */
const BLUR = [0.016, 0.04];
/** después de un cambio, la sombra se recalcula en cada cuadro durante este tiempo (ms) */
const ACTIVE_MS = 3200;
/** con todo quieto, cada cuántos cuadros se refresca (por lo que termina de bajar tarde) */
const IDLE_EVERY = 24;

const DEPTH_VERTEX = /* glsl */ `
#include <common>
void main() {
  #include <begin_vertex>
  #include <project_vertex>
}`;
// la profundidad de una cámara sin perspectiva es la altura sobre el piso, de 0 a 1
const DEPTH_FRAGMENT = /* glsl */ `
void main() {
  float near = 1.0 - gl_FragCoord.z;
  gl_FragColor = vec4(1.0, 1.0, 1.0, near * sqrt(near));
}`;
const BLUR_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;
// campana de 9 muestras en 5 lecturas; la última pasada apaga los bordes del mapa
const BLUR_FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform vec2 stride;
uniform float edge;
varying vec2 vUv;
void main() {
  float a = texture2D(map, vUv).a * 0.2270270270;
  a += (texture2D(map, vUv + stride * 1.3846153846).a + texture2D(map, vUv - stride * 1.3846153846).a) * 0.3162162162;
  a += (texture2D(map, vUv + stride * 3.2307692308).a + texture2D(map, vUv - stride * 3.2307692308).a) * 0.0702702703;
  vec2 border = smoothstep(vec2(0.0), vec2(edge), min(vUv, 1.0 - vUv));
  gl_FragColor = vec4(1.0, 1.0, 1.0, a * mix(1.0, border.x * border.y, step(0.0001, edge)));
}`;

/** algo se está moviendo: puertas, cajones, hojas o la vista explotada */
function moving(anim: SceneAnim): boolean {
  if (anim.open.v !== anim.open.target || anim.explode.v !== anim.explode.target) return true;
  for (const s of anim.drawers.values()) if (s.v !== s.target) return true;
  for (const s of anim.leaves.values()) if (s.v !== s.target) return true;
  return false;
}

type Props = {
  assembly: Assembly;
  /** calidad alta: mapa de 256 px; liviana, 128 */
  hq: boolean;
  /** qué tan oscura es la sombra bajo lo que toca el piso */
  strength: number;
};

export function Grounding({ assembly, hq, strength }: Props) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const anim = useSceneAnim();
  const size = hq ? 256 : 128;

  const kit = useMemo(() => {
    const options = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, stencilBuffer: false };
    const a = new THREE.WebGLRenderTarget(size, size, { ...options, depthBuffer: true });
    const b = new THREE.WebGLRenderTarget(size, size, { ...options, depthBuffer: false });
    // el mapa se saca mirando para arriba: su V corre al revés que la del plano del piso
    a.texture.repeat.set(1, -1);
    a.texture.offset.set(0, 1);
    const depth = new THREE.ShaderMaterial({ vertexShader: DEPTH_VERTEX, fragmentShader: DEPTH_FRAGMENT, side: THREE.DoubleSide, blending: THREE.NoBlending });
    const blur = new THREE.ShaderMaterial({
      vertexShader: BLUR_VERTEX,
      fragmentShader: BLUR_FRAGMENT,
      uniforms: { map: { value: null as THREE.Texture | null }, stride: { value: new THREE.Vector2() }, edge: { value: 0 } },
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });
    const quad = new FullScreenQuad(blur);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, REACH + DROP);
    // mira para arriba; lo de arriba de la imagen es el frente del mueble
    camera.rotation.set(Math.PI / 2, 0, 0);
    const shadow = new THREE.MeshBasicMaterial({ map: a.texture, color: "#2a1c12", transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    return { a, b, depth, blur, quad, camera, shadow, hidden: [] as THREE.Object3D[], clear: new THREE.Color() };
  }, [size]);
  useEffect(
    () => () => {
      kit.a.dispose();
      kit.b.dispose();
      kit.depth.dispose();
      kit.blur.dispose();
      kit.quad.dispose();
      kit.shadow.dispose();
    },
    [kit],
  );

  // el rectángulo del piso que se mira: el mueble, lo que lo acompaña y un margen
  const box = useMemo(() => {
    const { min, max } = assembly.bounds;
    const room = assembly.room ?? assembly.bounds;
    const x0 = Math.min(min[0], room.min[0]) * MM - MARGIN;
    const x1 = Math.max(max[0], room.max[0]) * MM + MARGIN;
    const z0 = Math.min(min[2], room.min[2]) * MM - MARGIN;
    const z1 = Math.max(max[2], room.max[2]) * MM + MARGIN;
    return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 };
  }, [assembly]);

  // lo que no hace sombra de apoyo: el ambiente, los trucos de luz, el vidrio
  const hide = useMemo(
    () => (o: THREE.Object3D) => {
      if (!o.visible || (o as THREE.Light).isLight) return;
      const material = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      const flags = material && !Array.isArray(material) ? material.userData : null;
      if (o.userData.fake || o.userData.noContact || flags?.fake || flags?.noContact) {
        o.visible = false;
        kit.hidden.push(o);
      }
    },
    [kit],
  );

  const state = useRef({ last: 0, frame: 0 });
  // cualquier cambio de la escena (una medida, abrir, despiezar) la deja activa un rato
  useEffect(() => {
    state.current.last = performance.now();
  });

  const camera = kit.camera;
  useEffect(() => {
    camera.left = -box.w / 2;
    camera.right = box.w / 2;
    camera.top = box.d / 2;
    camera.bottom = -box.d / 2;
    camera.updateProjectionMatrix();
    state.current.last = performance.now();
  }, [camera, box]);

  useFrame(() => {
    const st = state.current;
    st.frame++;
    // en la vista explotada las piezas vuelan: la sombra de apoyo se afloja
    kit.shadow.opacity = strength * (1 - 0.6 * anim.explode.v);
    const active = performance.now() - st.last < ACTIVE_MS || moving(anim);
    if (!active && st.frame % IDLE_EVERY !== 0) return;

    const target = gl.getRenderTarget();
    const alpha = gl.getClearAlpha();
    gl.getClearColor(kit.clear);
    const background = scene.background;
    const override = scene.overrideMaterial;
    const shadows = gl.shadowMap.autoUpdate;
    const autoClear = gl.autoClear;

    kit.hidden.length = 0;
    scene.traverse(hide);
    scene.background = null;
    scene.overrideMaterial = kit.depth;
    // los mapas de sombra de las luces no cambian por mirar desde abajo
    gl.shadowMap.autoUpdate = false;
    gl.autoClear = true;
    gl.setClearColor(0xffffff, 0);
    try {
      gl.setRenderTarget(kit.a);
      gl.render(scene, camera);
    } finally {
      scene.overrideMaterial = override;
      scene.background = background;
      gl.shadowMap.autoUpdate = shadows;
      for (const o of kit.hidden) o.visible = true;
      kit.hidden.length = 0;
    }

    const u = kit.blur.uniforms;
    for (let i = 0; i < BLUR.length; i++) {
      u.map.value = kit.a.texture;
      u.edge.value = 0;
      u.stride.value.set(BLUR[i] / box.w, 0);
      gl.setRenderTarget(kit.b);
      kit.quad.render(gl);
      u.map.value = kit.b.texture;
      u.edge.value = i === BLUR.length - 1 ? 0.08 : 0;
      u.stride.value.set(0, BLUR[i] / box.d);
      gl.setRenderTarget(kit.a);
      kit.quad.render(gl);
    }

    gl.setRenderTarget(target);
    gl.setClearColor(kit.clear, alpha);
    gl.autoClear = autoClear;
  });

  return (
    <group userData={{ fake: true }}>
      <primitive object={camera} position={[box.x, -DROP, box.z]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[box.x, 0.0012, box.z]} scale={[box.w, box.d, 1]} material={kit.shadow} renderOrder={1} raycast={() => null}>
        <planeGeometry args={[1, 1]} />
      </mesh>
    </group>
  );
}
