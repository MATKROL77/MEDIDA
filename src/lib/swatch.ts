/**
 * Cómo se ve una muestra de tela en un botón: el color con la trama de la foto
 * que usa el 3D encima. Así la muestra y el sillón muestran la misma tela.
 */

/** la foto de la trama de cada tela; el bouclé y el cuero solo tienen relieve, se usa su rugosidad */
const WEAVE_IMAGE: Record<string, { src: string; blend: string; size: string }> = {
  lino: { src: "/tex/tela-lino.webp", blend: "multiply", size: "46px" },
  pana: { src: "/tex/tela-pana.webp", blend: "multiply", size: "46px" },
  boucle: { src: "/tex/tela-boucle-rough.webp", blend: "soft-light", size: "38px" },
  cuero: { src: "/tex/tela-cuero-rough.webp", blend: "soft-light", size: "60px" },
};

export function fabricStyle(fabric: { color: string; weave: string }): React.CSSProperties {
  const w = WEAVE_IMAGE[fabric.weave];
  if (!w) return { background: fabric.color };
  return { backgroundColor: fabric.color, backgroundImage: `url(${w.src})`, backgroundSize: w.size, backgroundBlendMode: w.blend };
}
