/**
 * El producto que se le vende a los talleres. "Medida" es un nombre de
 * trabajo: cambiarlo acá lo cambia en todo el sitio.
 */
export const product = {
  name: "Medida",
  pitch:
    "Tus clientes arman su placard en 3D, ven el precio al instante y a vos te llega el pedido con el despiece listo para cortar.",
  maker: "Matías Colimodio",
  makerCity: "Pilar, Buenos Aires",
  /** wa.me del que vende el producto, no del taller de la demo */
  whatsapp: "5492324582614",
  email: "matiascolimodio@gmail.com",
  /** marca de agua de la demo: va en el 3D, en la vista del taller y en el PDF */
  watermark: "MEDIDA",
  watermarkNote: "Medida · matiascolimodio@gmail.com",
} as const;

export function productWhatsapp(message: string) {
  return `https://wa.me/${product.whatsapp}?text=${encodeURIComponent(message)}`;
}
