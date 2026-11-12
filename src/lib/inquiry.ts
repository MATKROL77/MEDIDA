/**
 * La consulta conjunta: varios muebles configurados en un solo mensaje, para
 * pedir cotización de todos juntos. No es una compra ni un pedido confirmado.
 */

import { cartTotal, shortCode, type DesignState, type SavedDesign } from "./designs.ts";

const money = (value: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);

export function inquiryMessage(designs: SavedDesign[], linkFor: (d: SavedDesign) => string | null, recipient?: string): string {
  const items = designs.map((d, i) => {
    const link = linkFor(d);
    return [
      `${i + 1}. ${d.name} (${shortCode(d.id)})`,
      ...(d.summary.dimensions ? [`   ${d.summary.dimensions}`] : []),
      ...d.summary.lines.map((l) => `   ${l}`),
      ...(d.price !== null ? [`   Precio estimado: ${money(d.price)}`] : []),
      ...(link ? [`   Diseño: ${link}`] : []),
    ].join("\n");
  });
  const state: DesignState = { designs: designs.map((d) => ({ ...d, cart: true })), tombstones: [] };
  const total = cartTotal(state);
  const plural = designs.length !== 1;
  return [
    `Hola${recipient ? ` ${recipient}` : ""}, armé ${plural ? `estos ${designs.length} muebles` : "este mueble"} a medida y quiero pedir una cotización:`,
    "",
    items.join("\n\n"),
    "",
    ...(total !== null && plural ? [`Total estimado: ${money(total)}`] : []),
    "Los precios son estimados: falta confirmar medidas y costos.",
  ].join("\n");
}
