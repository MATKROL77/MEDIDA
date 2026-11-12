import type { Assembly } from "@/lib/assembly";
import { materialById } from "@/lib/catalog";
import type { WardrobeConfig } from "@/lib/model";

/**
 * Vista de frente dibujada en SVG. Es lo primero que se ve, antes de que
 * cargue el 3D: así nunca hay una pantalla vacía ni un cartel de "cargando".
 * Cuando el 3D está listo aparece encima con un fundido.
 */
export function Poster({ config, assembly }: { config: WardrobeConfig; assembly: Assembly }) {
  const run = assembly.runs[0];
  const { min, max } = assembly.bounds;
  const w = max[0] - min[0];
  const h = max[1];
  const pad = Math.max(w, h) * 0.18;
  const door = materialById(config.doorMaterial).color;
  const body = materialById(config.bodyMaterial).color;
  // de atrás hacia adelante, así los frentes tapan el interior
  const parts = [...run.parts]
    .filter((p) => p.kind !== "glow" && p.kind !== "led" && p.geometry !== "none")
    .sort((a, b) => a.position[2] + a.size[2] - (b.position[2] + b.size[2]));

  return (
    <div className="absolute inset-0 grid place-items-center bg-[#f0efed]">
      <svg
        viewBox={`${min[0] - pad} ${-h - pad * 0.6} ${w + 2 * pad} ${h + pad * 1.2}`}
        className="h-[78%] w-[78%] drop-shadow-[0_18px_24px_rgba(60,40,20,0.12)]"
        aria-hidden
      >
        {parts.map((p) => (
          <rect
            key={p.id}
            x={p.position[0]}
            y={-(p.position[1] + p.size[1])}
            width={p.size[0]}
            height={p.size[1]}
            fill={p.front ? door : p.material === "back" ? "#e2ddd4" : body}
            stroke="rgba(40,30,20,0.18)"
            strokeWidth={3}
          />
        ))}
      </svg>
    </div>
  );
}
