/**
 * La curva de tonos del 3D rápido: la "neutral" de Khronos, pensada para
 * mostrar productos. Deja los colores como son hasta casi el blanco y solo
 * aprieta los brillos, así una melamina blanca se lee blanca y la madera no
 * se lava. Acá está la misma cuenta que hace la placa de video, y su inversa:
 * con qué valor hay que entrar para salir exactamente de un color (el fondo
 * liso tiene que quedar del color de la página).
 *
 * Todo en luz lineal, de 0 a 1 por canal.
 */

export type Rgb = [number, number, number];

/** desde dónde empieza a apretar los brillos */
const START = 0.8 - 0.04;
const DESATURATION = 0.15;

/** lo que le resta a todos los canales: levanta apenas el contraste de los oscuros */
function toe(min: number): number {
  return min < 0.08 ? min - 6.25 * min * min : 0.04;
}

/** de la luz de la escena al color que sale en pantalla */
export function neutralTone(color: Rgb): Rgb {
  const offset = toe(Math.min(color[0], color[1], color[2]));
  const c: Rgb = [color[0] - offset, color[1] - offset, color[2] - offset];
  const peak = Math.max(c[0], c[1], c[2]);
  if (peak < START) return c;
  const d = 1 - START;
  const newPeak = 1 - (d * d) / (peak + d - START);
  const g = 1 - 1 / (DESATURATION * (peak - newPeak) + 1);
  return c.map((v) => {
    const scaled = v * (newPeak / peak);
    return scaled + (newPeak - scaled) * g;
  }) as Rgb;
}

/**
 * Con qué luz hay que entrar para que en pantalla salga exactamente `target`:
 * la curva al revés, paso por paso. El blanco puro no se alcanza nunca (la
 * curva se le acerca sin tocarlo): se apunta apenas por debajo.
 */
export function neutralInverse(target: Rgb): Rgb {
  const top = Math.max(target[0], target[1], target[2]);
  const limit = 0.985;
  const t: Rgb = top > limit ? (target.map((v) => (v * limit) / top) as Rgb) : target;
  const newPeak = Math.max(t[0], t[1], t[2]);
  let c: Rgb = t;
  if (newPeak >= START) {
    // deshace el apretado de los brillos y la pérdida de color que lo acompaña
    const d = 1 - START;
    const peak = (d * d) / (1 - newPeak) - d + START;
    const g = 1 - 1 / (DESATURATION * (peak - newPeak) + 1);
    c = t.map((v) => ((v - newPeak * g) / (1 - g)) * (peak / newPeak)) as Rgb;
  }
  // devuelve lo que se le restó a todos los canales
  const low = Math.max(0, Math.min(c[0], c[1], c[2]));
  const min = low < 0.04 ? Math.sqrt(low / 6.25) : low + 0.04;
  const offset = min - low;
  return [c[0] + offset, c[1] + offset, c[2] + offset];
}

/**
 * Lleva una foto (píxeles RGBA de 0 a 255) a otro tono: su promedio pasa de
 * `from` a `to` y lo que cada píxel se aparta del promedio se conserva,
 * multiplicado por `contrast` y con el color de esa diferencia bajado a
 * `saturation` (0: la veta queda solo como claros y oscuros).
 *
 * Aclarar un piso multiplicando su color no alcanza: los canales oscuros de
 * una madera habría que multiplicarlos por tres o más, y lo que sale es un
 * amarillo chillón. Corriendo el promedio, la veta se queda como está.
 */
export function retone(pixels: Uint8ClampedArray | number[], from: Rgb, to: Rgb, contrast = 1, saturation = 1): void {
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const dr = pixels[i] - from[0];
    const dg = pixels[i + 1] - from[1];
    const db = pixels[i + 2] - from[2];
    // la parte de la diferencia que es solo luz, sin color
    const grey = 0.299 * dr + 0.587 * dg + 0.114 * db;
    pixels[i] = Math.min(255, Math.max(0, Math.round(to[0] + (grey + (dr - grey) * saturation) * contrast)));
    pixels[i + 1] = Math.min(255, Math.max(0, Math.round(to[1] + (grey + (dg - grey) * saturation) * contrast)));
    pixels[i + 2] = Math.min(255, Math.max(0, Math.round(to[2] + (grey + (db - grey) * saturation) * contrast)));
  }
}
