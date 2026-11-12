/**
 * La configuración viaja entera en el link (?c=...). Así el pedido que llega
 * por WhatsApp abre el mismo placard que armó el cliente, sin base de datos.
 */

import { fromBase64Url, toBase64Url } from "./base64url.ts";
import { catalog, materialById } from "./catalog.ts";
import type { DesignSummary } from "./designs.ts";
import { DOOR_STYLE_LABELS, LAYOUT_LABELS, LED_COLORS, hasLeds, normalize, totalHeight, type WardrobeConfig } from "./model.ts";
import { summaryByTitle, type CutRow } from "./quote.ts";

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

/** "10 × Estante con luz LED": una línea por tipo de pieza; las medidas van en el PDF */
export function pieceLines(rows: CutRow[]): string[] {
  return summaryByTitle(rows).map((r) => `• ${r.qty} × ${r.title}`);
}

/** cómo es el placard, una línea por cosa: forma, medidas, módulos, frentes, extras y materiales */
export function configLines(config: WardrobeConfig): string[] {
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
    `Forma: ${SHAPE_LABELS[config.shape]}`,
    `Alto ${cm(totalHeight(config))} · profundidad ${cm(config.depth)}`,
    runLines(config),
    doors,
    ...extras,
    `Cuerpo: ${materialById(config.bodyMaterial).name}. Frentes: ${materialById(config.doorMaterial).name}`,
  ];
}

/** "240 × 240 × 60 cm"; en L, los dos tramos: "280 + 200 × 240 × 60 cm" */
export function dimensionsLabel(config: WardrobeConfig): string {
  return `${config.runs.map((r) => Math.round(r.width / 10)).join(" + ")} × ${Math.round(totalHeight(config) / 10)} × ${Math.round(config.depth / 10)} cm`;
}

/** el resumen corto que se guarda con el diseño, para listarlo sin cargar el motor */
export function designSummary(config: WardrobeConfig): DesignSummary {
  const modules = config.runs.reduce((n, r) => n + r.modules.length, 0);
  const drawers = config.runs.reduce((n, r) => n + r.modules.reduce((m, mod) => m + mod.drawers, 0), 0);
  const extras = [config.topBox.enabled ? "altillo" : "", config.slope.enabled ? "techo inclinado" : "", config.curved.left || config.curved.right ? "terminal curvo" : ""].filter(Boolean);
  return {
    dimensions: dimensionsLabel(config),
    lines: [
      `${SHAPE_LABELS[config.shape]} · ${modules} ${modules === 1 ? "módulo" : "módulos"}${drawers ? ` · ${drawers} ${drawers === 1 ? "cajón" : "cajones"}` : ""}`,
      config.doors === "none" ? DOOR_LABELS.none : `${DOOR_LABELS[config.doors]}, frente ${DOOR_STYLE_LABELS[config.doorStyle].toLowerCase()}`,
      `Cuerpo ${materialById(config.bodyMaterial).name.toLowerCase()} · frentes ${materialById(config.doorMaterial).name.toLowerCase()}`,
      ...(hasLeds(config) ? [`Luz LED ${config.led.color === "rgb" ? "RGB" : LED_COLORS[config.led.color].label.toLowerCase()}`] : []),
      ...(extras.length ? [`Con ${extras.join(", ")}`] : []),
    ],
  };
}

/**
 * El resumen que el cliente le manda a quien fabrica. `recipient` es el nombre
 * de la empresa; sin él, el saludo queda abierto (la demo no tiene taller).
 */
export function orderMessage(
  config: WardrobeConfig,
  price: string,
  link: string,
  extra: { rows?: CutRow[]; workshopLink?: string; recipient?: string } = {},
): string {
  return [
    `Hola${extra.recipient ? ` ${extra.recipient}` : ""}, armé este placard en la web:`,
    "",
    ...configLines(config),
    `Precio estimado: ${price}`,
    ...(catalog.brand.samplePricing ? ["Valores orientativos de muestra; el fabricante debe validar medidas y costos."] : []),
    ...(extra.rows?.length ? ["", "Piezas:", ...pieceLines(extra.rows)] : []),
    "",
    `Mi diseño: ${link}`,
    ...(extra.workshopLink ? [`Despiece con dibujos de cada pieza: ${extra.workshopLink}`] : []),
  ].join("\n");
}
