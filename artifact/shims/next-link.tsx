import type { AnchorHTMLAttributes, ReactNode } from "react";

/**
 * Reemplazo de next/link para la versión de prueba: los links internos
 * (/demo/...) cambian de vista dentro de la misma página en vez de navegar.
 */
export default function Link({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) {
  const internal = href.startsWith("/");
  return (
    <a
      {...rest}
      href={internal ? "#" : href}
      onClick={(e) => {
        if (!internal) return;
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("artifact-nav", { detail: href }));
      }}
    >
      {children}
    </a>
  );
}
