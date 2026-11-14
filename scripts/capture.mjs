/**
 * Saca del configurador las imágenes del sitio: el mueble del hero, las de
 * "cada cambio se ve al instante", la tarjeta de cada familia con demo, la
 * orden de ejemplo y la imagen para compartir en redes.
 *
 * Son capturas del 3D de verdad, no ilustraciones. Hay que volver a correrlo
 * cuando cambian los materiales o el motor.
 *
 *   npm run build && npx serve out -l 4100      (en otra terminal)
 *   node --experimental-strip-types scripts/capture.mjs [http://localhost:4100] [solo-este-nombre]
 *
 * Necesita Playwright con Chromium y sharp. No son dependencias del proyecto:
 * el sitio no los usa para compilar ni para publicarse.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_CONFIG, normalize } from "../src/lib/model.ts";
import { HERO_FRAMING, HERO_SOFA, HERO_SOFA_FRAMING, HERO_SOFA_FRAMING_PORTRAIT } from "../src/lib/presets.ts";
import { encodeConfig } from "../src/lib/share.ts";

const require = createRequire(import.meta.url);
const load = (name) => {
  try {
    return require(name);
  } catch {
    return createRequire("/")(name);
  }
};
const { chromium } = load("playwright");
const sharp = load("sharp");

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, "public/img");
const base = (process.argv[2] ?? "http://localhost:4100").replace(/\/+$/, "");
// una o más fotos por nombre: node scripts/capture.mjs <url> familia-tv familia-camas
const names = process.argv.slice(3);
const only = names.length ? names : null;

const cfg = (patch) => encodeConfig(normalize({ ...DEFAULT_CONFIG, ...patch }));
const mod = (layout, extra = {}) => ({ layout, shelves: 0, drawers: 0, width: 0, ledShelves: true, ledSides: false, ...extra });
const run = (width, modules) => [{ width, modules }];
const FONDO = `f6f1ea&encuadre=${HERO_FRAMING}`;
/** la portada: el sillón curvo, en el showroom, calculado con trazado de rayos */
const SOFA = `f=sillones&c=${Buffer.from(JSON.stringify(HERO_SOFA)).toString("base64url")}&ambiente=habitacion&deco=0`;
/** muestras por píxel de las fotos calculadas: sin placa de video tarda, pero sale limpia */
const PHOTO = (samples) => `&foto=1&muestras=${samples}&px=4000000`;

/** las tarjetas de cada familia: foto calculada, al tamaño en que se muestran */
const FAMILY = { size: [900, 675], width: 900, photo: true };

