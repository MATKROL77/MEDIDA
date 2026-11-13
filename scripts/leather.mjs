/**
 * El fondo de cuero del sitio. Parte de "Leather White" de Poly Haven (CC0):
 * con su foto y su mapa de relieve calcula cómo se ve ese cuero, teñido de
 * beige, bajo dos luces: una cálida desde arriba a la izquierda y una azul
 * marino desde abajo a la derecha. Las arrugas del cuero agarran el azul de un
 * lado y el cálido del otro, como un cuero de verdad bajo esa luz.
 *
 * La salida es una baldosa que se repite sin costura (las luces son
 * direccionales: pegan igual en toda la baldosa).
 *
 *   node scripts/leather.mjs [carpeta-de-descargas]
 *
 * Necesita sharp (no es dependencia del proyecto) y salida a dl.polyhaven.org.
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = (() => {
  try {
    return require("sharp");
  } catch {
    return createRequire("/")("sharp");
  }
})();

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cache = path.resolve(process.argv[2] ?? path.join(tmpdir(), "medida-tex"));
const SLUG = "leather_white";
/** lado de la baldosa, en píxeles */
const TILE = 1024;
/** el beige al que tiene que dar el promedio (sRGB) */
const TARGET = [205, 186, 158];
/** cuánto se marca el graneado */
const RELIEF = 2.4;

async function download(map) {
  const file = path.join(cache, `${SLUG}_${map}_2k.jpg`);
  try {
    await stat(file);
    return file;
  } catch {
    // no está: se baja
  }
  const url = `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/${SLUG}/${SLUG}_${map}_2k.jpg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  await mkdir(cache, { recursive: true });
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const norm = (v) => {
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
};

const raw = async (file) => sharp(await readFile(file)).resize(TILE, TILE, { kernel: "lanczos3" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });

const [diff, nor] = await Promise.all([download("diff").then(raw), download("nor_gl").then(raw)]);

// las luces, en el espacio de la imagen (x a la derecha, y hacia arriba, z hacia afuera)
const warm = { dir: norm([-0.55, 0.6, 0.75]), color: [1.0, 0.86, 0.68], power: 1.0 };
const navy = { dir: norm([0.65, -0.55, 0.55]), color: [0.16, 0.25, 0.52], power: 0.85 };
const view = [0, 0, 1];
const half = norm(warm.dir.map((v, i) => v + view[i]));
const ambient = [0.2, 0.2, 0.24];

const px = TILE * TILE;
const lin = new Float32Array(px * 3);
const sum = [0, 0, 0];
for (let i = 0; i < px; i++) {
  // el relieve, un poco exagerado: a la distancia de una pantalla el graneado tiene que leerse
  const n = norm([(nor.data[i * 3] / 127.5 - 1) * RELIEF, (nor.data[i * 3 + 1] / 127.5 - 1) * RELIEF, nor.data[i * 3 + 2] / 127.5 - 1]);
  const d1 = Math.max(0, n[0] * warm.dir[0] + n[1] * warm.dir[1] + n[2] * warm.dir[2]);
  const d2 = Math.max(0, n[0] * navy.dir[0] + n[1] * navy.dir[1] + n[2] * navy.dir[2]);
  // el brillo apagado del cuero semimate, solo de la luz cálida
  const spec = Math.max(0, n[0] * half[0] + n[1] * half[1] + n[2] * half[2]) ** 48 * 0.18;
  for (let k = 0; k < 3; k++) {
    const albedo = toLinear(diff.data[i * 3 + k] / 255);
    const light = ambient[k] + d1 * warm.color[k] * warm.power + d2 * navy.color[k] * navy.power;
    const v = albedo * light + spec * warm.color[k];
    lin[i * 3 + k] = v;
    sum[k] += v;
  }
}

// teñido: el promedio queda en el beige pedido, la variación es la del cuero
const gain = sum.map((s, k) => toLinear(TARGET[k] / 255) / (s / px));
const out = Buffer.alloc(px * 3);
for (let i = 0; i < px * 3; i++) out[i] = Math.round(255 * Math.min(1, Math.max(0, toSrgb(lin[i] * gain[i % 3]))));

const dest = path.join(root, "public/img/cuero.webp");
await sharp(out, { raw: { width: TILE, height: TILE, channels: 3 } }).webp({ quality: 80, effort: 6 }).toFile(dest);
console.log("listo:", path.relative(root, dest), `${Math.round((await stat(dest)).size / 1024)} KB`);
