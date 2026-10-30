/**
 * PDF de la orden para el taller, armado en el navegador.
 *
 * Cada hoja se dibuja en un canvas (tapa, piezas con su dibujo, herrajes) y se
 * mete como JPEG en un PDF mínimo escrito a mano. No hace falta servidor ni
 * librería, y WhatsApp lo manda como documento, sin comprimirlo.
 */

import { catalog } from "./catalog.ts";
import { product } from "./product.ts";
import { INK, fitDrawing, pieceDrawing, type Drawing } from "./drawings.ts";
import { DOOR_STYLE_LABELS, LED_COLORS, hasLeds, totalHeight, type WardrobeConfig } from "./model.ts";
import { money, summaryByTitle, type CutRow, type Quote } from "./quote.ts";

const PAGE_W = 1240;
const PAGE_H = 1754;
const M = 80;

type Ctx = CanvasRenderingContext2D;

function fontFamily() {
  if (typeof document === "undefined") return "sans-serif";
  return getComputedStyle(document.body).fontFamily || "sans-serif";
}

function newPage(): [HTMLCanvasElement, Ctx] {
  const c = document.createElement("canvas");
  c.width = PAGE_W;
  c.height = PAGE_H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  ctx.textBaseline = "alphabetic";
  if (catalog.brand.demo) watermark(ctx);
  return [c, ctx];
}

/** marca de agua de la demo, en diagonal y muy suave, por debajo del contenido */
function watermark(ctx: Ctx) {
  ctx.save();
  ctx.fillStyle = "rgba(31, 29, 26, 0.06)";
  ctx.font = `700 34px ${fontFamily()}`;
  ctx.textAlign = "center";
  ctx.rotate((-24 * Math.PI) / 180);
  for (let y = -200; y < PAGE_H * 1.4; y += 230) {
    for (let x = -600; x < PAGE_W * 1.4; x += 560) ctx.fillText(product.watermark, x + ((y / 230) % 2) * 280, y);
  }
  ctx.restore();
}

function text(ctx: Ctx, s: string, x: number, y: number, size: number, opts: { weight?: number; color?: string; align?: CanvasTextAlign } = {}) {
  ctx.font = `${opts.weight ?? 400} ${size}px ${fontFamily()}`;
  ctx.fillStyle = opts.color ?? "#1f1d1a";
  ctx.textAlign = opts.align ?? "left";
  ctx.fillText(s, x, y);
}

