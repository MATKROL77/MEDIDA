/**
 * Texturas dibujadas en canvas y materiales compartidos.
 *
 * Nada se baja de internet: las vetas, el parquet y los degradés de luz se
 * generan al vuelo. Los materiales se comparten entre piezas para que la
 * placa no compile un shader por pieza y los cambios de color sean un solo
 * ajuste por cuadro.
 */

import * as THREE from "three";

import { materialById } from "@/lib/catalog";

/** pseudoaleatorio con semilla: la misma veta en cada carga */
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function canvas(size: number) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return [c, c.getContext("2d")!] as const;
}

function toTexture(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const cache = new Map<string, THREE.Texture>();
function cached(key: string, make: () => THREE.Texture) {
  let t = cache.get(key);
  if (!t) cache.set(key, (t = make()));
  return t;
}

/** veta de madera; "v" corre a lo largo de la V de la cara, "u" de la U */
export function woodTexture(color: string, along: "u" | "v"): THREE.Texture {
  return cached(`wood-${color}-${along}`, () => {
    const size = 1024;
    const [c, ctx] = canvas(size);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
    const rand = rng(11);
    const base = new THREE.Color(color);
    // manchas grandes: la madera nunca es pareja
    for (let i = 0; i < 9; i++) {
      const p = rand() * size;
      const g = along === "v" ? ctx.createLinearGradient(p - 120, 0, p + 120, 0) : ctx.createLinearGradient(0, p - 120, 0, p + 120);
      const tone = base.clone().offsetHSL(0, 0, (rand() - 0.5) * 0.06);
      g.addColorStop(0, "transparent");
      g.addColorStop(0.5, `#${tone.getHexString()}`);
      g.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
    ctx.globalAlpha = 1;
    // vetas finas
    for (let i = 0; i < 260; i++) {
      const offset = rand() * size;
      const wobble = 1.5 + rand() * 7;
      const freq = 0.002 + rand() * 0.008;
      const dark = rand() > 0.35;
      ctx.strokeStyle = dark ? `rgba(40,22,8,${0.04 + rand() * 0.07})` : `rgba(255,240,220,${0.03 + rand() * 0.05})`;
      ctx.lineWidth = 0.5 + rand() * 2.2;
      ctx.beginPath();
      for (let s = 0; s <= size; s += 6) {
        const d = offset + Math.sin(s * freq + i * 1.7) * wobble + Math.sin(s * freq * 3.1) * wobble * 0.3;
        const [x, y] = along === "v" ? [d, s] : [s, d];
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    return toTexture(c);
  });
}

/** parquet de tablas largas para el piso de la habitación */
export function parquetTexture(): THREE.Texture {
  return cached("parquet", () => {
    const size = 1024;
    const [c, ctx] = canvas(size);
    const rand = rng(29);
    const plankW = size / 6;
    for (let col = 0; col < 6; col++) {
      let y = -rand() * size;
      while (y < size) {
        const len = size * (0.45 + rand() * 0.5);
        const tone = new THREE.Color("#b88a5e").offsetHSL((rand() - 0.5) * 0.02, (rand() - 0.5) * 0.08, (rand() - 0.5) * 0.08);
        ctx.fillStyle = `#${tone.getHexString()}`;
        ctx.fillRect(col * plankW, y, plankW, len);
        for (let k = 0; k < 14; k++) {
          ctx.strokeStyle = `rgba(60,35,15,${0.04 + rand() * 0.06})`;
          ctx.lineWidth = 0.6 + rand() * 1.4;
          const x = col * plankW + rand() * plankW;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.bezierCurveTo(x + (rand() - 0.5) * 8, y + len / 3, x + (rand() - 0.5) * 8, y + (2 * len) / 3, x + (rand() - 0.5) * 6, y + len);
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(40,24,10,0.35)";
        ctx.fillRect(col * plankW, y, plankW, 2);
        y += len;
      }
      ctx.fillStyle = "rgba(40,24,10,0.3)";
      ctx.fillRect(col * plankW, 0, 2, size);
    }
    const t = toTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });
}

/** pinotea: tablas largas y angostas, tono ámbar */
export function pinoteaTexture(): THREE.Texture {
  return cached("pinotea", () => {
    const size = 1024;
    const [c, ctx] = canvas(size);
    const rand = rng(41);
    const cols = 10;
    const plankW = size / cols;
    for (let col = 0; col < cols; col++) {
      let y = -rand() * size;
      while (y < size) {
        const len = size * (0.6 + rand() * 0.7);
        const tone = new THREE.Color("#a8693a").offsetHSL((rand() - 0.5) * 0.015, (rand() - 0.5) * 0.06, (rand() - 0.5) * 0.06);
        ctx.fillStyle = `#${tone.getHexString()}`;
        ctx.fillRect(col * plankW, y, plankW, len);
        for (let k = 0; k < 9; k++) {
          ctx.strokeStyle = `rgba(70,30,10,${0.05 + rand() * 0.07})`;
          ctx.lineWidth = 0.6 + rand() * 1.2;
          const x = col * plankW + rand() * plankW;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + (rand() - 0.5) * 4, y + len);
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(40,18,6,0.35)";
        ctx.fillRect(col * plankW, y, plankW, 2);
        y += len;
      }
      ctx.fillStyle = "rgba(40,18,6,0.3)";
      ctx.fillRect(col * plankW, 0, 1.5, size);
    }
    const t = toTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });
}

/** cemento alisado: gris con manchas suaves de llana */
export function concreteTexture(): THREE.Texture {
  return cached("cemento", () => {
    const size = 1024;
    const [c, ctx] = canvas(size);
    const rand = rng(53);
    ctx.fillStyle = "#adaca8";
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 70; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 60 + rand() * 220;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const light = rand() > 0.5;
      g.addColorStop(0, light ? "rgba(255,255,255,0.07)" : "rgba(60,58,54,0.07)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    const t = toTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });
}

/** baldosa beige de 60 × 60 con su junta */
export function tileTexture(): THREE.Texture {
  return cached("baldosa", () => {
    const size = 1024;
    const [c, ctx] = canvas(size);
    const rand = rng(67);
    const n = 2;
    const tile = size / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const tone = new THREE.Color("#e2d6c2").offsetHSL(0, 0, (rand() - 0.5) * 0.03);
        ctx.fillStyle = `#${tone.getHexString()}`;
        ctx.fillRect(i * tile, j * tile, tile, tile);
      }
    ctx.fillStyle = "#c9bba3";
    for (let k = 0; k <= n; k++) {
      ctx.fillRect(k * tile - 3, 0, 6, size);
      ctx.fillRect(0, k * tile - 3, size, 6);
    }
    const t = toTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });
}

/** degradés para las tarjetas de luz de los LED */
export function glowTexture(kind: "down" | "pool" | "fromLeft" | "fromRight"): THREE.Texture {
  return cached(`glow-${kind}`, () => {
    const size = 256;
    const [c, ctx] = canvas(size);
    let g: CanvasGradient;
    if (kind === "down") g = ctx.createLinearGradient(0, 0, 0, size);
    else if (kind === "fromLeft") g = ctx.createLinearGradient(0, 0, size, 0);
    else if (kind === "fromRight") g = ctx.createLinearGradient(size, 0, 0, 0);
    else g = ctx.createLinearGradient(0, size, 0, 0);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.55)");
    g.addColorStop(0.6, "rgba(255,255,255,0.15)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    // los bordes laterales se apagan: la luz no corta en seco contra el lateral
    const edge = ctx.createLinearGradient(0, 0, kind === "down" || kind === "pool" ? size : 0, kind === "down" || kind === "pool" ? 0 : size);
    edge.addColorStop(0, "rgba(0,0,0,1)");
    edge.addColorStop(0.12, "rgba(0,0,0,0)");
    edge.addColorStop(0.88, "rgba(0,0,0,0)");
    edge.addColorStop(1, "rgba(0,0,0,1)");
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, size, size);
    return toTexture(c, false);
  });
}

export type MaterialKit = ReturnType<typeof createKit>;

/**
 * Un juego de materiales por combinación de terminaciones. Los frentes tienen
 * su propia copia transparente para la vista de rayos X.
 */
export function createKit(bodyId: string, doorId: string) {
  const surface = (id: string, along: "u" | "v", transparent = false) => {
    const m = materialById(id);
    return new THREE.MeshStandardMaterial({
      color: m.grain ? "#ffffff" : m.color,
      map: m.grain ? woodTexture(m.color, along) : null,
      roughness: m.grain ? 0.58 : 0.5,
      metalness: 0,
      transparent,
      envMapIntensity: 0.9,
    });
  };
  const body = materialById(bodyId);
  const kit = {
    body: { v: surface(bodyId, "v"), u: surface(bodyId, "u") },
    door: { v: surface(doorId, "v", true), u: surface(doorId, "u", true) },
    /** frentes de cajón con el color del cuerpo (van detrás de las puertas) */
    bodyFront: { v: surface(bodyId, "v", true), u: surface(bodyId, "u", true) },
    back: new THREE.MeshStandardMaterial({
      color: new THREE.Color(body.color).multiplyScalar(body.grain ? 0.92 : 0.96),
      map: body.grain ? woodTexture(body.color, "v") : null,
      roughness: 0.75,
    }),
    metal: new THREE.MeshStandardMaterial({ color: "#c9ccd0", metalness: 1, roughness: 0.32 }),
    handle: new THREE.MeshStandardMaterial({ color: "#2a2a2a", metalness: 0.75, roughness: 0.28, transparent: true }),
    groove: new THREE.MeshStandardMaterial({ color: "#191714", roughness: 0.9, transparent: true }),
    mirror: new THREE.MeshStandardMaterial({ color: "#f2f5f6", metalness: 1, roughness: 0.035, envMapIntensity: 1.4, transparent: true }),
    glass: new THREE.MeshStandardMaterial({ color: "#2d3336", metalness: 0.2, roughness: 0.06, transparent: true, opacity: 0.55, envMapIntensity: 1.3 }),
    frame: new THREE.MeshStandardMaterial({ color: "#b8bcc1", metalness: 1, roughness: 0.3, transparent: true }),
    led: new THREE.MeshStandardMaterial({ color: "#e6e6e6", roughness: 0.4, emissive: "#000000", emissiveIntensity: 0 }),
    glow: {
      z: glowMaterial("down"),
      y: glowMaterial("pool"),
      // el plano mira a +x girado 90°: su U corre de adelante hacia atrás
      "x+": glowMaterial("fromLeft"),
      "x-": glowMaterial("fromRight"),
    },
  };
  return kit;
}

function glowMaterial(kind: "down" | "pool" | "fromLeft" | "fromRight") {
  return new THREE.MeshBasicMaterial({
    map: glowTexture(kind),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
}

/** materiales de frente: los que se vuelven translúcidos con rayos X */
export function frontMaterials(kit: MaterialKit): THREE.Material[] {
  return [kit.door.u, kit.door.v, kit.bodyFront.u, kit.bodyFront.v, kit.handle, kit.groove, kit.mirror, kit.frame];
}

export function disposeKit(kit: MaterialKit) {
  const all = [kit.body.u, kit.body.v, kit.door.u, kit.door.v, kit.bodyFront.u, kit.bodyFront.v, kit.back, kit.metal, kit.handle, kit.groove, kit.mirror, kit.glass, kit.frame, kit.led, ...Object.values(kit.glow)];
  all.forEach((m) => m.dispose());
}
