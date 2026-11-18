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
 * y dl.polyhaven.org. Usa las cuentas de src/lib (por eso corre con
 * --experimental-strip-types, como las pruebas).
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { leafLayout, plankLayout, streaks } from "../src/lib/texture-layout.ts";
import { retone } from "../src/lib/tone.ts";

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
 * - veneer: una chapa. La foto cubre 1 m y repetida se nota; se arma una placa
 *   de 2 m con hojas sacadas de distintos lugares de la foto, cada una de un
 *   tono apenas distinto, y un veteado ancho encima (ver texture-layout.ts).
 *   El relieve queda como vino, a su metro: ahí la repetición no se ve.
 * - planks: un piso de tablas. Se arma uno del doble de ancho y de largo con
 *   las tablas de la foto barajadas, dadas vuelta y con las juntas trabadas.
 * - color: la foto entera.
 * - detail: la foto en gris, para dar grano a un color que elige el cliente
 * - relief: solo el relieve (mapa de normales y de rugosidad)
 * - shade: el relieve, más una trama en gris calculada con ese relieve (para
 *   telas cuya foto trae un dibujo que no queremos, como el bouclé a cuadros)
 *
 * `tone` lleva la foto a su color final (el promedio pasa a `color`; la veta
 * se conserva, con su contraste y su color multiplicados): el 3D la usa como
 * viene, sin teñirla. `turn` gira la foto un cuarto de vuelta: la veta de una
 * chapa tiene que quedar a lo alto de la imagen y las tablas de un piso,
 * acostadas.
 */
const SETS = [
  // nogal: chapa de veta derecha con sus vetas oscuras; marrón apagado, no anaranjado
  { id: "nogal", slug: "black_walnut_veneer_01", use: "veneer", turn: true, seed: 11, leaves: [0.12, 0.26], leafTone: 0.05, streak: 0.07, tone: { color: "#7a5c46", contrast: 1.25, saturation: 0.8 } },
  // roble: corte al cuarto, veta fina y pareja; el tono de un roble natural sin teñir
  { id: "roble", slug: "oak_veneer_04", use: "veneer", turn: true, seed: 23, leaves: [0.11, 0.24], leafTone: 0.02, streak: 0.035, tone: { color: "#c9a67e", contrast: 1.5, saturation: 0.85 } },
  // roble claro en tablas anchas, al aceite: el piso acompaña, el protagonista es el mueble
  { id: "piso-madera", slug: "laminate_floor_02", use: "planks", rows: 8, seed: 5, plankTone: 0.045, lay: "v", tone: { color: "#c5ab88", contrast: 1.05, saturation: 0.8 } },
  // pinotea plastificada: tablas angostas y largas (la foto, a la mitad de ancho), rojiza
  { id: "piso-pinotea", slug: "wood_floor", use: "planks", turn: true, rows: 9, seed: 17, plankTone: 0.05, lay: "v", scale: [0.5, 1], tone: { color: "#a8744a", contrast: 0.8, saturation: 0.75 } },
  // cemento alisado claro, como el de una galería
  { id: "piso-cemento", slug: "concrete_floor_worn_001", use: "color", tone: { color: "#cfcbc4", contrast: 1, saturation: 1 } },
  { id: "piso-baldosa", slug: "floor_tiles_08", use: "color", tone: { color: "#d3c6b1", contrast: 0.8, saturation: 0.8 } },
  { id: "pared", slug: "beige_wall_001", use: "relief" },
  // las telas: `contrast` es cuánto se marca la trama sobre el color (desvío, de 0 a 255). Un
  // tapizado a la distancia de un catálogo es casi liso: la trama se adivina, no se cuenta
  { id: "tela-lino", slug: "rough_linen", use: "detail", contrast: 12 },
  { id: "tela-pana", slug: "velour_velvet", use: "detail", contrast: 9 },
  // bouclé de rulo cerrado, del que se usa en tapicería
  { id: "tela-boucle", slug: "curly_teddy_natural", use: "detail", contrast: 16 },
  { id: "tela-lana", slug: "poly_wool_herringbone", use: "detail", contrast: 30 },
  { id: "tela-cuero", slug: "brown_leather", use: "detail", contrast: 13 },
  { id: "piedra", slug: "marble_01", use: "color" },
];

/** lado de la foto de origen y de la textura armada, en píxeles */
const SOURCE = 1024;
const BUILT = 2048;

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

