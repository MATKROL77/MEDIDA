/**
 * Dibujo técnico de cada pieza para el taller.
 *
 * Se describe una sola vez como una lista de primitivas (polígonos, círculos,
 * cotas) y se dibuja con dos motores: SVG en la página y canvas en el PDF.
 * La geometría va en mm con el origen abajo a la izquierda; los grosores de
 * línea, los textos y la separación de las cotas van en píxeles de pantalla,
 * así se leen igual en una pieza chica que en una de dos metros.
 */

import type { Feature } from "./assembly.ts";
import type { CutRow } from "./quote.ts";

export const INK = {
  piece: "#f6efe4",
  outline: "#3a332b",
  band: "#c06a26",
  led: "#e0a100",
  hole: "#3a332b",
  groove: "#5c574f",
  mirror: "#dfe7ec",
  glass: "#9fb0b8",
  frame: "#b8bcc1",
  dim: "#5c574f",
};

export type Prim =
  | { t: "poly"; pts: [number, number][]; fill?: string; stroke?: string; w?: number; dash?: number[]; close?: boolean }
  | { t: "circle"; c: [number, number]; r: number; minPx?: number; fill?: string; stroke?: string; w?: number }
  /** cota: de a hasta b, corrida `offset` píxeles hacia afuera */
  | { t: "dim"; a: [number, number]; b: [number, number]; offset: number; label: string };

export type Drawing = {
  /** caja de la pieza en mm */
  w: number;
  h: number;
  prims: Prim[];
  /** aclaraciones en texto, debajo del dibujo */
  notes: string[];
};

const mm = (v: number) => `${Math.round(v)}`;

