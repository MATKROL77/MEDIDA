/**
 * Acomoda las piezas en placas para saber cuántas hay que comprar.
 *
 * Usa franjas guillotina, que es como corta una seccionadora: primero cortes
 * a lo largo de la placa en franjas, después cada franja se trocea. No es el
 * óptimo matemático, pero da un plano que el operario puede seguir tal cual y
 * una cantidad de placas que no se queda corta.
 *
 * Con veta, la pieza va siempre con su largo a lo largo de la placa. Sin veta
 * se permite girarla si así entra mejor.
 */

export type NestPiece = {
  id: string;
  label: string;
  length: number;
  width: number;
};

export type Placement = NestPiece & {
  /** posición dentro del área útil de la placa, ya descontado el refilado */
  x: number;
  y: number;
  /** largo y ancho tal como quedaron en la placa */
  w: number;
  h: number;
  rotated: boolean;
};

export type BoardSpec = {
  length: number;
  width: number;
  trim: number;
  kerf: number;
};

export type NestResult = {
  boards: Placement[][];
  /** fracción del área útil ocupada por piezas */
  utilization: number;
  /** piezas que no entran en una placa entera, aun girándolas */
  oversize: NestPiece[];
};

type Strip = { board: number; y: number; height: number; used: number };

export function nest(pieces: NestPiece[], board: BoardSpec, allowRotate: boolean): NestResult {
  const L = board.length - 2 * board.trim;
  const Wb = board.width - 2 * board.trim;
  const k = board.kerf;

  const oversize: NestPiece[] = [];
  // orientación: el largo de la pieza a lo largo de la placa, salvo que no entre
  const oriented = pieces.flatMap((p) => {
    if (p.length <= L && p.width <= Wb) return [{ p, w: p.length, h: p.width, rotated: false }];
    if (allowRotate && p.width <= L && p.length <= Wb) return [{ p, w: p.width, h: p.length, rotated: true }];
    oversize.push(p);
    return [];
  });

  // las franjas más anchas primero; dentro de cada ancho, las piezas más largas
  oriented.sort((a, b) => b.h - a.h || b.w - a.w);

  const boards: Placement[][] = [];
  const usedAcross: number[] = [];
  const strips: Strip[] = [];

  for (const o of oriented) {
    let strip = strips.find((s) => o.h <= s.height && s.used + o.w <= L);
    if (!strip) {
      let b = usedAcross.findIndex((u) => u + o.h <= Wb);
      if (b === -1) {
        boards.push([]);
        usedAcross.push(0);
        b = boards.length - 1;
      }
      strip = { board: b, y: usedAcross[b], height: o.h, used: 0 };
      usedAcross[b] += o.h + k;
      strips.push(strip);
    }
    boards[strip.board].push({ ...o.p, x: strip.used, y: strip.y, w: o.w, h: o.h, rotated: o.rotated });
    strip.used += o.w + k;
  }

  const area = oriented.reduce((sum, o) => sum + o.w * o.h, 0);
  const utilization = boards.length ? area / (boards.length * L * Wb) : 0;
  return { boards, utilization, oversize };
}
