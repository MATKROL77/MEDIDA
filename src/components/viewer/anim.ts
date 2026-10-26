/**
 * Resortes. Todo lo que se mueve en el 3D pasa por acá: medidas, piezas que
 * aparecen, puertas, vista explotada, luces. Un resorte apenas subamortiguado
 * llega con un rebote chiquito, que es lo que da la sensación elástica.
 */

import { createContext, useContext } from "react";

export type Spring = { v: number; vel: number; target: number };

export const spring = (v = 0): Spring => ({ v, vel: 0, target: v });

/** rígido y con poco rebote: medidas y posiciones */
export const FIRM = { k: 210, c: 19 };
/** más elástico: piezas que aparecen */
export const BOUNCY = { k: 170, c: 13 };
/** suave: luces, transparencias, ambiente */
export const SOFT = { k: 90, c: 19 };
/** puertas y hojas corredizas: con peso, casi sin rebote para no pasarse del tope */
export const HEAVY = { k: 48, c: 12.5 };
/** cajones: un poco más ágiles que las puertas */
export const DRAWER = { k: 75, c: 15 };

export function step(s: Spring, dt: number, p = FIRM): boolean {
  const d = s.target - s.v;
  if (Math.abs(d) < 1e-4 && Math.abs(s.vel) < 1e-4) {
    s.v = s.target;
    s.vel = 0;
    return false;
  }
  // subpasos: estable aunque el navegador entregue un cuadro tarde
  const h = dt / 4;
  for (let i = 0; i < 4; i++) {
    const a = p.k * (s.target - s.v) - p.c * s.vel;
    s.vel += a * h;
    s.v += s.vel * h;
  }
  return true;
}

/** arreglo de resortes que comparten parámetros */
export class SpringVec {
  v: Float64Array;
  vel: Float64Array;
  target: Float64Array;
  constructor(values: number[]) {
    this.v = Float64Array.from(values);
    this.vel = new Float64Array(values.length);
    this.target = Float64Array.from(values);
  }
  set(values: number[]) {
    for (let i = 0; i < values.length; i++) this.target[i] = values[i];
  }
  snap() {
    this.v.set(this.target);
    this.vel.fill(0);
  }
  step(dt: number, p = FIRM): boolean {
    let moving = false;
    const h = dt / 4;
    for (let i = 0; i < this.v.length; i++) {
      const d = this.target[i] - this.v[i];
      if (Math.abs(d) < 1e-3 && Math.abs(this.vel[i]) < 1e-3) {
        this.v[i] = this.target[i];
        this.vel[i] = 0;
        continue;
      }
      moving = true;
      for (let j = 0; j < 4; j++) {
        const a = p.k * (this.target[i] - this.v[i]) - p.c * this.vel[i];
        this.vel[i] += a * h;
        this.v[i] += this.vel[i] * h;
      }
    }
    return moving;
  }
}

/** estado global de la escena que leen todas las piezas en cada cuadro */
export type SceneAnim = {
  /** puertas batientes: 0 cerradas, 1 abiertas (cada una con su ángulo y su demora) */
  open: Spring;
  /** cajones por módulo ("tramo:módulo"): 0 adentro, 1 afuera */
  drawers: Map<string, Spring>;
  /** hojas corredizas: cuánto se corrió cada una, en mm */
  leaves: Map<string, Spring>;
  explode: Spring;
  xray: Spring;
  lights: Spring;
  room: Spring;
  /** cuándo arrancó la escena: las piezas del primer cuadro entran escalonadas */
  bornAt: number;
};

export const SceneAnimContext = createContext<SceneAnim | null>(null);

export function useSceneAnim(): SceneAnim {
  const ctx = useContext(SceneAnimContext);
  if (!ctx) throw new Error("useSceneAnim fuera de la escena");
  return ctx;
}

/** paso de tiempo acotado: si el equipo se traba, la animación sigue sin saltar */
export const clampDt = (dt: number) => Math.min(dt, 0.1);

/** el resorte de una clave, creado la primera vez que se pide */
export function springFor(map: Map<string, Spring>, key: string): Spring {
  let s = map.get(key);
  if (!s) map.set(key, (s = spring()));
  return s;
}

/** avance de una puerta que arranca con demora dentro del movimiento general */
export function doorProgress(open: number, delay = 0): number {
  return Math.min(1, Math.max(0, (open - delay) / (1 - delay)));
}
