/**
 * Baja de Poly Haven las texturas fotográficas del 3D y las deja listas para
 * la web en public/tex/: WebP chicos y un manifiesto con el tamaño real de
 * cada textura (para que nada se estire) y su color promedio (para teñirla).
 *
 * Todas las texturas de Poly Haven son CC0: dominio público, sin atribución
 * obligatoria. Igual quedan listadas en public/tex/CREDITOS.md.
 *
 *   npm run textures [carpeta-de-descargas]
 *
 * Necesita sharp (no es dependencia del proyecto) y salida a api.polyhaven.com
 * y dl.polyhaven.org.
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
const out = path.join(root, "public/tex");
const cache = path.resolve(process.argv[2] ?? path.join(tmpdir(), "medida-tex"));

/**
 * Qué se baja y para qué.
 * - color: la foto entera, teñida hacia el color del catálogo
 * - detail: la foto en gris, para dar grano a un color que elige el cliente
 * - relief: solo el relieve (mapa de normales y de rugosidad)
 */
const SETS = [
  { id: "nogal", slug: "walnut_veneer", use: "color", grain: "v" },
  { id: "roble", slug: "oak_veneer_01", use: "color", grain: "v" },
  { id: "piso-madera", slug: "oak_wood_planks", use: "color", grain: "u" },
  { id: "piso-pinotea", slug: "plank_flooring_02", use: "color", grain: "v" },
  { id: "piso-cemento", slug: "concrete_floor_worn_001", use: "color" },
  { id: "piso-baldosa", slug: "floor_tiles_08", use: "color" },
  { id: "pared", slug: "beige_wall_001", use: "relief" },
  { id: "tela-lino", slug: "rough_linen", use: "detail" },
  { id: "tela-pana", slug: "velour_velvet", use: "detail" },
  { id: "tela-boucle", slug: "wool_boucle", use: "relief" },
  { id: "tela-lana", slug: "poly_wool_herringbone", use: "detail" },
  { id: "tela-cuero", slug: "leather_white", use: "relief" },
];

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "user-agent": "medida-textures" } });
  if (!res.ok) throw new Error(`${url} respondió ${res.status}`);
  return res.json();
}

async function download(url, file) {
  if (await exists(file)) return;
  const res = await fetch(url, { headers: { "user-agent": "medida-textures" } });
  if (!res.ok) throw new Error(`${url} respondió ${res.status}`);
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
}

await mkdir(out, { recursive: true });
await mkdir(cache, { recursive: true });
const manifest = {};
const credits = [];

for (const set of SETS) {
  const [files, info] = await Promise.all([fetchJson(`https://api.polyhaven.com/files/${set.slug}`), fetchJson(`https://api.polyhaven.com/info/${set.slug}`)]);
  const src = {};
  for (const [key, map] of [
    ["diff", "Diffuse"],
    ["nor", "nor_gl"],
    ["rough", "Rough"],
  ]) {
    const url = files[map]?.["1k"]?.jpg?.url;
    if (!url) continue;
    src[key] = path.join(cache, `${set.slug}_${key}.jpg`);
    await download(url, src[key]);
  }

  const entry = {
    // tamaño real que cubre la textura, en metros
    size: [info.dimensions[0] / 1000, info.dimensions[1] / 1000],
    grain: set.grain ?? null,
    maps: [],
  };
  if (set.use === "color" && src.diff) {
    await sharp(src.diff).resize(1024).webp({ quality: 82 }).toFile(path.join(out, `${set.id}.webp`));
    const { channels } = await sharp(src.diff).stats();
    entry.average = channels.slice(0, 3).map((c) => Math.round(c.mean));
    entry.maps.push("color");
  }
  if (set.use === "detail" && src.diff) {
    // en gris y llevada a un promedio claro: multiplica el color de la tela sin oscurecerlo
    const gray = sharp(src.diff).resize(512).grayscale();
    const { channels } = await gray.clone().stats();
    const gain = 225 / channels[0].mean;
    await gray.linear(gain, 0).webp({ quality: 80 }).toFile(path.join(out, `${set.id}.webp`));
    entry.maps.push("color");
  }
  if (src.nor) {
    await sharp(src.nor).resize(set.use === "color" ? 1024 : 512).webp({ quality: 86 }).toFile(path.join(out, `${set.id}-nor.webp`));
    entry.maps.push("normal");
  }
  if (src.rough) {
    await sharp(src.rough).resize(set.use === "color" ? 512 : 256).grayscale().webp({ quality: 78 }).toFile(path.join(out, `${set.id}-rough.webp`));
    entry.maps.push("roughness");
  }
  manifest[set.id] = entry;
  const authors = Object.keys(info.authors ?? {}).join(", ");
  credits.push(`| ${set.id} | [${info.name}](https://polyhaven.com/a/${set.slug}) | ${authors} |`);
  console.log(`${set.id}: ${entry.maps.join(", ")}`);
}

await writeFile(path.join(root, "src/components/viewer/textures.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(
  path.join(out, "CREDITOS.md"),
  [
    "# Texturas",
    "",
    "Todas son de [Poly Haven](https://polyhaven.com), con licencia CC0 (dominio público).",
    "Las genera `scripts/textures.mjs`.",
    "",
    "| Uso | Textura | Autor |",
    "| --- | --- | --- |",
    ...credits,
    "",
    "## Además",
    "",
    "| Uso | Recurso | Autor |",
    "| --- | --- | --- |",
    "| Luz y reflejos del 3D (`public/env/studio_small_09-1k.hdr`) | [Studio Small 09](https://polyhaven.com/a/studio_small_09) | Sergej Majboroda |",
    "| Fondo de cuero del sitio (`public/img/cuero.webp`, lo arma `scripts/leather.mjs`) | [Leather White](https://polyhaven.com/a/leather_white) | Rob Tuytel |",
    "",
  ].join("\n"),
);
const sizes = await Promise.all(
  Object.keys(manifest).flatMap((id) =>
    ["", "-nor", "-rough"].map(async (suffix) => {
      const file = path.join(out, `${id}${suffix}.webp`);
      return (await exists(file)) ? (await readFile(file)).length : 0;
    }),
  ),
);
console.log(`listo: ${Math.round(sizes.reduce((a, b) => a + b, 0) / 1024)} KB en public/tex/`);
