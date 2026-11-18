/**
 * Cómo se arma una textura grande y sin repetición a partir de una foto chica
 * que empalma consigo misma. Lo usa scripts/textures.mjs al preparar las
 * chapas y los pisos de madera; acá está solo la cuenta (qué pedazo de la foto
 * va en cada lugar), sin imágenes, para poder probarla.
 *
 * Una foto de chapa cubre 1 m: repetida en una puerta de 2,4 m se le ven los
 * mismos dibujos cada metro. Una placa enchapada de verdad se arma con hojas
 * de 10 a 25 cm pegadas una al lado de la otra, cada una de un tono apenas
 * distinto: se hace lo mismo, con cada hoja sacada de otro lugar de la foto.
 * Un piso se arma con tablas: cada tabla de la foto se usa varias veces, dada
 * vuelta de las cuatro maneras posibles y con las juntas corridas.
 */

/** pseudoaleatorio con semilla: la misma textura cada vez que se genera */
export function seeded(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** ida y vuelta: 0, 1 … n-1, n-1 … 1, 0 y de nuevo. Recorre la foto sin saltos y sin repetirla de corrido */
export function pingPong(i: number, n: number): number {
  const m = ((i % (2 * n)) + 2 * n) % (2 * n);
  return m < n ? m : 2 * n - 1 - m;
}

export type Leaf = {
  /** dónde empieza y dónde termina la hoja, en píxeles de la textura armada */
  from: number;
  to: number;
  /** de qué lugar de la foto sale: corrimiento a lo ancho y a lo largo de la veta */
  across: number;
  along: number;
  /** dada vuelta, como una hoja espejada contra su vecina */
  mirror: boolean;
  /** cuánto más clara u oscura que el promedio (1 = igual) */
  gain: number;
};

/**
 * Las hojas de chapa de una placa de `width` píxeles: anchos entre `min` y
 * `max`, sin huecos ni encimes, y la última termina justo en el borde (la
 * textura empalma consigo misma).
 */
export function leafLayout(width: number, source: number, opts: { seed: number; min: number; max: number; tone: number }): Leaf[] {
  const rand = seeded(opts.seed);
  const leaves: Leaf[] = [];
  let x = 0;
  while (x < width) {
    let w = Math.round(opts.min + rand() * (opts.max - opts.min));
    // lo que sobra no puede quedar más angosto que una hoja: se reparte
    if (width - (x + w) < opts.min) w = width - x;
    leaves.push({
      from: x,
      to: x + w,
      across: Math.floor(rand() * source),
      along: Math.floor(rand() * source * 2),
      mirror: rand() < 0.5,
      gain: 1 + (rand() * 2 - 1) * opts.tone,
    });
    x += w;
  }
  return leaves;
}

/**
 * El veteado ancho de una placa: bandas a lo largo de la veta, unas más claras
 * y otras más oscuras, que es lo que hace que una madera no parezca un color
 * liso. Devuelve una ganancia por columna (alrededor de 1) que empalma en los
 * bordes: suma de ondas enteras, las anchas más fuertes que las finas.
 */
export function streaks(width: number, opts: { seed: number; strength: number; waves?: number }): Float32Array {
  const rand = seeded(opts.seed);
  const waves = opts.waves ?? 48;
  const out = new Float32Array(width);
  let peak = 0;
  for (let k = 2; k <= waves; k++) {
    const phase = rand() * Math.PI * 2;
    const amp = (0.4 + rand() * 0.6) / Math.pow(k, 0.85);
    for (let x = 0; x < width; x++) out[x] += amp * Math.sin((2 * Math.PI * k * x) / width + phase);
  }
  for (let x = 0; x < width; x++) peak = Math.max(peak, Math.abs(out[x]));
  for (let x = 0; x < width; x++) out[x] = 1 + (out[x] / (peak || 1)) * opts.strength;
  return out;
}

export type Plank = {
  /** qué tabla de la foto es */
  source: number;
  /** dada vuelta de punta a punta y de canto a canto */
  flipLength: boolean;
  flipWidth: boolean;
  gain: number;
};

export type PlankRow = {
  /** dónde cae la junta entre las dos tablas de la hilera, de 0 a 1 del largo de una tabla */
  joint: number;
  planks: [Plank, Plank];
};

/**
 * Un piso del doble de ancho y del doble de largo que la foto: el doble de
 * hileras, dos tablas por hilera. Cada tabla de la foto entra cuatro veces,
 * una por cada manera de darla vuelta (así ninguna se ve dos veces igual), dos
 * hileras vecinas nunca traen la misma tabla y las juntas quedan trabadas: la
 * de una hilera nunca cae cerca de la de la hilera de al lado.
 */
export function plankLayout(rows: number, opts: { seed: number; tone: number }): PlankRow[] {
  const rand = seeded(opts.seed);
  const total = rows * 2;
  // cuatro vueltas, cada una con todas las tablas de la foto en otro orden y dadas vuelta de
  // otra manera. Las hileras toman las tablas de a dos; una vuelta se vuelve a barajar hasta
  // que ninguna hilera repita tabla con la de al lado (ni la última con la primera)
  const order: number[] = [];
  const fits = (seq: number[], closed: boolean) => {
    const count = Math.floor(seq.length / 2);
    for (let r = 0; r < count; r++) {
      const a = [seq[r * 2], seq[r * 2 + 1]];
      if (a[0] === a[1]) return false;
      if (r + 1 >= count && !closed) continue;
      const n = (r + 1) % count;
      if (a.includes(seq[n * 2]) || a.includes(seq[n * 2 + 1])) return false;
    }
    return true;
  };
  for (let turn = 0; turn < 4; turn++) {
    let lap: number[] = [];
    for (let attempt = 0; attempt < 500; attempt++) {
      lap = Array.from({ length: rows }, (_, i) => i);
      for (let i = lap.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [lap[i], lap[j]] = [lap[j], lap[i]];
      }
      if (fits([...order, ...lap], turn === 3)) break;
    }
    order.push(...lap);
  }
  const picked: [Plank, Plank][] = [];
  for (let r = 0; r < total; r++) {
    const plank = (i: number): Plank => {
      const turn = Math.floor(i / rows);
      return { source: order[i], flipLength: (turn & 1) === 1, flipWidth: (turn & 2) === 2, gain: 1 };
    };
    picked.push([plank(r * 2), plank(r * 2 + 1)]);
  }
  const out: PlankRow[] = [];
  let last = rand();
  for (let r = 0; r < total; r++) {
    // la junta se corre entre un cuarto y tres cuartos de tabla respecto de la hilera anterior
    let joint = (last + 0.25 + rand() * 0.5) % 1;
    // la última hilera también tiene que quedar trabada con la primera
    if (r === total - 1) {
      const first = out[0].joint;
      const far = (a: number, b: number) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b));
      for (let k = 0; k < 20 && (far(joint, first) < 0.2 || far(joint, last) < 0.2); k++) joint = rand();
    }
    last = joint;
    out.push({
      joint,
      planks: picked[r].map((p) => ({ ...p, gain: 1 + (rand() * 2 - 1) * opts.tone })) as [Plank, Plank],
    });
  }
  return out;
}
