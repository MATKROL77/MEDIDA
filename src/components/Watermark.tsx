import { catalog } from "@/lib/catalog";
import { product } from "@/lib/product";

/**
 * Marca de agua de la demo: el texto repetido en diagonal, muy suave, para
 * que la demo se pueda mandar y mostrar sin que pase por un sistema propio.
 * Desaparece sola cuando el catálogo deja de ser de demo.
 */
const tile = (text: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="260"><text x="210" y="140" text-anchor="middle" transform="rotate(-24 210 130)" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="6" fill="#1f1d1a" fill-opacity="0.075">${text}</text></svg>`;

export function Watermark({ fixed = false }: { fixed?: boolean }) {
  if (!catalog.brand.demo) return null;
  return (
    <div
      aria-hidden
      className={`pointer-events-none inset-0 z-[5] ${fixed ? "fixed" : "absolute"}`}
      style={{ backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(tile(product.watermark))}")`, backgroundRepeat: "repeat" }}
    />
  );
}

export function WatermarkNote({ className = "" }: { className?: string }) {
  if (!catalog.brand.demo) return null;
  return <p className={`pointer-events-none select-none text-[11px] font-medium tracking-wide text-ink-2/80 ${className}`}>{product.watermarkNote}</p>;
}
