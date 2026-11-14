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
 * El mueble de la portada: el sillón curvo de bouclé crudo, sobre su zócalo
 * de madera y con la mesita de piedra. Es lo que mejor muestra la luz calculada: la trama, las curvas,
 * la sombra que hace al apoyarse.
 */
export const HERO_SOFA: FurnitureConfig = {
  family: "sillones",
  values: { style: "curvo", seats: 3, seatWidth: 900, depth: 1000, base: "madera", chaise: "no", bow: 450, table: "izquierda", arms: false, ottoman: false },
  body: "nogal",
  front: "nogal",
  fabric: "crudo",
};

/** la portada se mira de cerca: el sillón ocupa el cuadro, como en una foto de catálogo */
export const HERO_SOFA_FRAMING = 0.6;
/** en un teléfono el cuadro es vertical: la cámara se aleja para que entre el sillón entero */
export const HERO_SOFA_FRAMING_PORTRAIT = 0.86;
