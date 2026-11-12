"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useAccount, type Account } from "@/lib/account";

/** deja pasar solo a quien corresponde; a los demás les dice por qué no */
export function Gate({ title, allow, children }: { title: string; allow: (account: Account) => boolean; children: (account: Account) => ReactNode }) {
  const { status, account } = useAccount();
  if (status === "activo" && account && allow(account)) return <>{children(account)}</>;
  return (
    <div className="wrap grid min-h-[60dvh] place-items-center py-20 text-center">
      <div>
        <p className="eyebrow">{title}</p>
        {status === "desconocido" ? (
          <h1 className="display-md mt-4" role="status">
            Un momento…
          </h1>
        ) : (
          <>
            <h1 className="display-lg mt-4">{status === "activo" ? "Tu cuenta no tiene acceso a esta página." : "Entrá con tu cuenta para ver esta página."}</h1>
            <Link href="/cuenta/" className="btn btn-primary mt-8">
              {status === "activo" ? "Ir a mi cuenta" : "Entrar"}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export const fmtDate = (ms: number) => new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(ms));
export const fmtMoney = (value: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
