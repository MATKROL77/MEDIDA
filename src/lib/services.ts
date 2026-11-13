/**
 * Los tres servicios que se le ofrecen a una empresa. El texto dice qué se
 * hace y cómo se trabaja; no lleva precios ni plazos, que salen de cada
 * propuesta.
 */

import type { Interest } from "./site.ts";

export type Service = {
  slug: string;
  interest: Interest;
  title: string;
  /** una línea, para la tarjeta */
  summary: string;
  /** para quién es */
  audience: string;
  includes: { title: string; body: string }[];
  steps: { title: string; body: string }[];
  /** lo que hoy no está resuelto y conviene saber antes de consultar */
  notes: string[];
};

export const SERVICES: Service[] = [
  {
    slug: "configurador-para-tu-web",
    interest: "configurador",
    title: "Configurador para tu web",
    summary: "Un configurador 3D con tus productos, tus materiales y tus reglas, integrado en la página que ya tenés.",
    audience: "Para fabricantes, carpinterías y comercios que ya tienen página y quieren que sus clientes armen el producto ahí mismo.",
    includes: [
      { title: "Tus productos y tus reglas", body: "Medidas mínimas y máximas, módulos, materiales y terminaciones según lo que de verdad fabricás." },
      { title: "Tu marca", body: "Tu nombre, tus colores y tu contacto. La consulta le llega a tu empresa, no a MEDIDA." },
      { title: "Integración en tu página", body: "Se inserta en tu sitio con un bloque de código o queda en un enlace propio para compartir en redes." },
      { title: "La consulta completa", body: "Cada consulta llega con las medidas, los materiales, los módulos y un enlace que abre el mismo diseño." },
    ],
    steps: [
      { title: "Relevamos tus productos", body: "Qué fabricás, con qué materiales y qué límites tiene cada medida." },
      { title: "Armamos una demostración", body: "Una versión con tus productos para que la pruebes antes de decidir." },
      { title: "Se integra en tu web", body: "Queda publicado en tu página y las consultas llegan a tu WhatsApp o tu email." },
    ],
    notes: ["Hay siete familias para probar. La de placares es la más completa (despiece dibujado, plano de corte y PDF); en las demás, lo que tu producto necesite de más se desarrolla sobre el mismo motor."],
  },
  {
    slug: "web-completa",
    interest: "web-configurador",
    title: "Web completa + configurador",
    summary: "Una página profesional con catálogo, carrito de consulta, configuradores y un sistema de consultas ordenado.",
    audience: "Para empresas que todavía no tienen página, o que quieren rehacerla alrededor de sus productos a medida.",
    includes: [
      { title: "Página institucional y catálogo", body: "Quién sos, qué fabricás y cada producto con sus opciones." },
      { title: "Configuradores integrados", body: "Los productos a medida se arman en 3D dentro de la misma página." },
      { title: "Carrito de consulta", body: "El cliente junta varios productos configurados y manda una sola consulta con todo." },
      { title: "Diseño para celular", body: "Pensada primero para el teléfono, que es desde donde llega la mayoría de las consultas." },
    ],
    steps: [
      { title: "Definimos el alcance", body: "Qué secciones lleva la página y qué productos se configuran." },
      { title: "Diseño y contenido", body: "Con tu marca, tus fotos y tus textos." },
      { title: "Publicación", body: "La página queda online, con los configuradores y las consultas funcionando." },
    ],
    notes: ["El carrito no cobra: junta productos para pedir una cotización. Sumar pagos online es un trabajo aparte."],
  },
  {
    slug: "plataforma",
    interest: "plataforma",
    title: "Plataforma de configuradores",
    summary: "Varios configuradores para distintas familias de producto, administrados desde una misma cuenta.",
    audience: "Para empresas con más de una línea de producto, o con varias marcas o sucursales.",
    includes: [
      { title: "Una cuenta por empresa", body: "Tus configuradores, tus materiales y las consultas de tus clientes, separados de los de cualquier otra empresa." },
      { title: "Un configurador por familia", body: "Cada línea de producto con sus propias medidas, materiales y reglas comerciales." },
      { title: "Consultas y uso en un solo lugar", body: "Cuántas veces se abrió cada configurador y qué consultas generó." },
      { title: "Plan según cantidad", body: "La cantidad de configuradores habilitados depende del plan que contrates." },
    ],
    steps: [
      { title: "Elegimos las familias", body: "Con qué líneas de producto conviene empezar." },
      { title: "Se configura cada una", body: "Sobre componentes compartidos: no se arma una solución distinta desde cero para cada producto." },
      { title: "Crece con tu catálogo", body: "Se suman configuradores a medida que hacen falta." },
    ],
    notes: [
      "La facturación recurrente todavía no está integrada: hoy cada plan se acuerda y se cobra por fuera de la plataforma.",
      "El panel de la empresa está en una primera versión: muestra los configuradores, las consultas y el uso.",
    ],
  },
];

export const serviceBySlug = (slug: string): Service | undefined => SERVICES.find((s) => s.slug === slug);
