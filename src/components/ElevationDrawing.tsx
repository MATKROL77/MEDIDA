import type { Assembly, Part } from "@/lib/assembly";
import { materialById } from "@/lib/catalog";
import { DOOR_STYLE_LABELS, PLINTH_HEIGHT, leafLook, moduleOffsets, type WardrobeConfig } from "@/lib/model";

const INK = "#14213d";
const SOFT = "rgba(20,33,61,0.55)";

/** cota horizontal: línea con topes y la medida encima */
function DimH({ x1, x2, y, text, size }: { x1: number; x2: number; y: number; text: string; size: number }) {
  return (
    <g stroke={INK} strokeWidth={size * 0.06} fill="none">
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <line x1={x1} y1={y - size * 0.4} x2={x1} y2={y + size * 0.4} />
      <line x1={x2} y1={y - size * 0.4} x2={x2} y2={y + size * 0.4} />
      <text x={(x1 + x2) / 2} y={y - size * 0.45} textAnchor="middle" fontSize={size} fill={INK} stroke="none">
        {text}
      </text>
    </g>
  );
}

function DimV({ x, y1, y2, text, size }: { x: number; y1: number; y2: number; text: string; size: number }) {
  return (
    <g stroke={INK} strokeWidth={size * 0.06} fill="none">
      <line x1={x} y1={y1} x2={x} y2={y2} />
      <line x1={x - size * 0.4} y1={y1} x2={x + size * 0.4} y2={y1} />
      <line x1={x - size * 0.4} y1={y2} x2={x + size * 0.4} y2={y2} />
      <text x={x - size * 0.5} y={(y1 + y2) / 2} textAnchor="middle" fontSize={size} fill={INK} stroke="none" transform={`rotate(-90 ${x - size * 0.5} ${(y1 + y2) / 2})`}>
        {text}
      </text>
    </g>
  );
}

const isFront = (p: Part) => p.kind === "sliding-door" || p.kind === "door";
const TAG: Partial<Record<Part["kind"], string>> = { shelf: "Estante", "fixed-shelf": "Estante fijo", rod: "Barral" };

/**
 * Plano de frente para el taller, sin puertas: qué va en cada módulo y a qué
 * altura. Sale del mismo despiece que el 3D, así que muestra exactamente lo que
 * la persona armó. Medidas en mm; las alturas se miden desde el piso.
 */
