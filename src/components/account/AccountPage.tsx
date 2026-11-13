"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useSite } from "@/components/site/SiteProvider";
import { deleteAccount, signOut, syncDesigns, updatePrefs, useAccount, type Account } from "@/lib/account";
import { useDesigns } from "@/lib/designStore";
import { disablePush, enablePush, pushSupport, type PushSupport } from "@/lib/push";

import { EmailAccess } from "./EmailAccess";

export function AccountPage() {
  const { status, account } = useAccount();
  const { features } = useSite();
  const saved = useDesigns().designs.length;

  return (
    <div className="wrap pb-20 pt-12 sm:pb-28 sm:pt-20">
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow">Mi cuenta</p>
        {status === "activo" && account ? (
          <Signed account={account} saved={saved} emailEnabled={features?.email === true} />
        ) : (
          <>
            <h1 className="display-lg mt-4">Guardá tu diseño y continuá cuando quieras.</h1>
            <p className="lead mt-5">
              Con tu email, tus diseños quedan en tu cuenta y los abrís desde cualquier dispositivo. No hace falta para probar los configuradores: es solo para no
              perder lo que armaste.
            </p>
            <div className="tile mt-10 p-6 sm:p-9">
              {status === "desconocido" || features === null ? (
                <div className="shimmer h-40 rounded-2xl" aria-hidden />
              ) : features.email ? (
                <EmailAccess />
              ) : (
                <div>
                  <h2 className="font-display text-xl font-semibold tracking-tight">El acceso con email todavía no está activo.</h2>
                  <p className="mt-3 leading-relaxed text-ink-2">
                    Por ahora tus diseños se guardan en este dispositivo: siguen acá aunque cierres el navegador, pero no se ven desde otro.
                    {saved > 0 && ` Tenés ${saved} ${saved === 1 ? "diseño guardado" : "diseños guardados"}.`}
                  </p>
                  <Link href="/mis-disenos/" className="btn btn-primary mt-6">
                    Ver mis diseños
                  </Link>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Signed({ account, saved, emailEnabled }: { account: Account; saved: number; emailEnabled: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [support, setSupport] = useState<PushSupport>("ok");
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setSupport(pushSupport()), []);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setNote(null);
    try {
      await fn();
    } catch {
      setNote("No se pudo guardar el cambio. Probá de nuevo.");
    } finally {
      setBusy(null);
    }
  };

  const togglePush = (on: boolean) =>
    run("push", async () => {
      if (!on) {
        await disablePush();
        return updatePrefs({ remindersPush: false });
      }
      // el permiso del navegador se pide recién acá, cuando la persona lo activa
      const result = await enablePush();
      if (result === "ok") return updatePrefs({ remindersPush: true });
      setNote(result === "denegado" ? "El navegador no dio permiso para las notificaciones. Podés habilitarlo desde la configuración del sitio en tu navegador." : "No se pudieron activar las notificaciones en este navegador.");
    });

  return (
    <>
      <h1 className="display-lg mt-4">Tu cuenta</h1>
      <p className="lead mt-5 break-all">{account.email}</p>

      <section className="tile mt-10 p-6 sm:p-8" aria-labelledby="mis-disenos-titulo">
        <h2 id="mis-disenos-titulo" className="font-display text-xl font-semibold tracking-tight">
          Tus diseños
        </h2>
        <p className="mt-2 leading-relaxed text-ink-2">
          {saved === 0 ? "Todavía no guardaste ningún diseño." : `${saved} ${saved === 1 ? "diseño guardado" : "diseños guardados"} en tu cuenta.`} Se sincronizan solos entre
          tus dispositivos.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href="/mis-disenos/" className="btn btn-primary btn-sm">
            Ver mis diseños
          </Link>
          <button
            type="button"
            className="btn btn-ghost btn-sm disabled:opacity-50"
            disabled={busy === "sync"}
            onClick={() =>
              run("sync", async () => {
                setNote((await syncDesigns()) ? "Tus diseños están al día." : "No se pudo sincronizar. Probá de nuevo.");
              })
            }
          >
            {busy === "sync" ? "Sincronizando…" : "Sincronizar ahora"}
          </button>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="avisos-titulo">
        <h2 id="avisos-titulo" className="font-display text-xl font-semibold tracking-tight">
          Recordatorios
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Si dejás un diseño sin terminar, te avisamos al día y a los tres días. Son dos avisos como mucho, y se cancelan solos si volvés a editar o borrás el diseño.
        </p>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          <Pref
            title="Por email"
            body={emailEnabled ? "A la dirección de tu cuenta, con un enlace para volver al diseño." : "El envío de emails no está activo en este sitio."}
            checked={account.prefs.remindersEmail}
            disabled={busy === "email" || !emailEnabled}
            onChange={(on) => run("email", () => updatePrefs({ remindersEmail: on }))}
          />
          <Pref
            title="En este navegador"
            body={
              support === "ok"
                ? "Una notificación en este dispositivo. El navegador te va a pedir permiso."
                : support === "bloqueadas"
                  ? "Las notificaciones de este sitio están bloqueadas en tu navegador. Habilitalas desde su configuración para poder activarlas."
                  : support === "ios_sin_instalar"
                    ? "En iPhone y iPad, primero agregá MEDIDA a la pantalla de inicio desde el menú Compartir."
                    : "Este navegador no admite notificaciones."
            }
            checked={account.prefs.remindersPush}
            disabled={busy === "push" || (support !== "ok" && !account.prefs.remindersPush)}
            onChange={togglePush}
          />
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="novedades-titulo">
        <h2 id="novedades-titulo" className="font-display text-xl font-semibold tracking-tight">
          Novedades
        </h2>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          <Pref
            title="Novedades de MEDIDA por email"
            body="Lanzamientos y configuradores nuevos. Es aparte de tu cuenta: apagarlo no cambia nada de lo demás."
            checked={account.prefs.marketing}
            disabled={busy === "marketing"}
            onChange={(on) => run("marketing", () => updatePrefs({ marketing: on }))}
          />
        </ul>
      </section>

      {note && (
        <p role="status" className="mt-6 rounded-2xl bg-paper px-4 py-3 text-sm text-ink-2">
          {note}
        </p>
      )}

      {(account.isAdmin || account.tenants.length > 0) && (
        <section className="mt-10 flex flex-wrap gap-3">
          {account.tenants.length > 0 && (
            <Link href="/panel/" className="btn btn-secondary btn-sm">
              Panel de mi empresa
            </Link>
          )}
          {account.isAdmin && (
            <Link href="/admin/" className="btn btn-secondary btn-sm">
              Administración de MEDIDA
            </Link>
          )}
        </section>
      )}

      <section className="mt-12 border-t border-line pt-8">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <button type="button" className="btn btn-ghost btn-sm disabled:opacity-50" disabled={busy === "out"} onClick={() => run("out", signOut)}>
            {busy === "out" ? "Cerrando…" : "Cerrar sesión"}
          </button>
          {confirming ? (
            <span className="flex flex-wrap items-center gap-3">
              <span className="text-ink-2">Se borran tu cuenta y todos tus diseños del servidor. No se puede deshacer.</span>
              <button type="button" className="font-semibold text-accent-strong underline underline-offset-4" onClick={() => run("delete", deleteAccount)}>
                Sí, eliminar
              </button>
              <button type="button" className="text-ink-2 underline underline-offset-4" onClick={() => setConfirming(false)}>
                Cancelar
              </button>
            </span>
          ) : (
            <button type="button" className="text-ink-2 underline underline-offset-4 hover:text-ink" onClick={() => setConfirming(true)}>
              Eliminar mi cuenta y mis datos
            </button>
          )}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-2">Al cerrar sesión, tus diseños quedan en tu cuenta y salen de este dispositivo.</p>
      </section>
    </>
  );
}

function Pref({ title, body, checked, disabled, onChange }: { title: string; body: string; checked: boolean; disabled?: boolean; onChange: (on: boolean) => void }) {
  return (
    <li>
      <label className={`flex items-start justify-between gap-5 py-4 ${disabled ? "" : "cursor-pointer"}`}>
        <span>
          <span className="block text-sm font-semibold">{title}</span>
          <span className="mt-1 block text-sm leading-relaxed text-ink-2">{body}</span>
        </span>
        <span className="relative mt-0.5 inline-flex shrink-0">
          <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
          <span className={`h-6 w-11 rounded-full bg-line transition-colors duration-300 peer-checked:bg-ink peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50 ${disabled ? "opacity-50" : ""}`} />
          <span className="toggle-knob absolute left-0.5 top-0.5 size-5 rounded-full bg-solid shadow-sm peer-checked:translate-x-5" />
        </span>
      </label>
    </li>
  );
}
