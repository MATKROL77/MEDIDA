/**
 * Cómo se ve una muestra de tela en un botón: el color con la trama de la foto
 * que usa el 3D encima. Así la muestra y el sillón muestran la misma tela.
 */

/** la foto de la trama de cada tela, en gris: se multiplica por el color */
const WEAVE_IMAGE: Record<string, { src: string; blend: string; size: string }> = {
  lino: { src: "/tex/tela-lino.webp", blend: "multiply", size: "56px" },
  pana: { src: "/tex/tela-pana.webp", blend: "multiply", size: "56px" },
  boucle: { src: "/tex/tela-boucle.webp", blend: "multiply", size: "48px" },
  cuero: { src: "/tex/tela-cuero.webp", blend: "multiply", size: "70px" },
};

export function fabricStyle(fabric: { color: string; weave: string }): React.CSSProperties {
  const w = WEAVE_IMAGE[fabric.weave];
  if (!w) return { background: fabric.color };
  return { backgroundColor: fabric.color, backgroundImage: `url(${w.src})`, backgroundSize: w.size, backgroundBlendMode: w.blend };
}