export function InteriorElevation({ config, assembly }: { config: WardrobeConfig; assembly: Assembly }) {
  const run = assembly.runs[0];
  const W = config.runs[0].width;
  const H = config.height;
  const size = Math.max(W, H) * 0.021;
  const pad = size * 6;
  const mods = config.runs[0].modules;
  const xs = moduleOffsets(mods);
  const parts = run.parts.filter((p) => !isFront(p) && !p.decor && p.kind !== "glow" && p.kind !== "led" && p.kind !== "back" && p.geometry !== "none" && p.kind !== "drawer-side" && p.kind !== "drawer-bottom");
  // un cajón o una bandeja se rotula una vez, en su frente
  const tagged = parts.filter((p) => TAG[p.kind] || p.kind === "drawer-front");
  const z = config.plinth ? PLINTH_HEIGHT : 0;

  return (
    <svg viewBox={`${-pad * 1.4} ${-H - pad * 1.2} ${W + pad * 2.4} ${H + pad * 2.6}`} className="w-full" role="img" aria-label="Plano de frente del interior, con medidas">
      <rect x={-pad * 1.4} y={-H - pad * 1.2} width={W + pad * 2.4} height={H + pad * 2.6} fill="#fff" />
      {parts.map((p) => {
        const tray = p.label === "Frente de bandeja";
        const drawer = p.kind === "drawer-front" && !tray;
        const rod = p.kind === "rod";
        return (
          <rect
            key={p.id}
            x={p.position[0]}
            y={-(p.position[1] + p.size[1])}
            width={p.size[0]}
            height={Math.max(p.size[1], rod ? size * 0.35 : 0)}
            fill={drawer ? "rgba(20,33,61,0.07)" : tray ? "rgba(47,107,79,0.16)" : rod ? INK : "#fff"}
            stroke={INK}
            strokeWidth={size * 0.07}
          />
        );
      })}
      {tagged.map((p) => {
        const tray = p.label === "Frente de bandeja";
        const name = tray ? "Bandeja" : p.kind === "drawer-front" ? "Cajón" : TAG[p.kind]!;
        const y = p.position[1];
        return (
          <text key={`t-${p.id}`} x={p.position[0] + p.size[0] / 2} y={-(y + p.size[1]) - size * 0.35} textAnchor="middle" fontSize={size * 0.8} fill={SOFT}>
            {name} · {Math.round(y)}
          </text>
        );
      })}
      {mods.map((m, i) => (
        <g key={i}>
          <DimH x1={xs[i]} x2={xs[i] + m.width} y={size * 2.4} text={`M${i + 1} · ${Math.round(m.width)}`} size={size} />
        </g>
      ))}
      <DimH x1={0} x2={W} y={-H - size * 2.2} text={`Ancho total ${Math.round(W)}`} size={size * 1.1} />
      <DimV x={-size * 2.6} y1={-H} y2={0} text={`Alto ${Math.round(H)}`} size={size * 1.1} />
      {z > 0 && (
        <text x={W + size * 0.8} y={-z / 2 + size * 0.3} fontSize={size * 0.8} fill={SOFT}>
          Zócalo {z}
        </text>
      )}
      <text x={0} y={size * 5.2} fontSize={size * 0.85} fill={SOFT}>
        Medidas en mm. La cifra junto a cada pieza es su altura desde el piso. Profundidad total: {Math.round(config.depth)}.
      </text>
    </svg>
  );
}

/** las hojas corredizas de frente: cuál es cuál, con su frente y su terminación */
export function DoorsElevation({ config, assembly }: { config: WardrobeConfig; assembly: Assembly }) {
  const leaves = assembly.runs[0].parts.filter((p) => p.kind === "sliding-door");
  const W = config.runs[0].width;
  const H = config.height;
  const size = Math.max(W, H) * 0.024;
  const pad = size * 4;
  return (
    <svg viewBox={`${-pad} ${-H - pad} ${W + pad * 2} ${H + pad * 2.4}`} className="w-full" role="img" aria-label="Frente con las hojas corredizas">
      <rect x={-pad} y={-H - pad} width={W + pad * 2} height={H + pad * 2.4} fill="#fff" />
      <rect x={0} y={-H} width={W} height={H} fill="none" stroke={INK} strokeWidth={size * 0.08} />
      {leaves.map((p, k) => {
        const look = leafLook(config, k);
        const special = look.style === "mirror" || look.style === "glass";
        const fill = look.style === "mirror" ? "#dfe7ea" : look.style === "glass" ? "#c9d3d6" : materialById(look.material).color;
        const cx = p.position[0] + p.size[0] / 2;
        const cy = -(p.position[1] + p.size[1] / 2);
        return (
          <g key={p.id}>
            <rect x={p.position[0]} y={-(p.position[1] + p.size[1])} width={p.size[0]} height={p.size[1]} fill={fill} fillOpacity={0.75} stroke={INK} strokeWidth={size * 0.07} />
            <text x={cx} y={cy - size * 0.5} textAnchor="middle" fontSize={size * 1.1} fontWeight={600} fill={INK}>
              Hoja {k + 1}
            </text>
            <text x={cx} y={cy + size * 0.9} textAnchor="middle" fontSize={size * 0.85} fill={INK}>
              {DOOR_STYLE_LABELS[look.style]}
              {special ? "" : ` · ${materialById(look.material).name}`}
            </text>
            <text x={cx} y={cy + size * 2.1} textAnchor="middle" fontSize={size * 0.8} fill={SOFT}>
              {Math.round(p.size[0])} × {Math.round(p.size[1])} · riel {p.slide?.track === 0 ? "de adelante" : "de atrás"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
