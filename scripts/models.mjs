/**
 * Los objetos de ambientación del 3D (jarrones, libros, plantas, almohadones):
 * modelos escaneados o hechos por artistas de Poly Haven, con licencia CC0. Los
 * baja en su versión glTF de 1k, los optimiza para la web (texturas WebP de
 * 512 px y geometría comprimida con meshopt) y los deja en public/models/.
 * Escribe además src/lib/decor-models.ts con la medida real de cada uno (en
 * mm), para que el motor los acomode sin estirarlos.
 *
 *   npm run models [carpeta-de-descargas]
 *
 * Necesita salida a api.polyhaven.com, dl.polyhaven.org y al registro de npm
 * (usa @gltf-transform/cli con npx).
 */
import { execFileSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, "public/models");
const cache = path.resolve(process.argv[2] ?? path.join(tmpdir(), "medida-models"));

/** qué se baja y con qué nombre queda */
const MODELS = [
  { id: "jarron", slug: "ceramic_vase_01" },
  { id: "jarron-alto", slug: "ceramic_vase_03" },
  { id: "jarron-antiguo", slug: "antique_ceramic_vase_01" },
  { id: "jarron-bronce", slug: "brass_vase_04" },
  { id: "libros", slug: "book_encyclopedia_set_01" },
  { id: "planta", slug: "potted_plant_02" },
  { id: "suculenta", slug: "potted_plant_04" },
  { id: "almohadones", slug: "throw_pillows_01" },
  { id: "cuenco", slug: "wooden_bowl_01" },
  { id: "portarretrato", slug: "standing_picture_frame_01" },
  { id: "lampara-colgante", slug: "modern_ceiling_lamp_01" },
];

const exists = (file) =>
  stat(file).then(
    () => true,
    () => false,
  );

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "user-agent": "medida-models" } });
  if (!res.ok) throw new Error(`${url} respondió ${res.status}`);
  return res.json();
}

async function download(url, file) {
  if (await exists(file)) return;
  const res = await fetch(url, { headers: { "user-agent": "medida-models" } });
  if (!res.ok) throw new Error(`${url} respondió ${res.status}`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
}

/** la caja que ocupa un glTF, leyendo el mínimo y el máximo de las posiciones de cada malla */
async function bounds(gltfFile) {
  const gltf = JSON.parse(await readFile(gltfFile, "utf8"));
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  // las matrices de los nodos: cada malla puede estar movida, girada o escalada
  const mul = (a, b) => {
    const r = new Array(16).fill(0);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) r[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k];
    return r;
  };
  const local = (n) => {
    if (n.matrix) return n.matrix;
    const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1];
    const [sx, sy, sz] = n.scale ?? [1, 1, 1];
    const [tx, ty, tz] = n.translation ?? [0, 0, 0];
    return [
      (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
      2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
      2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
      tx, ty, tz, 1,
    ];
  };
  const visit = (index, parent) => {
    const n = gltf.nodes[index];
    const m = mul(parent, local(n));
    if (n.mesh !== undefined) {
      for (const prim of gltf.meshes[n.mesh].primitives) {
        const acc = gltf.accessors[prim.attributes.POSITION];
        for (const cx of [acc.min[0], acc.max[0]])
          for (const cy of [acc.min[1], acc.max[1]])
            for (const cz of [acc.min[2], acc.max[2]]) {
              const p = [0, 1, 2].map((k) => m[k] * cx + m[4 + k] * cy + m[8 + k] * cz + m[12 + k]);
              for (let k = 0; k < 3; k++) {
                min[k] = Math.min(min[k], p[k]);
                max[k] = Math.max(max[k], p[k]);
              }
            }
      }
    }
    for (const c of n.children ?? []) visit(c, m);
  };
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const n of gltf.scenes[gltf.scene ?? 0].nodes) visit(n, identity);
  return max.map((v, k) => Math.round((v - min[k]) * 1000));
}

await mkdir(out, { recursive: true });
const sizes = {};
const credits = [];
for (const m of MODELS) {
  const [files, info] = await Promise.all([fetchJson(`https://api.polyhaven.com/files/${m.slug}`), fetchJson(`https://api.polyhaven.com/info/${m.slug}`)]);
  const g = files.gltf?.["1k"]?.gltf;
  if (!g) throw new Error(`${m.slug} no tiene glTF de 1k`);
  const dir = path.join(cache, m.slug);
  const gltfFile = path.join(dir, "model.gltf");
  await download(g.url, gltfFile);
  for (const [rel, f] of Object.entries(g.include ?? {})) await download(f.url, path.join(dir, rel));
  sizes[m.id] = await bounds(gltfFile);
  const glb = path.join(out, `${m.id}.glb`);
  execFileSync("npx", ["--yes", "@gltf-transform/cli@4", "optimize", gltfFile, glb, "--compress", "meshopt", "--texture-compress", "webp", "--texture-size", "512"], { stdio: "ignore" });
  const kb = Math.round((await stat(glb)).size / 1024);
  credits.push(`| ${m.id} | [${info.name}](https://polyhaven.com/a/${m.slug}) | ${Object.keys(info.authors ?? {}).join(", ")} |`);
  console.log(`${m.id}: ${sizes[m.id].join(" × ")} mm, ${kb} KB`);
}

await writeFile(
  path.join(root, "src/lib/decor-models.ts"),
  `/**
 * Medida real (ancho, alto, profundidad, en mm) de cada objeto de ambientación
 * de public/models/. Lo escribe scripts/models.mjs: no editar a mano.
 */
export const DECOR_MODELS = ${JSON.stringify(sizes, null, 2)} as const;

export type DecorModel = keyof typeof DECOR_MODELS;
`,
);
await writeFile(
  path.join(out, "CREDITOS.md"),
  ["# Objetos de ambientación", "", "Todos son de [Poly Haven](https://polyhaven.com), con licencia CC0 (dominio público).", "Los prepara `scripts/models.mjs`.", "", "| Archivo | Modelo | Autor |", "| --- | --- | --- |", ...credits, ""].join("\n"),
);
console.log("listo");
