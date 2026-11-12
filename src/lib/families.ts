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
    summary: "Tapa, patas y medidas a elección, con cajonera o pasacables para el escritorio.",
    status: "desarrollo",
    options: ["Largo, ancho y alto", "Tipo de pata", "Cajonera y pasacables", "Material de la tapa"],
  },
  {
    id: "ratonas",
    name: "Mesas ratonas y de luz",
    noun: "mesa",
    summary: "Piezas chicas con cajones o estantes abiertos, en la terminación del resto del ambiente.",
    status: "desarrollo",
    options: ["Medidas", "Cajones o estante abierto", "Patas o zócalo", "Terminación"],
  },
  {
    id: "tv",
    name: "Muebles para televisión",
    noun: "mueble para TV",
    summary: "Bajos de piso o flotantes, con puertas, cajones, nichos abiertos y paso de cables.",
    status: "desarrollo",
    options: ["Largo y altura", "Puertas, cajones y nichos", "De piso o flotante", "Paso de cables"],
  },
  {
    id: "bibliotecas",
    name: "Bibliotecas y estanterías",
    noun: "biblioteca",
    summary: "Columnas y estantes a medida de la pared, con o sin fondo y con puertas abajo.",
    status: "desarrollo",
    options: ["Ancho, alto y profundidad", "Cantidad de columnas y estantes", "Con o sin fondo", "Puertas en la parte baja"],
  },
  {
    id: "sillones",
    name: "Sillones modulares",
    noun: "sillón",
    summary: "Módulos que se combinan: cuerpos, esquinas, chaise y puff, con el tapizado a elección.",
    status: "desarrollo",
    options: ["Cantidad y orden de módulos", "Esquina y chaise", "Tapizado y color", "Altura de respaldo"],
  },
];

export const familyById = (id: string): Family | undefined => FAMILIES.find((f) => f.id === id);
export const demoFamilies = (): Family[] => FAMILIES.filter((f) => f.status === "demo");
