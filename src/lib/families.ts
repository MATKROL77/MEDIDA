/**
 * Familias de producto de MEDIDA.
 *
 * `demo` quiere decir que hay un configurador funcionando que se puede probar
 * hoy. `desarrollo` quiere decir que todavía no existe: se muestra para contar
 * hacia dónde va el producto, y nunca como si ya estuviera hecho.
 */

export type FamilyStatus = "demo" | "desarrollo";

export type Family = {
  id: string;
  name: string;
  /** en singular y minúscula, para armar frases: "tu placard" */
  noun: string;
  summary: string;
  status: FamilyStatus;
  /** dónde se prueba; solo las que tienen demo */
  href?: string;
  /** qué se puede configurar hoy (demo) o qué se va a poder configurar (desarrollo) */
  options: string[];
};

export const FAMILIES: Family[] = [
  {
    id: "placares",
    name: "Placares y vestidores",
    noun: "placard",
    summary: "Rectos o en L, con altillo, techo inclinado, puertas batientes o corredizas, cajones y luces LED.",
    status: "demo",
    href: "/demo/",
    options: ["Medidas al centímetro", "Módulos, estantes, barrales y cajones", "Frentes lisos, ranurados, espejo o vidrio", "Luz LED cálida, neutra, fría o RGB"],
  },
  {
    id: "mesas",
    name: "Mesas y escritorios",
    noun: "mesa",
    summary: "Tapa, patas y medidas a elección, con cajonera para el escritorio.",
    status: "demo",
    href: "/demo/mesas/",
    options: ["Largo, ancho y alto", "Patas de madera, de hierro o laterales llenos", "Cajonera para usarla de escritorio", "Terminación de la tapa y de la estructura"],
  },
  {
    id: "ratonas",
    name: "Mesas ratonas y de luz",
    noun: "mesa",
    summary: "Piezas chicas con cajones, en la terminación del resto del ambiente.",
    status: "demo",
    href: "/demo/ratonas/",
    options: ["Ratona o mesa de luz", "Ancho, profundidad y alto", "Hasta tres cajones", "Terminación del cuerpo y de la tapa"],
  },
  {
    id: "tv",
    name: "Muebles para televisión",
    noun: "mueble para TV",
    summary: "Bajos de piso o flotantes, con puertas, cajones y nichos abiertos.",
    status: "demo",
    href: "/demo/tv/",
    options: ["Largo, alto y profundidad", "Puertas, cajones o nichos", "De piso o flotante", "Terminación del cuerpo y de los frentes"],
  },
  {
    id: "bibliotecas",
    name: "Bibliotecas y estanterías",
    noun: "biblioteca",
    summary: "Columnas y estantes a medida de la pared, con o sin fondo y con puertas abajo.",
    status: "demo",
    href: "/demo/bibliotecas/",
    options: ["Ancho, alto y profundidad", "Cantidad de columnas y estantes", "Con o sin fondo", "Puertas en la parte baja"],
  },
  {
    id: "sillones",
    name: "Sillones modulares",
    noun: "sillón",
    summary: "Cuerpos que se suman, con chaise a un lado, apoyabrazos y el tapizado a elección.",
    status: "demo",
    href: "/demo/sillones/",
    options: ["De uno a cinco cuerpos", "Chaise a la izquierda o a la derecha", "Con o sin apoyabrazos", "Color del tapizado"],
  },
];

export const familyById = (id: string): Family | undefined => FAMILIES.find((f) => f.id === id);
export const demoFamilies = (): Family[] => FAMILIES.filter((f) => f.status === "demo");