/** la trama en gris de las telas: promedio claro, en 0–255 */
const DETAIL_MEAN = 205;

/** lleva unos valores a gris con ese promedio y el contraste pedido (desvío) */
function normalized(values, contrast) {
  let sum = 0;
  for (const v of values) sum += v;
  const mean = sum / values.length;
  let varSum = 0;
  for (const v of values) varSum += (v - mean) ** 2;
  const k = contrast / Math.max(1e-3, Math.sqrt(varSum / values.length));
  const out = Buffer.alloc(values.length);
  for (let i = 0; i < values.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(DETAIL_MEAN + (values[i] - mean) * k)));
  return out;
}

/** una foto en memoria: tres canales por píxel */
async function raw(file, size) {
  const { data, info } = await sharp(file).resize(size, size, { fit: "fill" }).removeAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) {
    // un mapa en gris: se lleva a tres canales para tratar todo igual
    const rgb = Buffer.alloc(info.width * info.height * 3);
    for (let i = 0; i < info.width * info.height; i++) rgb[i * 3] = rgb[i * 3 + 1] = rgb[i * 3 + 2] = data[i * info.channels];
    return { data: rgb, size: info.width };
  }
  return { data, size: info.width };
}

const hex = (color) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));

/** el promedio de una imagen de tres canales */
function average(data) {
  const sum = [0, 0, 0];
  for (let i = 0; i < data.length; i += 3) for (let k = 0; k < 3; k++) sum[k] += data[i + k];
  return sum.map((v) => v / (data.length / 3));
}

/** lleva una imagen de tres canales a su tono final (la cuenta es la de src/lib/tone.ts, que va de a cuatro) */
function toned(data, tone) {
  const rgba = new Uint8ClampedArray((data.length / 3) * 4);
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    rgba[j] = data[i];
    rgba[j + 1] = data[i + 1];
    rgba[j + 2] = data[i + 2];
  }
  retone(rgba, average(data), hex(tone.color), tone.contrast, tone.saturation);
  const outRgb = Buffer.alloc(data.length);
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    outRgb[i] = rgba[j];
    outRgb[i + 1] = rgba[j + 1];
    outRgb[i + 2] = rgba[j + 2];
  }
  return outRgb;
}

/**
 * Un cuarto de vuelta, en el sentido del reloj. En un mapa de normales además
 * hay que girar lo que cada píxel dice: la pendiente que miraba a la derecha
 * ahora mira para abajo.
 */
function turned(img, normal) {
  const n = img.size;
  const data = Buffer.alloc(img.data.length);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const from = (y * n + x) * 3;
      const to = (x * n + (n - 1 - y)) * 3;
      if (normal) {
        data[to] = img.data[from + 1];
        data[to + 1] = 255 - img.data[from];
        data[to + 2] = img.data[from + 2];
      } else {
        data[to] = img.data[from];
        data[to + 1] = img.data[from + 1];
        data[to + 2] = img.data[from + 2];
      }
    }
  return { data, size: n };
}

/**
 * Un mapa de normales a partir de los claros y oscuros de una foto que empalma
 * consigo misma: lo oscuro (el poro, la veta) queda hundido. Solo el detalle
 * fino: las manchas grandes de tono no son relieve.
 */
function reliefFrom(photo, strength) {
  const n = photo.size;
  const grey = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) grey[i] = (photo.data[i * 3] * 0.299 + photo.data[i * 3 + 1] * 0.587 + photo.data[i * 3 + 2] * 0.114) / 255;
  // se le resta su propio promedio de los alrededores (a 8 px): queda lo fino
  const blur = (src, horizontal) => {
    const dst = new Float32Array(n * n);
    const r = 8;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        let sum = 0;
        for (let d = -r; d <= r; d++) sum += horizontal ? src[y * n + ((x + d + n) % n)] : src[((y + d + n) % n) * n + x];
        dst[y * n + x] = sum / (2 * r + 1);
      }
    return dst;
  };
  const soft = blur(blur(grey, true), false);
  // y apenas suavizado (3 px): sin el ruido de la foto, que no es relieve y pesa al comprimir
  const fine = (src) => src.map((_, i) => {
    const x = i % n;
    const y = (i - x) / n;
    let sum = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += src[((y + dy + n) % n) * n + ((x + dx + n) % n)];
    return sum / 9;
  });
  const h = fine(grey.map((v, i) => v - soft[i]));
  const data = Buffer.alloc(n * n * 3);
  const at = (x, y) => h[((y + n) % n) * n + ((x + n) % n)];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 10 * strength;
      // la imagen crece hacia abajo y el mapa (OpenGL) mide hacia arriba
      const dy = (at(x, y - 1) - at(x, y + 1)) * 10 * strength;
      const len = Math.hypot(dx, dy, 1);
      const to = (y * n + x) * 3;
      data[to] = Math.round(127.5 - (dx / len) * 127.5);
      data[to + 1] = Math.round(127.5 - (dy / len) * 127.5);
      data[to + 2] = Math.round(127.5 + (1 / len) * 127.5);
    }
  return { data, size: n };
}

