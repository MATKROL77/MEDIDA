import { site } from "@/lib/site";

/**
 * La marca: una cota (la línea con dos topes que señala una medida en un
 * plano) y el nombre. Es propia de MEDIDA.
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 26 14" width="26" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
        <path d="M1.5 1.5v11M24.5 1.5v11M1.5 7h23" />
      </svg>
      <span className="font-display text-[1.12rem] tracking-[0.2em]">{site.name}</span>
    </span>
  );
}