/** cada imagen: de dónde sale, a qué tamaño se dibuja y a qué ancho se guarda */
const SHOTS = [
  { name: "hero", query: `${SOFA}&encuadre=${HERO_SOFA_FRAMING}${PHOTO(150)}`, size: [1400, 700], width: 1400, photo: true },
  { name: "hero-movil", query: `${SOFA}&encuadre=${HERO_SOFA_FRAMING_PORTRAIT}${PHOTO(130)}`, size: [700, 875], width: 700, photo: true },
  {
    name: "exp-dimensiones",
    query: `c=${cfg({ runs: run(3400, [mod("hanging"), mod("drawers-shelves", { shelves: 3, drawers: 3 }), mod("double-hanging"), mod("shelves", { shelves: 4 })]) })}&fondo=${FONDO}`,
  },
  {
    name: "exp-materiales",
    query: `c=${cfg({ doorStyle: "grooved", doorMaterial: "nogal", bodyMaterial: "arena", handle: "none" })}&fondo=${FONDO}`,
  },
  { name: "exp-colores", query: `c=${cfg({ bodyMaterial: "grafito", doorMaterial: "salvia", handle: "knob" })}&fondo=${FONDO}` },
  { name: "exp-modulos", query: `c=${cfg({ bodyMaterial: "blanco", doorMaterial: "arena" })}&fondo=${FONDO}&abierto=1`, settle: 30_000 },
  {
    name: "exp-iluminacion",
    query: `c=${cfg({ doors: "none", bodyMaterial: "nogal", runs: run(2600, [mod("hanging", { ledSides: true }), mod("drawers-shelves", { shelves: 3, drawers: 3, ledSides: true }), mod("double-hanging", { ledSides: true })]) })}&fondo=${FONDO}&luces=1&v=front`,
    settle: 20_000,
  },
  {
    name: "familia-placares",
    query: `c=${cfg({ shape: "l-left", runs: [{ width: 2800, modules: [mod("shelves", { shelves: 4 }), mod("drawers-hanging", { drawers: 3 }), mod("double-hanging")] }, { width: 2000, modules: [mod("hanging"), mod("shelves", { shelves: 4 })] }], doorMaterial: "roble" })}&ambiente=habitacion&abierto=1&luces=1&encuadre=0.82&pared=arena${PHOTO(260)}`,
    settle: 34_000,
    ...FAMILY,
  },
  // las otras familias, cada una en el estudio, calculadas con trazado de rayos
  { name: "familia-mesas", query: `f=mesas&ambiente=habitacion&encuadre=0.82&pared=tiza${PHOTO(90)}`, settle: 14_000, ...FAMILY },
  { name: "familia-ratonas", query: `f=ratonas&ambiente=habitacion&encuadre=0.85&pared=arena${PHOTO(90)}`, settle: 14_000, ...FAMILY },
  { name: "familia-tv", query: `f=tv&ambiente=habitacion&encuadre=0.7&pared=arena&luces=1${PHOTO(90)}`, settle: 18_000, ...FAMILY },
  { name: "familia-bibliotecas", query: `f=bibliotecas&ambiente=habitacion&encuadre=0.8&pared=tiza${PHOTO(90)}`, settle: 14_000, ...FAMILY },
  { name: "familia-camas", query: `f=camas&ambiente=habitacion&encuadre=0.8&pared=arena&luces=1${PHOTO(90)}`, settle: 16_000, ...FAMILY },
  { name: "familia-sillones", query: `f=sillones&ambiente=habitacion&encuadre=0.75&pared=tiza&deco=0${PHOTO(90)}`, settle: 14_000, ...FAMILY },
];

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

/**
 * Abre la vista limpia, espera a que todo llegue a su lugar en calidad liviana,
 * pide calidad alta para los cuadros finales y la deja quieta antes de sacar
 * la captura. Sin placa de video un cuadro en calidad alta tarda varios
 * segundos: por eso la espera larga.
 */
async function grab(url, [w, h], settle, photo) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => (window.__medidaFrames ?? 0) > 2, null, { timeout: 120_000 });
  await page.waitForTimeout(settle);
  const before = await page.evaluate(() => {
    window.__medidaRender.setQuality("alta");
    return window.__medidaFrames;
  });
  await page.waitForFunction((n) => window.__medidaFrames >= n + 4, before, { timeout: 600_000, polling: 500 });
  // con trazado de rayos: hasta que la foto termine de calcularse, y se lee del lienzo
  // en el mismo cuadro en que se dibuja (una captura de pantalla puede vencerse
  // mientras la placa por software sigue ocupada)
  if (photo) {
    await page.waitForFunction(() => window.__medidaPhoto?.state === "done", null, { timeout: 4 * 3600_000, polling: 5000 });
    const url = await page.evaluate(() => window.__medidaRender.capture());
    await page.close();
    if (!url) throw new Error("el 3D no devolvió la imagen");
    return Buffer.from(url.split(",")[1], "base64");
  }
  await page.evaluate(() => window.__medidaRender.pause());
  await page.waitForTimeout(1500);
  const png = await page.screenshot({ type: "png", timeout: 120_000 });
  await page.close();
  return png;
}

/**
 * El trazado de rayos deja a veces un píxel suelto, muy claro o muy oscuro. Se
 * reemplaza por la mediana de sus vecinos solo donde se sale mucho de ella: la
 * trama de las telas queda intacta.
 */
async function despeckle(png) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const med = await sharp(png).removeAlpha().median(3).raw().toBuffer();
  for (let i = 0; i < data.length; i += 3) {
    const diff = Math.abs(data[i] - med[i]) + Math.abs(data[i + 1] - med[i + 1]) + Math.abs(data[i + 2] - med[i + 2]);
    if (diff > 90) {
      data[i] = med[i];
      data[i + 1] = med[i + 1];
      data[i + 2] = med[i + 2];
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } }).png().toBuffer();
}