const webp = (img, size, quality) => sharp(img.data, { raw: { width: img.size, height: img.size, channels: 3 } }).resize(size, size).webp({ quality, effort: 6 });

/**
 * Hace que una imagen empalme consigo misma a lo alto (y a lo ancho con
 * `both`): cerca de cada borde se funde con ella misma corrida media imagen,
 * que ahí es continua. La foto de una chapa no cierra del todo de una punta a
 * la otra, y esa diferencia era una raya fina a media puerta. `normal`: es un
 * mapa de normales y hay que volver a llevarlo a largo uno.
 */
function seamless(img, both = false, normal = false) {
  const n = img.size;
  const band = Math.round(n / 10);
  const pass = (src, vertical) => {
    const out = Buffer.from(src);
    const half = n >> 1;
    for (let a = 0; a < n; a++) {
      const edge = Math.min(a, n - 1 - a);
      if (edge >= band) continue;
      // 1 en el borde, 0 al terminar la franja, con entrada y salida suaves
      const t = 1 - edge / band;
      const m = t * t * (3 - 2 * t);
      const shifted = (a + half) % n;
      for (let b = 0; b < n; b++) {
        const to = (vertical ? a * n + b : b * n + a) * 3;
        const from = (vertical ? shifted * n + b : b * n + shifted) * 3;
        for (let k = 0; k < 3; k++) out[to + k] = Math.round(src[to + k] * (1 - m) + src[from + k] * m);
      }
    }
    return out;
  };
  let data = pass(img.data, true);
  if (both) data = pass(data, false);
  if (normal)
    for (let i = 0; i < n * n; i++) {
      const v = [0, 1, 2].map((k) => (data[i * 3 + k] / 255) * 2 - 1);
      const l = Math.hypot(v[0], v[1], v[2]) || 1;
      for (let k = 0; k < 3; k++) data[i * 3 + k] = Math.round(((v[k] / l) * 0.5 + 0.5) * 255);
    }
  return { data, size: n };
}

/**
 * La placa enchapada: hojas de la foto una al lado de la otra, con la veta a
 * lo alto. A lo largo la foto corre de seguido, cada hoja desde otro punto: la
 * foto empalma consigo misma, así que la placa también.
 */
function veneerSheet(photo, set) {
  const n = photo.size;
  const size = n * 2;
  const leaves = leafLayout(size, n, { seed: set.seed, min: Math.round(set.leaves[0] * n), max: Math.round(set.leaves[1] * n), tone: set.leafTone });
  const bands = streaks(size, { seed: set.seed + 1, strength: set.streak });
  const data = Buffer.alloc(size * size * 3);
  for (const leaf of leaves)
    for (let x = leaf.from; x < leaf.to; x++) {
      const across = (leaf.across + x - leaf.from) % n;
      const sx = leaf.mirror ? n - 1 - across : across;
      for (let y = 0; y < size; y++) {
        // de corrido y no de ida y vuelta: donde la foto pegaba la vuelta, cada hoja quedaba
        // espejada sobre sí misma y en una puerta alta se veía la raya (la foto empalma sola)
        const sy = (y + leaf.along) % n;
        // el veteado ancho no baja derecho como una regla: ondula apenas a lo largo
        const sway = Math.round(5 * Math.sin((2 * Math.PI * y) / size + leaf.along) + 3 * Math.sin((6 * Math.PI * y) / size));
        const gain = leaf.gain * bands[(x + sway + size) % size];
        const from = (sy * n + sx) * 3;
        const to = (y * size + x) * 3;
        for (let k = 0; k < 3; k++) data[to + k] = Math.max(0, Math.min(255, Math.round(photo.data[from + k] * gain)));
      }
    }
  return { data, size };
}

