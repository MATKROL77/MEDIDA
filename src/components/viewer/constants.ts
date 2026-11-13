/** colores de pared de la habitación; aparte para no cargar three.js con el panel */
export const WALL_COLORS = [
  { id: "tiza", name: "Blanco tiza", hex: "#e6e0d7" },
  { id: "arena", name: "Arena", hex: "#e0d3bf" },
  { id: "perla", name: "Gris perla", hex: "#d6d6d2" },
  { id: "salvia", name: "Salvia", hex: "#c5cebb" },
  { id: "terracota", name: "Terracota", hex: "#d4a084" },
  { id: "petroleo", name: "Azul petróleo", hex: "#4e6870" },
] as const;

/** "estudio": sin piso propio, el mueble apoya en el fondo liso del estudio */
export type FloorType = "estudio" | "madera" | "pinotea" | "cemento" | "baldosa";

export const FLOORS: { id: FloorType; name: string; swatch: string }[] = [
  { id: "estudio", name: "Estudio liso", swatch: "#e3dbce" },
  { id: "madera", name: "Madera clara", swatch: "repeating-linear-gradient(90deg, #c49a6e 0 9px, #b98d61 9px 10px)" },
  { id: "pinotea", name: "Pinotea", swatch: "repeating-linear-gradient(90deg, #b5743f 0 6px, #a3653a 6px 7px)" },
  { id: "cemento", name: "Cemento alisado", swatch: "radial-gradient(circle at 30% 30%, #b9b8b4, #a3a29e)" },
  { id: "baldosa", name: "Baldosa beige", swatch: "linear-gradient(#cdbfa8 1px, transparent 1px) 0 0 / 12px 12px, linear-gradient(90deg, #cdbfa8 1px, #e3d7c3 1px) 0 0 / 12px 12px" },
];
