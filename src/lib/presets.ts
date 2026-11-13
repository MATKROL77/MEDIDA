/**
 * Configuraciones de muestra del sitio. La landing y la herramienta de
 * capturas usan las mismas, así la imagen fija del hero coincide con el 3D que
 * la reemplaza.
 */

import type { FurnitureConfig } from "./furniture.ts";
import { DEFAULT_CONFIG, normalize, type WardrobeConfig } from "./model.ts";

/** el mueble del hero: frentes de roble sobre cuerpo grafito, que se recorta bien contra el fondo claro */
export const HERO_CONFIG: WardrobeConfig = normalize({ ...DEFAULT_CONFIG, bodyMaterial: "grafito", doorMaterial: "roble" });

/** cuánto se acerca la cámara en el hero respecto del configurador, que deja lugar para sus barras */
export const HERO_FRAMING = 0.9;

/**
 * El mueble de la portada: un sillón curvo de bouclé crudo, apoyado al piso,
 * con su puff. Es lo que mejor muestra la luz calculada: la trama, las curvas,
 * la sombra que hace al apoyarse.
 */
export const HERO_SOFA: FurnitureConfig = {
  family: "sillones",
  values: { style: "curvo", seats: 3, seatWidth: 900, depth: 1000, base: "piso", chaise: "no", arms: true, ottoman: true },
  body: "nogal",
  front: "nogal",
  fabric: "crudo",
};
