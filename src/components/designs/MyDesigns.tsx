"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ContactLink } from "@/components/site/ContactLink";
import { Sheet } from "@/components/site/Sheet";
import { IconBag, IconCheck, IconCopy, IconDuplicate, IconEdit, IconHeart, IconMail, IconPlus, IconShare, IconTrash, IconWhatsapp } from "@/components/site/icons";
import { toBase64Url } from "@/lib/base64url";
import { copyDesign, deleteDesign, updateDesign, useDesigns } from "@/lib/designStore";
import { LIMITS, cartOf, cartTotal, favoritesOf, shortCode, type SavedDesign } from "@/lib/designs";
import { familyById } from "@/lib/families";
import { inquiryMessage } from "@/lib/inquiry";
import { mailtoLink, whatsappLink } from "@/lib/site";

type Tab = "todos" | "favoritos" | "carrito";

const money = (value: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
const day = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric" });
const time = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" });

/** "hoy 14:30", "ayer", "11 nov 2026" */
function when(ms: number, now: number): string {
  const d = new Date(ms);
  const days = Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(ms).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return `hoy ${time.format(d)}`;
  if (days === 1) return "ayer";
  return day.format(d);
}

/** dónde se abre un diseño guardado para seguir editándolo */
const editHref = (d: SavedDesign) => {
  const family = familyById(d.type);
  return family?.href ? `${family.href}?id=${d.id}` : null;
};

/**
 * Enlace que abre el diseño en cualquier dispositivo: lleva la configuración,
 * no el identificador, que solo existe donde se guardó.
 */
function publicLink(d: SavedDesign): string | null {
  const family = familyById(d.type);
  if (!family?.href || typeof window === "undefined") return null;
  try {
    return `${window.location.origin}${family.href}?c=${toBase64Url(JSON.stringify(d.config))}`;
  } catch {
    return null;
  }
}

export function MyDesigns() {
  const state = useDesigns();
  const [tab, setTab] = useState<Tab>("todos");
  const [inquiry, setInquiry] = useState(false);
  // la hora se fija al montar: así el servidor y el navegador dibujan lo mismo
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    if (window.location.hash === "#carrito") setTab("carrito");
    if (window.location.hash === "#favoritos") setTab("favoritos");
  }, []);

  const favorites = favoritesOf(state);
  const cart = cartOf(state);
  const shown = tab === "favoritos" ? favorites : tab === "carrito" ? cart : state.designs;
  const total = cartTotal(state);
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "todos", label: "Todos", count: state.designs.length },
    { id: "favoritos", label: "Favoritos", count: favorites.length },
    { id: "carrito", label: "Carrito de consulta", count: cart.length },
  ];

  return (
    <div className="wrap pb-20 pt-12 sm:pb-28 sm:pt-20">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="eyebrow">Mis diseños</p>
          <h1 className="display-lg mt-4">Lo que armaste, guardado.</h1>
          <p className="lead mt-5">Compará tus favoritos, seguí editando cualquiera o juntá varios muebles en una sola consulta.</p>
        </div>
        <Link href="/configuradores/" className="btn btn-secondary">
          <IconPlus />
          Agregar otro mueble
        </Link>
      </div>

      <div role="tablist" aria-label="Diseños guardados" className="mt-10 flex gap-6 overflow-x-auto border-b border-line [scrollbar-width:none]">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="tab shrink-0 text-[0.95rem]" onClick={() => setTab(t.id)}>
            {t.label}
            <span className="ml-1.5 tabular-nums text-ink-3">{t.count}</span>
          </button>
        ))}
      </div>

      {state.designs.length === 0 ? (
        <Empty title="Todavía no guardaste ningún diseño." body="Armá un mueble en el configurador y tocá Guardar. Queda en este dispositivo, sin registrarte." />
      ) : shown.length === 0 ? (
        <Empty
          title={tab === "carrito" ? "Tu carrito de consulta está vacío." : "No marcaste favoritos todavía."}
          body={tab === "carrito" ? "Sumá diseños con el botón del carrito para pedir cotización de varios muebles juntos." : "Marcá con el corazón los diseños que quieras comparar."}
        />
      ) : (
        <div className={`mt-8 grid gap-8 ${tab === "carrito" ? "lg:grid-cols-[1fr_20rem]" : ""}`}>
          <ul aria-label="Lista de diseños" className={`grid gap-5 ${tab === "carrito" ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
            {shown.map((d) => (
              <DesignCard key={d.id} design={d} now={now} />
            ))}
          </ul>

          {tab === "carrito" && (
            <aside className="tile h-fit p-6 lg:sticky lg:top-24" aria-label="Resumen de la consulta">
              <h2 className="font-display text-lg font-semibold tracking-tight">Tu consulta</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-2">Muebles</dt>
                  <dd className="tabular-nums">{cart.length}</dd>
                </div>
                {total !== null && (
                  <div className="flex justify-between gap-4 border-t border-line pt-2">
                    <dt className="text-ink-2">Total estimado</dt>
                    <dd className="font-semibold tabular-nums">{money(total)}</dd>
                  </div>
                )}
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-ink-2">
                Esto no es una compra: es un pedido de cotización. Los precios son estimados y de muestra; el precio final lo confirma quien fabrica.
              </p>
              <button type="button" className="btn btn-primary mt-5 w-full" onClick={() => setInquiry(true)}>
                Enviar consulta conjunta
              </button>
              <Link href="/configuradores/" className="link-arrow mt-4 text-sm">
                Agregar otro mueble
              </Link>
            </aside>
          )}
        </div>
      )}

      {state.designs.length > 0 && (
        <p className="mt-12 max-w-2xl text-sm leading-relaxed text-ink-2">
          Tus diseños están guardados en este dispositivo: siguen acá aunque cierres el navegador, pero no se ven desde otro teléfono o computadora.
        </p>
      )}

      {inquiry && <InquirySheet designs={cart} onClose={() => setInquiry(false)} />}
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="tile mt-8 grid place-items-center px-6 py-20 text-center">
      <svg viewBox="0 0 64 28" width="64" height="28" fill="none" stroke="var(--color-ink-3)" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M3 3v22M61 3v22M3 14h58" />
      </svg>
      <h2 className="display-md mt-6">{title}</h2>
      <p className="mt-3 max-w-md leading-relaxed text-ink-2">{body}</p>
      <Link href="/configuradores/" className="btn btn-primary mt-7">
        Probar un configurador
      </Link>
    </div>
  );
}

function DesignCard({ design: d, now }: { design: SavedDesign; now: number }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(d.name);
  const [confirming, setConfirming] = useState(false);
  const href = editHref(d);
  const family = familyById(d.type);

  const rename = (e: React.FormEvent) => {
    e.preventDefault();
    const next = name.trim();
    if (next && next !== d.name) updateDesign(d.id, { name: next });
    else setName(d.name);
    setRenaming(false);
  };

  const icon = "grid size-10 place-items-center rounded-full text-ink-2 transition-colors hover:bg-paper hover:text-ink";

  return (
    <li className="card flex flex-col overflow-hidden">
      <div className="relative aspect-[4/3] bg-paper">
        {d.preview ? (
          <img src={d.preview} alt={`Vista previa de ${d.name}`} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-xs text-ink-3">Sin vista previa</div>
        )}
        <div className="absolute left-3 top-3 flex gap-1.5">
          {d.favorite && <span className="badge bg-surface/90 text-ink shadow-sm">Favorito</span>}
          {d.cart && <span className="badge bg-surface/90 text-ink shadow-sm">En el carrito</span>}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        {renaming ? (
          <form onSubmit={rename} className="flex gap-2">
            <input className="field py-2 text-sm" value={name} maxLength={LIMITS.name} onChange={(e) => setName(e.target.value)} autoFocus aria-label="Nombre del diseño" onBlur={rename} />
          </form>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-display text-lg font-semibold leading-snug tracking-tight">{d.name}</h2>
            <button type="button" className="-mr-2 -mt-1.5 grid size-9 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-paper hover:text-ink" aria-label={`Cambiar el nombre de ${d.name}`} onClick={() => setRenaming(true)}>
              <IconEdit width={16} height={16} />
            </button>
          </div>
        )}
        <p className="mt-0.5 text-xs text-ink-3">
          {family?.name ?? d.type} · {shortCode(d.id)}
        </p>

        <p className="mt-3 text-sm font-medium tabular-nums">{d.summary.dimensions}</p>
        <ul className="mt-1.5 space-y-0.5 text-[0.82rem] leading-relaxed text-ink-2">
          {d.summary.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        {d.price !== null && (
          <p className="mt-3 text-sm">
            <span className="font-semibold tabular-nums">{money(d.price)}</span> <span className="text-xs text-ink-2">estimado de muestra</span>
          </p>
        )}
        <p className="mt-2 text-xs text-ink-3">{now ? `Creado ${when(d.createdAt, now)} · modificado ${when(d.updatedAt, now)}` : " "}</p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-5">
          {href ? (
            <Link href={href} className="btn btn-primary btn-sm">
              Abrir y editar
            </Link>
          ) : (
            <span className="text-xs text-ink-3">Este configurador ya no está disponible</span>
          )}
          {confirming ? (
            <span className="flex items-center gap-2 text-sm">
              <span className="text-ink-2">¿Eliminar?</span>
              <button type="button" className="font-semibold text-accent-strong underline underline-offset-4" onClick={() => deleteDesign(d.id)}>
                Sí
              </button>
              <button type="button" className="text-ink-2 underline underline-offset-4" onClick={() => setConfirming(false)}>
                No
              </button>
            </span>
          ) : (
            <span className="-mr-2 flex items-center">
              <button type="button" className={`${icon} ${d.favorite ? "text-accent hover:text-accent-strong" : ""}`} aria-pressed={d.favorite} aria-label={d.favorite ? "Quitar de favoritos" : "Marcar como favorito"} title="Favorito" onClick={() => updateDesign(d.id, { favorite: !d.favorite })}>
                <IconHeart filled={d.favorite} />
              </button>
              <button type="button" className={`${icon} ${d.cart ? "text-accent hover:text-accent-strong" : ""}`} aria-pressed={d.cart} aria-label={d.cart ? "Quitar del carrito de consulta" : "Agregar al carrito de consulta"} title="Carrito de consulta" onClick={() => updateDesign(d.id, { cart: !d.cart })}>
                <IconBag />
              </button>
              <button type="button" className={icon} aria-label={`Duplicar ${d.name}`} title="Duplicar" onClick={() => copyDesign(d.id)}>
                <IconDuplicate />
              </button>
              <button type="button" className={icon} aria-label={`Eliminar ${d.name}`} title="Eliminar" onClick={() => setConfirming(true)}>
                <IconTrash />
              </button>
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * La consulta conjunta. En la demo de MEDIDA no hay fabricante a quien
 * mandarla: la persona la comparte con quien quiera, y si lo que busca es un
 * configurador para su empresa, eso es otra conversación.
 */
function InquirySheet({ designs, onClose }: { designs: SavedDesign[]; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const message = useMemo(() => inquiryMessage(designs, publicLink), [designs]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt("Copiá el texto de tu consulta:", message);
    }
  };

  return (
    <Sheet title="Tu consulta conjunta" eyebrow="Demostración de MEDIDA" onClose={onClose} wide>
      <ol className="mt-5 divide-y divide-line border-y border-line">
        {designs.map((d) => (
          <li key={d.id} className="flex gap-4 py-3.5">
            <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-paper">{d.preview && <img src={d.preview} alt="" className="h-full w-full object-cover" />}</div>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">
                {d.name} <span className="font-normal text-ink-3">{shortCode(d.id)}</span>
              </p>
              <p className="tabular-nums text-ink-2">{d.summary.dimensions}</p>
              <p className="truncate text-xs text-ink-2">{d.summary.lines.join(" · ")}</p>
            </div>
            {d.price !== null && <p className="shrink-0 text-sm font-medium tabular-nums">{money(d.price)}</p>}
          </li>
        ))}
      </ol>

      <p className="mt-5 rounded-2xl bg-accent-soft px-4 py-3 text-sm leading-relaxed text-accent-strong">
        <strong className="font-semibold">Esto es una demostración.</strong> MEDIDA es el software del configurador, no una fábrica: no hay un taller asociado que reciba esta
        consulta, y los precios son de muestra. Podés mandársela a quien vos elijas.
      </p>

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <a href={whatsappLink(null, message)} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
          <IconShare />
          WhatsApp
        </a>
        <a href={mailtoLink(null, "Consulta por muebles a medida", message)} className="btn btn-ghost">
          <IconMail />
          Email
        </a>
        <button type="button" onClick={copy} className="btn btn-ghost">
          {copied ? <IconCheck /> : <IconCopy />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>

      <div className="mt-6 border-t border-line pt-5">
        <p className="text-sm font-semibold">¿Tenés una empresa?</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">Con MEDIDA en tu web, las consultas como esta te llegan a vos, con cada mueble ya configurado.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ContactLink channel="whatsapp" interest="demo" placement="carrito" className="btn btn-whatsapp btn-sm">
            <IconWhatsapp width={15} height={15} />
            Hablemos por WhatsApp
          </ContactLink>
          <ContactLink channel="email" interest="demo" placement="carrito" className="btn btn-secondary btn-sm">
            <IconMail width={16} height={16} />
            Por email
          </ContactLink>
        </div>
      </div>
    </Sheet>
  );
}
