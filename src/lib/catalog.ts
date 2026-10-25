/**
 * Catálogo del taller: marca, materiales, herrajes y precios.
 *
 * Es lo único que cambia de un fabricante a otro. El configurador, el despiece
 * y el cálculo de precio leen todo de acá, así que sumar un taller nuevo es
 * copiar este archivo y cambiar los valores.
 *
 * LOS PRECIOS SON DE EJEMPLO. La marca "Altura Placares" es inventada para la
 * demo: no corresponde a ningún fabricante real. Cada taller carga sus propios
 * costos antes de publicar.
 */

export type Material = {
  id: string;
  name: string;
  /** color base para el 3D y la muestra */
  color: string;
  /** las vetas obligan a cortar en un solo sentido: no se rotan en la placa */
  grain: boolean;
  /** precio de una placa entera de 18 mm, en pesos */
  boardPrice: number;
};

export type HandleType = "bar" | "knob" | "none";

export const catalog = {
  brand: {
    name: "Altura Placares",
    tagline: "Placares y vestidores a medida",
    city: "Pilar, Buenos Aires",
    /** wa.me sin + ni espacios. En la demo apunta al número de Matías. */
    whatsapp: "5492324582614",
    demo: true,
  },

  /** placa de melamina estándar y cómo la corta la seccionadora */
  board: {
    length: 2600,
    width: 1830,
    thickness: 18,
    /** refilado de cada borde: el canto de fábrica viene golpeado */
    trim: 10,
    /** espesor de la hoja de sierra */
    kerf: 4,
  },

  /** fondo de MDF de 3 mm, se clava atrás */
  backBoard: { length: 2600, width: 1830, thickness: 3, price: 28000 },

  materials: [
    { id: "blanco", name: "Blanco", color: "#f2f0eb", grain: false, boardPrice: 98000 },
    { id: "grafito", name: "Gris grafito", color: "#4a4b4d", grain: false, boardPrice: 112000 },
    { id: "salvia", name: "Verde salvia", color: "#9aa58e", grain: false, boardPrice: 118000 },
    { id: "roble", name: "Roble natural", color: "#c49a6c", grain: true, boardPrice: 124000 },
    { id: "nogal", name: "Nogal", color: "#6e4b33", grain: true, boardPrice: 129000 },
  ] satisfies readonly Material[],

  /** tapacanto de PVC, por metro lineal */
  edgeBandPerMeter: 900,

  hardware: {
    hinge: 3200,
    /** par de correderas telescópicas */
    slidePair: 13500,
    rodPerMeter: 8500,
    rodSupport: 1400,
    /** juego de ruedas y guías para una hoja corrediza */
    slidingKitPerLeaf: 17000,
    /** perfil de aluminio, se usa arriba y abajo */
    slidingTrackPerMeter: 21000,
    handle: { bar: 5800, knob: 3300, none: 0 } satisfies Record<HandleType, number>,
    /** tornillos, minifix, tarugos y regatones de un módulo */
    fittingsPerModule: 5500,
  },

  labor: {
    /** corte y pegado de canto, por placa usada */
    perBoard: 24000,
    perModule: 28000,
    perDoor: 7500,
    perDrawer: 11000,
  },

  /** sobre el costo. 0.45 = el precio es costo + 45 % */
  margin: 0.45,
} as const;

export type Catalog = typeof catalog;

export function materialById(id: string): Material {
  return catalog.materials.find((m) => m.id === id) ?? catalog.materials[0];
}