for (const shot of SHOTS) {
  if (only && !only.includes(shot.name)) continue;
  const size = shot.size ?? [1400, 1050];
  const started = Date.now();
  const raw = await grab(`${base}/render/?${shot.query}`, size, shot.settle ?? 12_000, shot.photo);
  const png = shot.photo ? await despeckle(raw) : raw;
  await sharp(png).resize({ width: shot.width ?? 1400 }).webp({ quality: 82 }).toFile(path.join(out, `${shot.name}.webp`));
  console.log(`${shot.name}.webp  ${Math.round((Date.now() - started) / 1000)} s`);
}

// la orden de ejemplo: la vista del taller tal cual, recortada arriba
if (!only || only.includes("orden")) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1050 }, deviceScaleFactor: 1 });
  await page.goto(`${base}/demo/taller/`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "[aria-label='Aviso de cookies']{display:none!important}" });
  await page.waitForTimeout(800);
  const png = await page.screenshot({ type: "png" });
  await page.close();
  await sharp(png).webp({ quality: 84 }).toFile(path.join(out, "orden.webp"));
  console.log("orden.webp");
}

// imagen para compartir en redes (1200 × 630) e íconos, armados sobre la captura del hero
if (!only || only.includes("og")) {
  // el mueble va a la derecha y el texto a la izquierda, sobre el beige del sitio
  const hero = await sharp(path.join(out, "hero.webp")).resize({ width: 1260, height: 630, fit: "cover", position: "centre" }).toBuffer();
  const canvas = await sharp({ create: { width: 1200, height: 630, channels: 3, background: "#ece5d8" } })
    .composite([{ input: await sharp(hero).extract({ left: 0, top: 0, width: 900, height: 630 }).toBuffer(), left: 300, top: 0 }])
    .png()
    .toBuffer();
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#ece5d8"/><stop offset="0.4" stop-color="#ece5d8"/><stop offset="0.62" stop-color="#ece5d8" stop-opacity="0"/></linearGradient></defs>
    <rect width="1200" height="630" fill="url(#g)"/>
    <g stroke="#14213d" stroke-width="5" stroke-linecap="round" fill="none"><path d="M72 76v30M140 76v30M72 91h68"/></g>
    <text x="160" y="103" font-family="Liberation Serif, Times New Roman, serif" font-size="32" letter-spacing="8" fill="#14213d">MEDIDA</text>
    <text x="72" y="300" font-family="Liberation Serif, Times New Roman, serif" font-size="56" letter-spacing="1" fill="#14213d">TUS PRODUCTOS.</text>
    <text x="72" y="364" font-family="Liberation Serif, Times New Roman, serif" font-size="56" letter-spacing="1" fill="#14213d">INFINITAS</text>
    <text x="72" y="428" font-family="Liberation Serif, Times New Roman, serif" font-size="56" letter-spacing="1" fill="#14213d">CONFIGURACIONES.</text>
    <text x="72" y="502" font-family="Helvetica, Arial, sans-serif" font-size="24" fill="#4a5369">Configuradores 3D para productos a medida</text>
  </svg>`);
  await sharp(canvas).composite([{ input: overlay }]).jpeg({ quality: 86, mozjpeg: true }).toFile(path.join(root, "public/og.jpg"));

  const icon = (size) =>
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
      <rect width="64" height="64" fill="#14213d"/>
      <path d="M14 20v24M50 20v24M14 32h36" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none"/>
    </svg>`);
  for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512]]) await sharp(icon(size)).png().toFile(path.join(root, "public", name));
  await sharp(icon(180)).png().toFile(path.join(root, "src/app/apple-icon.png"));
  await writeFile(
    path.join(root, "src/app/icon.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#14213d"/><path d="M14 20v24M50 20v24M14 32h36" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none"/></svg>\n`,
  );
  console.log("og.jpg, íconos");
}

await browser.close();