/** dónde está la primera junta entre hileras de tablas (la línea más oscura que se repite cada `step`) */
function firstSeam(grey, n, step) {
  const rows = new Float64Array(n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) rows[y] += grey[y * n + x];
  let best = 0;
  let low = Infinity;
  for (let o = 0; o < step; o++) {
    let sum = 0;
    for (let y = o; y < n; y += step) sum += rows[y];
    if (sum < low) {
      low = sum;
      best = o;
    }
  }
  return best;
}

/** dónde corta la tabla de una hilera: la columna más oscura respecto de sus vecinas */
function buttJoint(grey, n, top, step) {
  const cols = new Float64Array(n);
  for (let y = top + 8; y < top + step - 8; y++) for (let x = 0; x < n; x++) cols[x] += grey[(y % n) * n + x];
  let best = 0;
  let depth = -Infinity;
  for (let x = 0; x < n; x++) {
    const d = (cols[(x - 6 + n) % n] + cols[(x + 6) % n]) / 2 - cols[x];
    if (d > depth) {
      depth = d;
      best = x;
    }
  }
  return best;
}

/**
 * El piso armado: el doble de hileras, dos tablas por hilera. Devuelve una
 * función que arma con el mismo dibujo cualquiera de los mapas (color,
 * relieve, rugosidad), para que coincidan.
 */