function ellipseArc(rx: number, ry: number, cx: number, cy: number, mirror: boolean, steps = 32): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    pts.push([cx + (mirror ? -1 : 1) * rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return pts;
}

/**
 * Las piezas verticales (laterales, puertas, fondos) se dibujan paradas, con
 * el frente a la derecha; las horizontales (estantes, techos, cajones) vistas
 * desde arriba, con el frente abajo.
 */
export function pieceDrawing(row: CutRow): Drawing {
  const vertical = row.orientation === "vertical";
  const w = vertical ? row.width : row.length;
  const h = vertical ? row.length : row.width;
  const prims: Prim[] = [];
  const notes: string[] = [];

  // contorno
  let outline: [number, number][];
  if (row.shape.kind === "trapezoid") {
    outline = [
      [0, 0],
      [w, 0],
      [w, row.shape.right],
      [0, row.shape.left],
    ];
  } else if (row.shape.kind === "quarter") {
    // cuarto de elipse: el lado recto apoya contra el lateral del placard
    const left = row.shape.side === "left";
    const cx = left ? w : 0;
    outline = [[cx, 0], ...ellipseArc(w, h, cx, 0, left), [cx, h]];
  } else {
    outline = [
      [0, 0],
      [w, 0],
      [w, h],
      [0, h],
    ];
  }

  if (!row.board) {
    // puerta de vidrio: marco de aluminio y paño
    const bar = 22;
    prims.push({ t: "poly", pts: outline, fill: INK.frame, stroke: INK.outline, w: 1.2, close: true });
    prims.push({
      t: "poly",
      pts: [
        [bar, bar],
        [w - bar, bar],
        [w - bar, h - bar],
        [bar, h - bar],
      ],
      fill: INK.glass,
      stroke: INK.outline,
      w: 0.8,
      close: true,
    });
    notes.push(`Marco de perfil de aluminio de ${bar} mm, vidrio fumé de 4 mm de ${mm(w - 2 * bar)} × ${mm(h - 2 * bar)} mm.`);
  } else {
    prims.push({ t: "poly", pts: outline, fill: INK.piece, stroke: INK.outline, w: 1.2, close: true });
  }

  // tapacanto: líneas gruesas sobre los cantos que lo llevan
  const bandLines: [number, number][][] = [];
  if (row.shape.kind === "quarter") {
    if (row.curvedBand) bandLines.push(outline.slice(1, -1));
  } else if (row.board) {
    const { long, short } = row.band;
    const longIsVertical = vertical ? row.length >= row.width : row.length < row.width;
    // el frente: a la derecha en las verticales, abajo en las horizontales
    const front: [number, number][] = vertical ? [[w, 0], [w, outline[2][1]]] : [[0, 0], [w, 0]];
    const opposite: [number, number][] = vertical ? [[0, 0], [0, outline[3][1]]] : [[0, h], [w, h]];
    const ends: [number, number][][] = vertical
      ? [
          [[0, outline[3][1]], [w, outline[2][1]]],
          [[0, 0], [w, 0]],
        ]
      : [
          [[0, 0], [0, h]],
          [[w, 0], [w, h]],
        ];
    const longEdges = longIsVertical === vertical ? [front, opposite] : ends;
    const shortEdges = longIsVertical === vertical ? ends : [front, opposite];
    for (let i = 0; i < long; i++) bandLines.push(longEdges[i]);
    for (let i = 0; i < short; i++) bandLines.push(shortEdges[i]);
  }
  for (const pts of bandLines) prims.push({ t: "poly", pts, stroke: INK.band, w: 4 });
  if (bandLines.length) notes.push(`Tapacanto en ${row.edges} (línea naranja).`);

  for (const f of row.features) drawFeature(f, row, w, h, prims, notes);

  // cotas
  prims.push({ t: "dim", a: [0, 0], b: [w, 0], offset: -16, label: mm(w) });
  const leftH = row.shape.kind === "trapezoid" ? row.shape.left : h;
  prims.push({ t: "dim", a: [0, 0], b: [0, leftH], offset: -16, label: mm(leftH) });
  if (row.shape.kind === "trapezoid") {
    prims.push({ t: "dim", a: [w, 0], b: [w, row.shape.right], offset: 16, label: mm(row.shape.right) });
    notes.push(`Corte inclinado arriba: ${mm(row.shape.left)} mm a la izquierda, ${mm(row.shape.right)} mm a la derecha.`);
  }
  if (row.shape.kind === "quarter") notes.push(`Cuarto de elipse de ${mm(w)} × ${mm(h)} mm, cortado con router.`);
  if (row.note && row.shape.kind === "rect" && !row.features.some((f) => f.type === "bevel")) notes.push(row.note);

  return { w, h, prims, notes };
}

function drawFeature(f: Feature, row: CutRow, w: number, h: number, prims: Prim[], notes: string[]) {
  switch (f.type) {
    case "led-groove": {
      const half = 6;
      if (f.face === "bottom") {
        // vista de arriba: el canal corre paralelo al frente (abajo en el dibujo)
        for (const y of [f.offset - half, f.offset + half]) prims.push({ t: "poly", pts: [[30, y], [w - 30, y]], stroke: INK.led, w: 1.6, dash: [6, 4] });
        notes.push(`Canal para perfil LED de 12 × 8 mm por debajo, a ${f.offset} mm del frente, de ${mm(w - 60)} mm de largo.`);
      } else {
        const x = w - f.offset;
        for (const xx of [x - half, x + half]) prims.push({ t: "poly", pts: [[xx, 60], [xx, h - 60]], stroke: INK.led, w: 1.6, dash: [6, 4] });
        notes.push(`Canal vertical para perfil LED de 12 × 8 mm en la cara ${f.face === "left" ? "izquierda" : "derecha"} (mirando el placard de frente), a ${f.offset} mm del frente.`);
      }
      break;
    }
    case "hinge-holes": {
      const x = f.edge === "left" ? 22.5 : w - 22.5;
      for (const y of f.at) prims.push({ t: "circle", c: [x, y], r: 17.5, minPx: 4.5, fill: "#ffffff", stroke: INK.hole, w: 1.2 });
      notes.push(`${f.at.length} cazoletas de 35 mm a 22,5 mm del canto ${f.edge === "left" ? "izquierdo" : "derecho"}, a ${f.at.join(", ")} mm desde abajo.`);
      break;
    }
    case "handle-holes": {
      for (const c of f.points) prims.push({ t: "circle", c, r: 2.5, minPx: 2.5, fill: INK.hole });
      notes.push(`Agujeros de tirador de 5 mm en ${f.points.map(([x, y]) => `(${x}, ${y})`).join(" y ")} mm, desde abajo a la izquierda mirando el frente.`);
      break;
    }
    case "grooves": {
      f.xs.forEach((x, i) => prims.push({ t: "poly", pts: [[x, f.from], [x, f.from + f.lengths[i]]], stroke: INK.groove, w: 1.4 }));
      notes.push(`${f.xs.length} ranuras de 5 mm en CNC, cada ${f.xs.length > 1 ? f.xs[1] - f.xs[0] : 60} mm, desde ${f.from} mm del borde.`);
      break;
    }
    case "mirror": {
      const i = 4;
      prims.push({
        t: "poly",
        pts:
          row.shape.kind === "trapezoid"
            ? [[i, i], [w - i, i], [w - i, row.shape.right - i], [i, row.shape.left - i]]
            : [[i, i], [w - i, i], [w - i, h - i], [i, h - i]],
        fill: INK.mirror,
        stroke: INK.glass,
        w: 1,
        close: true,
      });
      notes.push("Espejo de 4 mm pegado al frente, 4 mm adentro de cada borde.");
      break;
    }
    case "bevel": {
      prims.push({ t: "poly", pts: [[0, 0], [Math.min(w * 0.06, 40), h]], stroke: INK.outline, w: 1, dash: [3, 3] });
      prims.push({ t: "poly", pts: [[w, 0], [w - Math.min(w * 0.06, 40), h]], stroke: INK.outline, w: 1, dash: [3, 3] });
      notes.push(`Puntas cortadas a ${f.degrees}° para seguir la pendiente del techo.`);
      break;
    }
  }
}

/** cómo entra un dibujo en una caja de píxeles, dejando lugar para las cotas */
export function fitDrawing(d: Drawing, boxW: number, boxH: number, pad = 34) {
  const s = Math.min((boxW - 2 * pad) / Math.max(d.w, 1), (boxH - 2 * pad) / Math.max(d.h, 1));
  const ox = (boxW - d.w * s) / 2;
  const oy = (boxH + d.h * s) / 2;
  return { s, map: (p: [number, number]): [number, number] => [ox + p[0] * s, oy - p[1] * s] };
}
