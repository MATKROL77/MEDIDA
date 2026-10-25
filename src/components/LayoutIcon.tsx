import type { Layout } from "@/lib/model";

/** dibujito del interior de un módulo, para elegir sin leer */
export function LayoutIcon({ layout }: { layout: Layout }) {
  const shelf = (y: number) => <line x1="5" x2="35" y1={y} y2={y} />;
  const rod = (y: number) => (
    <>
      <line x1="8" x2="32" y1={y} y2={y} strokeWidth="1.2" />
      <path d={`M14 ${y} l-4 6 h8 z M24 ${y} l-4 6 h8 z`} strokeWidth="1" fill="none" />
    </>
  );
  const drawer = (y: number) => (
    <>
      <rect x="7" y={y} width="26" height="7" rx="1" />
      <line x1="17" x2="23" y1={y + 3.5} y2={y + 3.5} />
    </>
  );

  return (
    <svg viewBox="0 0 40 56" className="h-12 w-9" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="4" y="3" width="32" height="50" rx="1.5" />
      {layout === "shelves" && [15, 27, 39].map((y) => <g key={y}>{shelf(y)}</g>)}
      {layout === "hanging" && (
        <>
          {shelf(13)}
          {rod(17)}
        </>
      )}
      {layout === "double-hanging" && (
        <>
          {shelf(12)}
          {rod(15)}
          {shelf(32)}
          {rod(35)}
        </>
      )}
      {layout === "drawers-shelves" && (
        <>
          {drawer(44)}
          {drawer(35.5)}
          {shelf(32)}
          {shelf(22)}
          {shelf(12)}
        </>
      )}
      {layout === "drawers-hanging" && (
        <>
          {drawer(44)}
          {drawer(35.5)}
          {shelf(32)}
          {shelf(12)}
          {rod(15)}
        </>
      )}
    </svg>
  );
}
