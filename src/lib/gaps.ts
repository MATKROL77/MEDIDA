import type { Part } from "./assembly";

/**
 * Las caras de cada placa que quedan metidas en una ranura: a menos de 6 mm de
 * otra pieza que las tapa casi enteras (el costado de un frente contra el del
 * vecino, el canto de un divisor detrás de dos frentes, el de arriba de un
 * cajón bajo el estante). En un mueble de verdad esas caras están en sombra y
 * la ranura se ve como una línea oscura; el visor en tiempo real no calcula
 * una sombra tan fina, así que se las marca para oscurecerlas.
 *
 * Devuelve, por pieza, una máscara de seis bits: el bit `eje * 2 + (positiva ? 1 : 0)`
 * (eje 0 = x, 1 = y, 2 = z) prendido si esa cara está en una ranura.
 */
export function hiddenFaces(parts: Part[]): Map<string, number> {
  const GAP = 6;
  const COVER = 0.6;
  const boards = parts.filter((p) => p.geometry === "box" && !p.rotationZ && !p.id.startsWith("deco") && p.kind !== "led" && p.kind !== "glow" && p.material !== "none" && p.material !== "glass" && p.material !== "mirror");
  const out = new Map<string, number>();
  const lo = (p: Part, k: number) => p.position[k];
  const hi = (p: Part, k: number) => p.position[k] + p.size[k];
  for (const a of boards) {
    let mask = 0;
    for (let k = 0; k < 3; k++) {
      const [u, v] = [0, 1, 2].filter((x) => x !== k);
      const area = a.size[u] * a.size[v];
      if (area <= 0) continue;
      for (const positive of [false, true]) {
        const plane = positive ? hi(a, k) : lo(a, k);
        let covered = 0;
        for (const b of boards) {
          if (b === a) continue;
          // la cara de b que mira a la de a, y qué tan lejos está
          const gap = positive ? lo(b, k) - plane : plane - hi(b, k);
          if (gap < -0.5 || gap > GAP) continue;
          const ou = Math.min(hi(a, u), hi(b, u)) - Math.max(lo(a, u), lo(b, u));
          const ov = Math.min(hi(a, v), hi(b, v)) - Math.max(lo(a, v), lo(b, v));
          if (ou > 0 && ov > 0) covered += ou * ov;
        }
        if (covered / area >= COVER) mask |= 1 << (k * 2 + (positive ? 1 : 0));
      }
    }
    if (mask) out.set(a.id, mask);
  }
  return out;
}
