/**
 * Identidad de MEDIDA y contacto comercial.
 *
 * Es el único lugar donde viven el número de WhatsApp y el email de quien
 * vende MEDIDA. Todo botón de contacto sale de acá. Los valores de `contact`
 * son los de partida: el panel de administración los puede cambiar sin tocar
 * código, y el sitio toma el valor guardado cuando carga (ver SiteProvider).
 */

export const site = {
  name: "MEDIDA",
  tagline: "Configuradores 3D para productos a medida",
  description:
    "Convertí tus productos personalizados en experiencias interactivas de compra: tus clientes configuran medidas, materiales y módulos en 3D y te llega la consulta completa.",
  /** dirección pública, para enlaces canónicos y para compartir en redes */
  // el servidor también lee este archivo, y en Cloudflare no existe `process`
  url: ((typeof process !== "undefined" && process.env.NEXT_PUBLIC_SITE_URL) || "https://medida.matiascolimodio.workers.dev").replace(/\/+$/, ""),
  maker: "Matías Colimodio",
  makerCity: "Pilar, Buenos Aires",
  locale: "es-AR",
} as const;

export type Contact = {
  /** número para wa.me: solo dígitos, con código de país, sin + ni espacios */
  whatsapp: string;
  email: string;
};

export const defaultContact: Contact = {
  whatsapp: "5492324582614",
  email: "matiascolimodio@gmail.com",
};

/**
 * Qué le interesa a la empresa que escribe. El mensaje precargado lo dice,
 * así la conversación arranca sabiendo de qué servicio se trata.
 */
export const INTERESTS = {
  general: {
    label: "Conocer MEDIDA",
    message: "Hola, quiero conocer MEDIDA y ver cómo funcionaría con los productos de mi empresa.",
    subject: "Consulta sobre MEDIDA",
  },
  configurador: {
    label: "Un configurador para mi web",
    message: "Hola, quiero consultar por la implementación de un configurador 3D para mi empresa.",
    subject: "Configurador 3D para mi empresa",
  },
  web: {
    label: "Una página web",
    message: "Hola, me interesa contratar una página web profesional y quería conocer las opciones.",
    subject: "Página web profesional",
  },
  "web-configurador": {
    label: "Web completa con configuradores",
    message: "Hola, quiero una página web con configuradores de productos integrados.",
    subject: "Página web con configuradores",
  },
  plataforma: {
    label: "Varios configuradores",
    message: "Hola, quiero consultar por la plataforma de MEDIDA para tener varios configuradores de distintas familias de productos.",
    subject: "Plataforma de configuradores",
  },
  demo: {
    label: "Un configurador como la demo",
    message:
      "Hola, estuve probando MEDIDA y me interesa tener un configurador de este estilo para mi empresa. ¿Podemos hablar sobre cómo implementarlo?",
    subject: "Quiero un configurador como la demo",
  },
  demostracion: {
    label: "Una demostración personalizada",
    message: "Hola, quiero pedir una demostración personalizada de MEDIDA con los productos de mi empresa.",
    subject: "Demostración personalizada de MEDIDA",
  },
} as const;

export type Interest = keyof typeof INTERESTS;

export const isInterest = (value: unknown): value is Interest => typeof value === "string" && Object.hasOwn(INTERESTS, value);

/** interés por una familia de producto que todavía no tiene demo */
export function familyMessage(familyName: string): string {
  return `Hola, me interesa un configurador de ${familyName.toLowerCase()} para mi empresa. ¿Podemos hablar?`;
}

/** deja solo los dígitos: "+54 9 2324 58-2614" -> "5492324582614" */
export function cleanWhatsapp(value: string): string {
  return value.replace(/\D/g, "");
}

/** un número de WhatsApp con código de país tiene entre 8 y 15 dígitos (E.164) */
export function isValidWhatsapp(value: string): boolean {
  return /^[1-9]\d{7,14}$/.test(cleanWhatsapp(value));
}

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/**
 * Enlace oficial de WhatsApp con el mensaje precargado. Sin número abre el
 * selector de contactos del propio WhatsApp: sirve para compartir un diseño
 * con quien la persona quiera.
 */
export function whatsappLink(number: string | null, message: string): string {
  const to = number ? cleanWhatsapp(number) : "";
  return `https://wa.me/${to}?text=${encodeURIComponent(message)}`;
}

/** abre el programa de correo con asunto y texto precargados */
export function mailtoLink(email: string | null, subject: string, body: string): string {
  return `mailto:${email ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export type ContactChannel = "whatsapp" | "email";

/** el enlace de contacto comercial de MEDIDA para un interés y un canal */
export function contactLink(contact: Contact, channel: ContactChannel, interest: Interest, message?: string): string {
  const preset = INTERESTS[interest];
  const text = message ?? preset.message;
  return channel === "whatsapp" ? whatsappLink(contact.whatsapp, text) : mailtoLink(contact.email, preset.subject, text);
}

/** "+54 9 2324 58-2614": para mostrar el número, no para armar enlaces */
export function formatWhatsapp(value: string): string {
  const d = cleanWhatsapp(value);
  // celulares argentinos: 54 9, cuatro dígitos de característica y seis de número
  if (d.startsWith("549") && d.length === 13) {
    const rest = d.slice(3);
    return `+54 9 ${rest.slice(0, 4)} ${rest.slice(4, 6)}-${rest.slice(6)}`;
  }
  return `+${d}`;
}
