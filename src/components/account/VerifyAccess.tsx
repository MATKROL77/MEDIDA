"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { verifyAccess } from "@/lib/account";
import { getDesign } from "@/lib/designStore";
import { familyById } from "@/lib/families";

/**
 * A donde llega el enlace del email. El valor del enlace viene después del #,
 * que el navegador no le manda a ningún servidor al abrir la página; acá se
 * canjea y se saca de la dirección para que no quede en el historial.
 */
export function VerifyAccess() {
  const router = useRouter();
  const [state, setState] = useState<"comprobando" | "ok" | "invalido">("comprobando");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get("t");
    window.history.replaceState(null, "", window.location.pathname);
    if (!token) return setState("invalido");
    verifyAccess({ token })
      .then(({ designId }) => {
        setState("ok");
        // un recordatorio vuelve directo al diseño que quedó a medias
        const design = designId ? getDesign(designId) : null;
        const href = design ? familyById(design.type)?.href : null;
        router.replace(design && href ? `${href}?id=${design.id}` : "/mis-disenos/");
      })
      .catch(() => setState("invalido"));
  }, [router]);

  return (
    <div className="wrap grid min-h-[60dvh] place-items-center py-20 text-center">
      {state === "invalido" ? (
        <div>
          <p className="eyebrow">Mi cuenta</p>
          <h1 className="display-lg mt-4">Este enlace ya no sirve.</h1>
          <p className="lead mx-auto mt-5 max-w-md">Los enlaces de acceso vencen y se pueden usar una sola vez. Pedí uno nuevo y entrás en un momento.</p>
          <Link href="/cuenta/" className="btn btn-primary mt-8">
            Pedir un enlace nuevo
          </Link>
        </div>
      ) : (
        <div role="status">
          <p className="eyebrow">Mi cuenta</p>
          <h1 className="display-lg mt-4">{state === "ok" ? "Listo, entraste." : "Comprobando tu enlace…"}</h1>
          <p className="lead mx-auto mt-5 max-w-md">Un momento: traemos tus diseños.</p>
        </div>
      )}
    </div>
  );
}
