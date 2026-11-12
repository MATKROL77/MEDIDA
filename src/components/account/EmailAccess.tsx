"use client";

import Link from "next/link";
import { useState } from "react";

import { requestAccess, verifyAccess } from "@/lib/account";
import { ApiError } from "@/lib/api";
import { isValidEmail } from "@/lib/site";

const ERRORS: Record<string, string> = {
  email_invalido: "Revisá el email: no parece una dirección válida.",
  demasiados_pedidos: "Hiciste varios pedidos seguidos. Esperá unos minutos y probá de nuevo.",
  email_no_disponible: "El acceso por email todavía no está activo en este sitio.",
  no_se_pudo_enviar: "No se pudo mandar el email. Probá de nuevo en un momento.",
  enlace_invalido: "El código no es correcto o ya venció. Pedí uno nuevo.",
  sin_conexion: "No hay conexión. Revisá tu internet y probá de nuevo.",
};
const explain = (error: unknown) => (error instanceof ApiError ? (ERRORS[error.code] ?? "Algo salió mal. Probá de nuevo.") : "Algo salió mal. Probá de nuevo.");

/**
 * "Guardá tu diseño y continuá cuando quieras": pide el email y confirma con
 * el enlace o el código que llega a esa casilla. Sin contraseña.
 *
 * Las novedades comerciales van en una casilla aparte, sin tildar: crear la
 * cuenta no suma a nadie a ninguna lista.
 */
export function EmailAccess({ onDone }: { onDone?: (designId: string | null) => void }) {
  const [email, setEmail] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim().toLowerCase();
    if (!isValidEmail(address)) return setError(ERRORS.email_invalido);
    setBusy(true);
    setError(null);
    try {
      await requestAccess(address, marketing);
      setSent(true);
    } catch (err) {
      setError(explain(err));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError("El código tiene seis números.");
    setBusy(true);
    setError(null);
    try {
      const { designId } = await verifyAccess({ email: email.trim().toLowerCase(), code });
      onDone?.(designId);
    } catch (err) {
      setError(explain(err));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <form onSubmit={confirm} className="space-y-4">
        <p className="leading-relaxed text-ink-2">
          Te mandamos un email a <strong className="font-semibold text-ink">{email.trim().toLowerCase()}</strong>. Abrí el enlace desde este dispositivo, o escribí acá el
          código de seis números. Vence en 15 minutos.
        </p>
        <div>
          <label htmlFor="access-code" className="text-sm font-medium">
            Código
          </label>
          <input
            id="access-code"
            className="field mt-2 max-w-[12rem] text-center text-xl tracking-[0.3em] tabular-nums"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-accent-strong">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" className="btn btn-primary disabled:opacity-50" disabled={busy}>
            {busy ? "Comprobando…" : "Entrar"}
          </button>
          <button
            type="button"
            className="text-sm text-ink-2 underline underline-offset-4 hover:text-ink"
            onClick={() => {
              setSent(false);
              setCode("");
              setError(null);
            }}
          >
            Usar otro email
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={ask} className="space-y-4" noValidate>
      <div>
        <label htmlFor="access-email" className="text-sm font-medium">
          Tu email
        </label>
        <input id="access-email" type="email" className="field mt-2" autoComplete="email" placeholder="nombre@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-ink-2">
        <input type="checkbox" className="mt-1 size-4 shrink-0 accent-[var(--color-ink)]" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
        <span>Quiero recibir novedades de MEDIDA por email. Es opcional y lo podés cambiar cuando quieras.</span>
      </label>
      {error && (
        <p role="alert" className="text-sm text-accent-strong">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary disabled:opacity-50" disabled={busy}>
        {busy ? "Enviando…" : "Recibir mi acceso"}
      </button>
      <p className="text-xs leading-relaxed text-ink-2">
        Sin contraseña: te llega un enlace y un código. El email se usa para darte acceso a tus diseños y, si los activás, para los recordatorios.{" "}
        <Link href="/privacidad/" className="underline underline-offset-2 hover:text-ink">
          Política de privacidad
        </Link>
        .
      </p>
    </form>
  );
}
