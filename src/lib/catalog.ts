/**
 * Catálogo del taller: marca, materiales, herrajes y precios.
 *
 * Es lo único que cambia de un fabricante a otro. El configurador, el despiece
 * y el cálculo de precio leen todo de acá, así que sumar un taller nuevo es
 * copiar este archivo y cambiar los valores.
 *
 * LOS PRECIOS SON DE EJEMPLO. Cada taller carga sus propios costos antes de
 * usar el cálculo en una cotización real.
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
    name: "MEDIDA",
    tagline: "Placares y vestidores a medida",
    city: "Pilar, Buenos Aires",
    demo: false,
    /** independiente de la marca de agua: los costos aún son orientativos */
    samplePricing: true,
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
    { id: "blanco", name: "Blanco", color: "#f1efea", grain: false, boardPrice: 98000 },
    { id: "grafito", name: "Gris grafito", color: "#4a4b4d", grain: false, boardPrice: 112000 },
    { id: "salvia", name: "Verde salvia", color: "#9aa58e", grain: false, boardPrice: 118000 },
    { id: "arena", name: "Arena", color: "#d8cbb6", grain: false, boardPrice: 114000 },
    { id: "roble", name: "Roble natural", color: "#c49a6c", grain: true, boardPrice: 124000 },
    { id: "nogal", name: "Nogal", color: "#6e4b33", grain: true, boardPrice: 129000 },
  ] satisfies readonly Material[],

  /** tapacanto de PVC, por metro lineal */
  edgeBandPerMeter: 900,

  hardware: {
    hinge: 3200,
    /** par de correderas telescópicas */
    slidePair: 13500,
    /** par de suplementos para correr la corredera hacia adentro (cajones detrás de corredizas) */
    slideSpacer: 2600,
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

  /** frentes especiales */
  fronts: {
    mirrorPerM2: 62000,
    glassPerM2: 46000,
    /** perfil de aluminio para puerta de vidrio, por metro */
    frameProfilePerMeter: 13500,
    /** ranurado en CNC, por puerta */
    groovingPerDoor: 14000,
  },

  led: {
    whiteStripPerMeter: 6200,
    rgbStripPerMeter: 10500,
    /** perfil de aluminio con difusor, por metro */
    profilePerMeter: 6800,
    /** consumo de la tira, para dimensionar las fuentes */
    wattsPerMeter: 9.6,
    powerSupply60W: 17500,
    /** sensor de apertura, uno por módulo iluminado */
    sensor: 8500,
    rgbController: 21000,
    installPerMeter: 2800,
  },

  labor: {
    /** corte y pegado de canto, por placa usada */
    perBoard: 24000,
    perModule: 28000,
    perDoor: 7500,
    perDrawer: 11000,
    /** corte en ángulo para techo inclinado, por pieza */
    angledCut: 5500,
    /** corte curvo con router, por pieza */
    curvedCut: 9500,
  },

  /** sobre el costo. 0.45 = el precio es costo + 45 % */
  margin: 0.45,
} as const;

export type Catalog = typeof catalog;

export function materialById(id: string): Material {
  return catalog.materials.find((m) => m.id === id) ?? catalog.materials[0];
}

/**
 * Lo que una empresa cambia del catálogo de su configurador: su nombre, su
 * margen, qué terminaciones ofrece y a qué precio. Se aplica una vez, antes de
 * dibujar el configurador embebido; el motor es el mismo para todas.
 */
export type CatalogOverrides = { brandName?: string; tagline?: string; margin?: number; materials?: string[]; boardPrices?: Record<string, number> };

const BASE_MATERIALS: readonly Material[] = [...catalog.materials];

export function configureCatalog(o: CatalogOverrides) {
  const c = catalog as unknown as { brand: { name: string; tagline: string }; margin: number; materials: Material[] };
  if (o.brandName) c.brand.name = o.brandName;
  if (o.tagline) c.brand.tagline = o.tagline;
  if (typeof o.margin === "number" && o.margin >= 0 && o.margin <= 5) c.margin = o.margin;
  const wanted = o.materials?.length ? BASE_MATERIALS.filter((m) => o.materials!.includes(m.id)) : [...BASE_MATERIALS];
  // sin ninguna terminación válida se dejan todas: un configurador vacío no sirve
  c.materials = (wanted.length ? wanted : [...BASE_MATERIALS]).map((m) => ({ ...m, boardPrice: o.boardPrices?.[m.id] ?? m.boardPrice }));
}