/** corta un texto en renglones que entren en `width` */
function wrap(ctx: Ctx, s: string, width: number, size: number): string[] {
  ctx.font = `400 ${size}px ${fontFamily()}`;
  const words = s.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function drawPiece(ctx: Ctx, d: Drawing, x: number, y: number, w: number, h: number) {
  const { map } = fitDrawing(d, w, h);
  const at = (p: [number, number]): [number, number] => {
    const q = map(p);
    return [x + q[0], y + q[1]];
  };
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const p of d.prims) {
    if (p.t === "poly") {
      ctx.beginPath();
      p.pts.forEach((q, i) => (i ? ctx.lineTo(...at(q)) : ctx.moveTo(...at(q))));
      if (p.close) ctx.closePath();
      if (p.fill) {
        ctx.fillStyle = p.fill;
        ctx.fill();
      }
      if (p.stroke) {
        ctx.setLineDash(p.dash ?? []);
        ctx.strokeStyle = p.stroke;
        ctx.lineWidth = (p.w ?? 1) * 1.4;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else if (p.t === "circle") {
      const [cx, cy] = at(p.c);
      const r = Math.max((p.minPx ?? 0) * 1.4, Math.abs(at([p.r, 0])[0] - at([0, 0])[0]));
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      if (p.fill) {
        ctx.fillStyle = p.fill;
        ctx.fill();
      }
      if (p.stroke) {
        ctx.strokeStyle = p.stroke;
        ctx.lineWidth = (p.w ?? 1) * 1.4;
        ctx.stroke();
      }
    } else {
      const [ax, ay] = at(p.a);
      const [bx, by] = at(p.b);
      const horizontal = Math.abs(by - ay) < Math.abs(bx - ax);
      const off = horizontal ? [0, -p.offset * 1.3] : [p.offset * 1.3, 0];
      const a = [ax + off[0], ay + off[1]];
      const b = [bx + off[0], by + off[1]];
      ctx.strokeStyle = INK.dim;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      const tk = horizontal ? [0, 5] : [5, 0];
      for (const q of [a, b]) {
        ctx.moveTo(q[0] - tk[0], q[1] - tk[1]);
        ctx.lineTo(q[0] + tk[0], q[1] + tk[1]);
      }
      ctx.stroke();
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      ctx.save();
      ctx.translate(mid[0], mid[1]);
      if (!horizontal) ctx.rotate(-Math.PI / 2);
      const outward = horizontal ? (p.offset < 0 ? 16 : -8) : p.offset < 0 ? -8 : 16;
      text(ctx, p.label, 0, outward, 15, { weight: 600, color: INK.dim, align: "center" });
      ctx.restore();
    }
  }
  ctx.restore();
}

function footer(ctx: Ctx, page: number, total: number) {
  ctx.fillStyle = "#e3ddd2";
  ctx.fillRect(M, PAGE_H - 70, PAGE_W - 2 * M, 1);
  text(ctx, `${catalog.brand.name} · Orden de producción`, M, PAGE_H - 40, 16, { color: "#5c574f" });
  text(ctx, `${page} / ${total}`, PAGE_W - M, PAGE_H - 40, 16, { color: "#5c574f", align: "right" });
  if (catalog.brand.samplePricing) text(ctx, "Precios orientativos de muestra", PAGE_W / 2, PAGE_H - 40, 16, { color: "#8a5528", align: "center" });
}

function specLines(config: WardrobeConfig): string[] {
  const cm = (v: number) => `${Math.round(v / 10)} cm`;
  const shape = config.shape === "straight" ? "Recto" : config.shape === "l-left" ? "En L, lateral a la izquierda" : "En L, lateral a la derecha";
  const lines = [
    `Forma: ${shape}${config.topBox.enabled ? `, con altillo de ${cm(config.topBox.height)}` : ""}${config.slope.enabled ? `, techo inclinado (lado bajo ${cm(config.slope.low)})` : ""}`,
    `Medidas: ${config.runs.map((r) => cm(r.width)).join(" + ")} de ancho · ${cm(totalHeight(config))} de alto · ${cm(config.depth)} de profundidad`,
    `Módulos: ${config.runs.reduce((s, r) => s + r.modules.length, 0)}`,
    config.doors === "none"
      ? "Sin puertas"
      : `Puertas ${config.doors === "hinged" ? "batientes" : "corredizas"}, frente ${DOOR_STYLE_LABELS[config.doorStyle].toLowerCase()}`,
  ];
  if (config.curved.left || config.curved.right) lines.push(`Terminal curvo ${config.curved.left && config.curved.right ? "en los dos extremos" : config.curved.left ? "a la izquierda" : "a la derecha"}`);
  if (hasLeds(config))
    lines.push(`Luz LED ${config.led.color === "rgb" ? `RGB ${config.led.rgb}` : LED_COLORS[config.led.color].label.toLowerCase()}${config.led.sensor && config.doors !== "none" ? ", con sensor al abrir" : ""}`);
  return lines;
}

function coverPage(config: WardrobeConfig, q: Quote, snapshot: HTMLImageElement | null, total: number): HTMLCanvasElement {
  const [c, ctx] = newPage();
  ctx.fillStyle = "#1f1d1a";
  ctx.fillRect(0, 0, PAGE_W, 150);
  text(ctx, catalog.brand.name, M, 72, 34, { weight: 700, color: "#ffffff" });
  text(ctx, "Orden de producción", M, 112, 22, { color: "#e9e1d4" });
  text(ctx, new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" }), PAGE_W - M, 112, 20, { color: "#e9e1d4", align: "right" });

  let y = 200;
  if (snapshot) {
    const w = PAGE_W - 2 * M;
    const h = 560;
    // la captura entra entera, sin recortar el placard: lo que sobra va en el color del fondo
    const scale = Math.min(w / snapshot.width, h / snapshot.height);
    const dw = snapshot.width * scale;
    const dh = snapshot.height * scale;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(M, y, w, h, 18);
    ctx.clip();
    ctx.fillStyle = "#ebe6df";
    ctx.fillRect(M, y, w, h);
    ctx.drawImage(snapshot, M + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx.restore();
    y += h + 50;
  }

  for (const line of specLines(config)) {
    text(ctx, line, M, y, 22);
    y += 36;
  }
  y += 20;

  const stats = [
    ["Precio al cliente", money(q.price)],
    ["Placas", String(q.boards.reduce((s, b) => s + b.count, 0))],
    ["Canto", `${q.bandingMeters.toFixed(1)} m`],
    ["Tira LED", `${q.assembly.ledMeters.toFixed(1)} m`],
  ];
  const sw = (PAGE_W - 2 * M - 3 * 20) / 4;
  stats.forEach(([label, value], i) => {
    const x = M + i * (sw + 20);
    ctx.fillStyle = "#f5f2ec";
    ctx.beginPath();
    ctx.roundRect(x, y, sw, 104, 16);
    ctx.fill();
    text(ctx, label, x + 20, y + 38, 17, { color: "#5c574f" });
    text(ctx, value, x + 20, y + 80, 28, { weight: 700 });
  });
  y += 150;

  text(ctx, "Resumen de piezas", M, y, 24, { weight: 700 });
  y += 40;
  const colW = (PAGE_W - 2 * M - 40) / 2;
  const rows = summaryByTitle(q.rows);
  const perCol = Math.ceil(rows.length / 2);
  rows.forEach((r, i) => {
    const col = i < perCol ? 0 : 1;
    const row = col === 0 ? i : i - perCol;
    const yy = y + row * 30;
    if (yy > PAGE_H - 110) return;
    const label = `${r.qty} × ${r.title}`;
    const fitted = wrap(ctx, label, colW - 10, 18)[0];
    text(ctx, fitted + (fitted === label ? "" : "…"), M + col * (colW + 40), yy, 18);
  });
  footer(ctx, 1, total);
  return c;
}

const CARD_COLS = 2;
const CARD_ROWS = 3;

function piecesPages(rows: CutRow[], first: number, total: number): HTMLCanvasElement[] {
  const pages: HTMLCanvasElement[] = [];
  const perPage = CARD_COLS * CARD_ROWS;
  const gap = 28;
  const cardW = (PAGE_W - 2 * M - gap) / CARD_COLS;
  const cardH = (PAGE_H - 2 * M - 90 - (CARD_ROWS - 1) * gap) / CARD_ROWS;
  for (let start = 0; start < rows.length; start += perPage) {
    const [c, ctx] = newPage();
    text(ctx, "Piezas", M, M + 10, 30, { weight: 700 });
    text(ctx, "Medidas en mm · largo en el sentido de la veta · naranja: tapacanto · amarillo: canal LED", M, M + 46, 17, { color: "#5c574f" });
    rows.slice(start, start + perPage).forEach((r, i) => {
      const x = M + (i % CARD_COLS) * (cardW + gap);
      const y = M + 80 + Math.floor(i / CARD_COLS) * (cardH + gap);
      ctx.strokeStyle = "#e3ddd2";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 18);
      ctx.stroke();
      const title = `${r.qty} × ${r.title}`;
      const titleLines = wrap(ctx, title, cardW - 40, 22).slice(0, 2);
      titleLines.forEach((l, k) => text(ctx, l, x + 20, y + 36 + k * 28, 22, { weight: 700 }));
      const sub = `${r.length} × ${r.width} × ${r.thickness} mm · ${r.materialName}${r.edges !== "—" ? ` · canto ${r.edges}` : ""}`;
      const subY = y + 36 + titleLines.length * 28;
      text(ctx, wrap(ctx, sub, cardW - 40, 16)[0], x + 20, subY, 16, { color: "#5c574f" });
      const d = pieceDrawing(r);
      const notesSize = 14;
      const notes = d.notes.flatMap((n) => wrap(ctx, n, cardW - 40, notesSize)).slice(0, 7);
      const drawTop = subY + 14;
      const drawH = cardH - (drawTop - y) - notes.length * 19 - 20;
      drawPiece(ctx, d, x + 10, drawTop, cardW - 20, Math.max(120, drawH));
      notes.forEach((n, k) => text(ctx, n, x + 20, y + cardH - 18 - (notes.length - 1 - k) * 19, notesSize, { color: "#3a332b" }));
    });
    footer(ctx, first + pages.length, total);
    pages.push(c);
  }
  return pages;
}

function hardwarePage(q: Quote, page: number, total: number): HTMLCanvasElement {
  const [c, ctx] = newPage();
  text(ctx, "Herrajes y luces", M, M + 10, 30, { weight: 700 });
  let y = M + 70;
  for (const h of q.assembly.hardware) {
    text(ctx, h.label, M, y, 20);
    text(ctx, h.unit === "u" ? `${h.qty} u` : `${h.qty.toFixed(2)} ${h.unit}`, PAGE_W - M, y, 20, { align: "right", weight: 600 });
    ctx.fillStyle = "#eee8de";
    ctx.fillRect(M, y + 14, PAGE_W - 2 * M, 1);
    y += 44;
  }
  y += 30;
  text(ctx, "Placas", M, y, 26, { weight: 700 });
  y += 46;
  for (const b of q.boards) {
    text(ctx, `${b.materialName} ${b.thickness} mm`, M, y, 20);
    text(ctx, `${b.count} placas · aprovechamiento ${Math.round(b.nesting.utilization * 100)} %`, PAGE_W - M, y, 20, { align: "right" });
    y += 40;
  }
  footer(ctx, page, total);
  return c;
}

async function canvasToJpeg(c: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve) => c.toBlob((b) => resolve(b!), "image/jpeg", 0.9));
  return new Uint8Array(await blob.arrayBuffer());
}

/** PDF mínimo: una imagen JPEG por hoja, A4 vertical */
export function jpegsToPdf(pages: { jpeg: Uint8Array; width: number; height: number }[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (b: Uint8Array | string) => {
    const bytes = typeof b === "string" ? enc.encode(b) : b;
    chunks.push(bytes);
    length += bytes.length;
  };
  const obj = (n: number, body: () => void) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
    body();
    push("\nendobj\n");
  };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const pageIds = pages.map((_, i) => 3 + i * 3);
  obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => push(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`));
  pages.forEach((p, i) => {
    const pageId = 3 + i * 3;
    const imgId = pageId + 1;
    const contentId = pageId + 2;
    const content = "q 595.28 0 0 841.89 0 0 cm /Im0 Do Q";
    obj(pageId, () =>
      push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>`),
    );
    obj(imgId, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
      push(p.jpeg);
      push("\nendstream");
    });
    obj(contentId, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
  });
  const count = 3 + pages.length * 3;
  const xref = length;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let n = 1; n < count; n++) push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);

  const out = new Uint8Array(length);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export type OrderPdf = { blob: Blob; preview: string; pages: number };

/** arma el PDF completo; `snapshot` es una captura del 3D (data URL) si la hay */
export async function buildOrderPdf(config: WardrobeConfig, q: Quote, snapshot?: string | null): Promise<OrderPdf> {
  if (document.fonts?.ready) await document.fonts.ready;
  const img = snapshot ? await loadImage(snapshot) : null;
  const pieceCount = Math.ceil(q.rows.length / (CARD_COLS * CARD_ROWS));
  const total = 1 + pieceCount + 1;
  const canvases = [coverPage(config, q, img, total), ...piecesPages(q.rows, 2, total), hardwarePage(q, total, total)];
  const pages = await Promise.all(canvases.map(async (c) => ({ jpeg: await canvasToJpeg(c), width: c.width, height: c.height })));
  const bytes = jpegsToPdf(pages);
  const preview = canvases[0].toDataURL("image/jpeg", 0.7);
  return { blob: new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" }), preview, pages: canvases.length };
}
