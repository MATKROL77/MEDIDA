/**
 * Dibujo de línea de cada familia que todavía no tiene configurador. Es un
 * esquema, a propósito: no se muestra como una foto del producto terminado
 * porque el configurador de esa familia no existe todavía.
 */

const COTA = "var(--color-accent)";

/** cota horizontal: línea con topes y la medida en el medio */
function CotaH({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  return (
    <g stroke={COTA} strokeWidth="1.2" opacity="0.85">
      <path d={`M${x1} ${y - 5}v10M${x2} ${y - 5}v10M${x1} ${y}H${x2}`} />
    </g>
  );
}
function CotaV({ y1, y2, x }: { y1: number; y2: number; x: number }) {
  return (
    <g stroke={COTA} strokeWidth="1.2" opacity="0.85">
      <path d={`M${x - 5} ${y1}h10M${x - 5} ${y2}h10M${x} ${y1}V${y2}`} />
    </g>
  );
}

const SHAPES: Record<string, React.ReactNode> = {
  mesas: (
    <>
      <rect x="70" y="118" width="260" height="12" rx="2" />
      <path d="M84 130v102M96 130v102M84 232h12M304 130v102M316 130v102M304 232h12" />
      <rect x="226" y="130" width="78" height="62" rx="2" />
      <path d="M226 161h78M258 145.5h14M258 176.5h14" />
      <CotaH x1={70} x2={330} y={92} />
      <CotaV y1={118} y2={232} x={44} />
    </>
  ),
  ratonas: (
    <>
      <rect x="44" y="176" width="176" height="10" rx="2" />
      <path d="M56 186v46M208 186v46M56 214h152" />
      <rect x="272" y="140" width="84" height="80" rx="2" />
      <path d="M272 180h84M306 160h16M306 200h16M282 220v12M346 220v12" />
      <CotaH x1={44} x2={220} y={152} />
      <CotaV y1={140} y2={232} x={382} />
    </>
  ),
  tv: (
    <>
      <rect x="112" y="52" width="176" height="104" rx="5" opacity="0.5" />
      <rect x="40" y="184" width="320" height="50" rx="2" />
      <path d="M120 184v50M200 184v50M280 184v50M200 209h80M232 196.5h16M232 221.5h16M108 204v10M292 204v10" />
      <path d="M56 234v10M344 234v10" />
      <CotaH x1={40} x2={360} y={268} />
    </>
  ),
  bibliotecas: (
    <>
      <rect x="112" y="34" width="176" height="212" rx="2" />
      <path d="M170 34v212M230 34v212" />
      <path d="M112 84h58M112 134h58M112 184h176M170 70h60M170 110h60M170 150h60M230 96h58M230 140h58" />
      <path d="M163 210v12M177 210v12M223 210v12M237 210v12" />
      <CotaV y1={34} y2={246} x={84} />
      <CotaH x1={112} x2={288} y={270} />
    </>
  ),
  sillones: (
    <>
      <rect x="62" y="112" width="92" height="62" rx="8" />
      <rect x="154" y="112" width="92" height="62" rx="8" />
      <rect x="246" y="112" width="92" height="62" rx="8" />
      <rect x="62" y="174" width="92" height="40" rx="6" />
      <rect x="154" y="174" width="92" height="40" rx="6" />
      <rect x="246" y="174" width="92" height="40" rx="6" />
      <rect x="40" y="140" width="22" height="78" rx="8" />
      <rect x="338" y="140" width="22" height="78" rx="8" />
      <path d="M74 218v12M326 218v12M200 218v12" />
      <CotaH x1={40} x2={360} y={82} />
    </>
  ),
};

export function FamilyDrawing({ id, className = "" }: { id: string; className?: string }) {
  return (
    <svg viewBox="0 0 400 300" className={className} fill="none" stroke="var(--color-ink-3)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* el piso */}
      <path d="M24 246h352" stroke="var(--color-line)" strokeWidth="1.2" />
      {SHAPES[id] ?? null}
    </svg>
  );
}