function plankFloor(photo, set) {
  const n = photo.size;
  const step = n / set.rows;
  const grey = new Float64Array(n * n);
  for (let i = 0; i < n * n; i++) grey[i] = photo.data[i * 3] * 0.299 + photo.data[i * 3 + 1] * 0.587 + photo.data[i * 3 + 2] * 0.114;
  const first = firstSeam(grey, n, step);
  // la tabla arranca en el medio de su junta: así cada punta se queda con media línea oscura
  const joints = Array.from({ length: set.rows }, (_, r) => buttJoint(grey, n, first + r * step, step) + 1);
  const layout = plankLayout(set.rows, { seed: set.seed, tone: set.plankTone });
  const size = n * 2;
  return (img, kind) => {
    const data = Buffer.alloc(size * size * 3);
    layout.forEach((row, r) => {
      const start = Math.round(row.joint * n);
      for (let x = 0; x < size; x++) {
        const t = (x - start + size) % size;
        const plank = row.planks[t < n ? 0 : 1];
        const along = t % n;
        const sx = (joints[plank.source] + (plank.flipLength ? n - 1 - along : along)) % n;
        for (let yy = 0; yy < step; yy++) {
          const sy = (first + plank.source * step + (plank.flipWidth ? step - 1 - yy : yy)) % n;
          const from = (sy * n + sx) * 3;
          const to = ((r * step + yy) * size + x) * 3;
          if (kind === "color") for (let k = 0; k < 3; k++) data[to + k] = Math.max(0, Math.min(255, Math.round(img.data[from + k] * plank.gain)));
          else {
            // una tabla dada vuelta también da vuelta su relieve
            data[to] = kind === "normal" && plank.flipLength ? 255 - img.data[from] : img.data[from];
            data[to + 1] = kind === "normal" && plank.flipWidth ? 255 - img.data[from + 1] : img.data[from + 1];
            data[to + 2] = img.data[from + 2];
          }
        }
      }
    });
    return { data, size };
  };
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

  // tamaño real que cubre la foto, en metros
  const real = [info.dimensions[0] / 1000, info.dimensions[1] / 1000];
  const entry = { size: real, maps: [] };
  const file = (suffix) => path.join(out, `${set.id}${suffix}.webp`);

  if (set.use === "veneer" && src.diff) {
    const photo = await raw(src.diff, SOURCE);
    const sheet = veneerSheet(set.turn ? turned(photo, false) : photo, set);
    await webp(seamless({ data: toned(sheet.data, set.tone), size: sheet.size }), BUILT, 80).toFile(file(""));
    // la placa armada cubre el doble que la foto; el relieve sigue a la medida de la foto
    entry.size = [real[0] * 2, real[1] * 2];
    entry.relief = real;
    entry.average = hex(set.tone.color);
    entry.maps.push("color");
    // el relieve sale de la foto misma: el poro y la veta oscura van hundidos, como en una
    // chapa de verdad o en una melamina de poro sincronizado. (El mapa de normales que trae
    // la foto es casi plano: comprimido para la web no queda nada.)
    await webp(seamless(reliefFrom(set.turn ? turned(photo, false) : photo, set.pore ?? 1), true, true), SOURCE, 72).toFile(file("-nor"));
    entry.maps.push("normal");
    if (src.rough) {
      const rough = await raw(src.rough, 512);
      await webp(seamless(set.turn ? turned(rough, false) : rough, true), 512, 78).toFile(file("-rough"));
      entry.maps.push("roughness");
    }
  }
  if (set.use === "planks" && src.diff) {
    // la foto se lleva a un lado que entre justo en hileras de píxeles enteros
    const side = set.rows * Math.ceil(SOURCE / set.rows);
    const prepared = async (source, normal) => {
      const img = await raw(source, side);
      return set.turn ? turned(img, normal) : img;
    };
    // las tablas quedan acostadas; `lay: "v"` las deja a lo alto de la textura (en el piso, hacia el fondo)
    const laid = (img, normal) => (set.lay === "v" ? turned(img, normal) : img);
    const photo = await prepared(src.diff, false);
    const build = plankFloor(photo, set);
    const floor = build(photo, "color");
    await webp(laid({ data: toned(floor.data, set.tone), size: floor.size }, false), BUILT, 76).toFile(file(""));
    // a lo largo de la tabla y a lo ancho: una pinotea es la misma foto con las tablas más angostas
    const [across, along] = set.scale ?? [1, 1];
    const covered = [real[0] * 2 * along, real[1] * 2 * across];
    entry.size = set.lay === "v" ? [covered[1], covered[0]] : covered;
    entry.average = hex(set.tone.color);
    entry.maps.push("color");
    if (src.nor) {
      await webp(laid(build(await prepared(src.nor, true), "normal"), true), SOURCE, 86).toFile(file("-nor"));
      entry.maps.push("normal");
    }
    if (src.rough) {
      await webp(laid(build(await prepared(src.rough, false), "rough"), false), 512, 78).toFile(file("-rough"));
      entry.maps.push("roughness");
    }
  }
  if (set.use === "color" && src.diff) {
    const photo = await raw(src.diff, SOURCE);
    if (set.tone) {
      await webp({ data: toned(photo.data, set.tone), size: photo.size }, SOURCE, 82).toFile(file(""));
      entry.average = hex(set.tone.color);
    } else {
      await webp(photo, SOURCE, 82).toFile(file(""));
      entry.average = average(photo.data).map(Math.round);
    }
    entry.maps.push("color");
  }
  if (set.use === "detail" && src.diff) {
    // en gris, con un promedio claro y el contraste de cada tela: multiplica el color
    // elegido sin oscurecerlo
    const { data, info } = await sharp(src.diff).resize(512).toColourspace("b-w").raw().toBuffer({ resolveWithObject: true });
    await sharp(normalized(Float32Array.from(data), set.contrast), { raw: { width: info.width, height: info.height, channels: 1 } })
      .webp({ quality: 82 })
      .toFile(file(""));
    entry.maps.push("color");
  }
  if (set.use === "shade" && src.nor) {
    // la trama sale del relieve: cuánta luz recibe cada rulo con luz de arriba a la izquierda
    const { data, info } = await sharp(src.nor).resize(512).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const l = [-0.45, 0.5, 0.74];
    const values = new Float32Array(info.width * info.height);
    for (let i = 0; i < values.length; i++) {
      const n = [data[i * 3] / 127.5 - 1, data[i * 3 + 1] / 127.5 - 1, data[i * 3 + 2] / 127.5 - 1];
      values[i] = Math.max(0, n[0] * l[0] + n[1] * l[1] + n[2] * l[2]);
    }
    await sharp(normalized(values, set.contrast), { raw: { width: info.width, height: info.height, channels: 1 } }).webp({ quality: 82 }).toFile(file(""));
    entry.maps.push("color");
  }
  if (set.use !== "veneer" && set.use !== "planks") {
    if (src.nor) {
      await sharp(src.nor).resize(set.use === "color" ? 1024 : 512).webp({ quality: 86 }).toFile(file("-nor"));
      entry.maps.push("normal");
    }
    if (src.rough) {
      await sharp(src.rough).resize(set.use === "color" ? 512 : 256).grayscale().webp({ quality: 78 }).toFile(file("-rough"));
      entry.maps.push("roughness");
    }
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
