/**
 * La configuración viaja entera en el link (?c=...). Así el pedido que llega
 * por WhatsApp abre el mismo placard que armó el cliente, sin base de datos.
 */

import { catalog, materialById } from "./catalog.ts";
import { DOOR_STYLE_LABELS, LAYOUT_LABELS, LED_COLORS, hasLeds, normalize, totalHeight, type WardrobeConfig } from "./model.ts";

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export function encodeConfig(config: WardrobeConfig): string {
  return toBase64Url(JSON.stringify(config));
}

export function decodeConfig(value: string | null): WardrobeConfig | null {
  if (!value) return null;
  try {
    return normalize(JSON.parse(fromBase64Url(value)));
  } catch {
    return null;
  }
}

const DOOR_LABELS = { none: "Sin puertas", hinged: "Puertas batientes", sliding: "Puertas corredizas" } as const;
const HANDLE_LABELS = { bar: "barral", knob: "botón", none: "sin tirador" } as const;
const SHAPE_LABELS = { straight: "Recto", "l-left": "En L, lateral a la izquierda", "l-right": "En L, lateral a la derecha" } as const;
const cm = (mm: number) => `${Math.round(mm / 10)} cm`;

/** una línea por tramo, con sus módulos */
function runLines(config: WardrobeConfig): string {
  return config.runs
    .map((run, r) => {
      const name = config.runs.length > 1 ? (r === 0 ? "Frente" : "Lateral") : "Módulos";
      const modules = run.modules
        .map((m, i) => {
          const extra = m.layout === "shelves" || m.layout === "drawers-shelves" ? `, ${m.shelves} estantes` : "";
          const drawers = m.drawers ? `, ${m.drawers} cajones` : "";
          return `  ${i + 1}. ${LAYOUT_LABELS[m.layout]} (${cm(m.width)})${drawers}${extra}`;
        })
        .join("\n");
      return `${name} (${cm(run.width)}):\n${modules}`;
    })
    .join("\n");
}

/** el resumen que el cliente manda al taller */
export function orderMessage(config: WardrobeConfig, price: string, link: string): string {
  const extras = [
    config.topBox.enabled ? `Altillo de ${cm(config.topBox.height)}` : "",
    config.slope.enabled ? `Techo inclinado: lado bajo de ${cm(config.slope.low)} a la ${config.slope.side === "left" ? "izquierda" : "derecha"}` : "",
    config.curved.left || config.curved.right
      ? `Terminal curvo ${config.curved.left && config.curved.right ? "en los dos extremos" : config.curved.left ? "a la izquierda" : "a la derecha"}`
      : "",
    hasLeds(config)
      ? `Luz LED ${config.led.color === "rgb" ? `RGB (${config.led.rgb})` : LED_COLORS[config.led.color].label.toLowerCase()}${config.led.sensor && config.doors !== "none" ? ", con sensor al abrir" : ""}`
      : "",
  ].filter(Boolean);
  const doors =
    config.doors === "none" ? DOOR_LABELS.none : `${DOOR_LABELS[config.doors]}, frente ${DOOR_STYLE_LABELS[config.doorStyle].toLowerCase()} (${HANDLE_LABELS[config.handle]})`;
  return [
    `Hola ${catalog.brand.name}, armé este placard en la web:`,
    "",
    `Forma: ${SHAPE_LABELS[config.shape]}`,
    `Alto ${cm(totalHeight(config))} · profundidad ${cm(config.depth)}`,
    runLines(config),
    doors,
    ...extras,
    `Cuerpo: ${materialById(config.bodyMaterial).name}. Frentes: ${materialById(config.doorMaterial).name}`,
    `Precio estimado: ${price}`,
    "",
    `Mi diseño: ${link}`,
  ].join("\n");
}

export function whatsappLink(message: string): string {
  return `https://wa.me/${catalog.brand.whatsapp}?text=${encodeURIComponent(message)}`;
}
