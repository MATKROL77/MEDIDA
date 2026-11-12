"use client";

import { useCallback, useEffect, useState } from "react";

import { forgetSiteCache } from "@/components/site/SiteProvider";
import { ApiError, api } from "@/lib/api";
import { INTERESTS, defaultContact, formatWhatsapp } from "@/lib/site";

import { Gate, fmtDate } from "./Gate";

type Lead = { id: string; name: string; company: string; channel: string; interest: string; stage: string; notes: string; created_at: number; updated_at: number };
type Tenant = { id: string; slug: string; name: string; plan: string; configuratorLimit: number; status: string; members: string[]; createdAt: number };
type Clicks = Record<string, number>;
type Overview = {
  contact: { whatsapp?: string; email?: string };
  stats: {
    clicks: { last7: Clicks; last30: Clicks; last90: Clicks };
    byInterest: { type: string; interest: string; n: number }[];
    byPlacement: { type: string; placement: string; n: number }[];
    leads: Record<string, number>;
    accounts: number;
    savedDesigns: number;
  };
  leads: Lead[];
  tenants: Tenant[];
  emailEnabled: boolean;
};

const STAGES: Record<string, string> = { consulta: "Consulta recibida", reunion: "Reunión", cliente: "Cliente contratado", descartada: "Descartada" };
const TYPES: Record<string, string> = { whatsapp_click: "Clic en WhatsApp", email_start: "Email iniciado" };

export function AdminPanel() {
  return (
    <Gate title="Administración" allow={(a) => a.isAdmin}>
      {() => <Admin />}
    </Gate>
  );
}

function Admin() {
  const [data, setData] = useState<Overview | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const load = useCallback(() => api<Overview>("/api/admin/overview").then(setData).catch(() => setNote("No se pudo cargar. Probá de nuevo.")), []);
  useEffect(() => void load(), [load]);

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setNote(null);
    try {
      await fn();
      await load();
      if (ok) setNote(ok);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : "";
      setNote(code === "datos_invalidos" ? "Revisá los datos: hay algo que no es válido." : code === "ya_existe" ? "Ya existe una empresa con esa dirección." : "No se pudo guardar. Probá de nuevo.");
    }
  };

  if (!data) return <div className="wrap py-20">{note ?? <div className="shimmer h-64 rounded-3xl" role="status" aria-label="Cargando" />}</div>;
  const { stats } = data;

  return (
    <div className="wrap space-y-14 pb-24 pt-12 sm:pt-16">
      <header>
        <p className="eyebrow">Administración</p>
        <h1 className="display-lg mt-4">MEDIDA por dentro.</h1>
        {note && (
          <p role="status" className="mt-5 rounded-2xl bg-paper px-4 py-3 text-sm">
            {note}
          </p>
        )}
      </header>

      <section aria-labelledby="contacto-admin">
        <h2 id="contacto-admin" className="display-md">
          Contacto comercial
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
          El número y el email que abren todos los botones de contacto del sitio. Hoy:{" "}
          <strong className="font-semibold text-ink">{formatWhatsapp(data.contact.whatsapp ?? defaultContact.whatsapp)}</strong> y{" "}
          <strong className="font-semibold text-ink">{data.contact.email ?? defaultContact.email}</strong>
          {data.contact.whatsapp ? "" : " (los de partida, del código)"}.
        </p>
        <form
          className="mt-5 grid max-w-2xl gap-3 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void act(async () => {
              await api("/api/admin/contact", { method: "PUT", body: { whatsapp: f.get("whatsapp"), email: f.get("email") } });
              forgetSiteCache();
            }, "Contacto guardado. Los botones del sitio ya lo usan.");
          }}
        >
          <input name="whatsapp" className="field" aria-label="WhatsApp, con código de país" placeholder="+54 9 11 5555-0000" defaultValue={data.contact.whatsapp ?? defaultContact.whatsapp} required />
          <input name="email" type="email" className="field" aria-label="Email" defaultValue={data.contact.email ?? defaultContact.email} required />
          <button className="btn btn-primary">Guardar</button>
        </form>
      </section>

      <section aria-labelledby="oportunidades">
        <h2 id="oportunidades" className="display-md">
          Oportunidades
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
          Un clic es que alguien abrió WhatsApp o el correo, no que mandó el mensaje, y solo se cuenta si aceptó la medición. Las consultas, reuniones y clientes se
          cargan acá a mano cuando pasan de verdad.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Clics en WhatsApp" value={stats.clicks.last30.whatsapp_click ?? 0} note={`30 días · ${stats.clicks.last7.whatsapp_click ?? 0} en 7 · ${stats.clicks.last90.whatsapp_click ?? 0} en 90`} />
          <Stat label="Emails iniciados" value={stats.clicks.last30.email_start ?? 0} note={`30 días · ${stats.clicks.last7.email_start ?? 0} en 7 · ${stats.clicks.last90.email_start ?? 0} en 90`} />
          <Stat label="Consultas recibidas" value={stats.leads.consulta ?? 0} note="en esa etapa hoy" />
          <Stat label="Reuniones" value={stats.leads.reunion ?? 0} note="en esa etapa hoy" />
          <Stat label="Clientes contratados" value={stats.leads.cliente ?? 0} note="en total" />
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Breakdown title="Por servicio (30 días)" rows={stats.byInterest.map((r) => ({ a: TYPES[r.type] ?? r.type, b: INTERESTS[r.interest as keyof typeof INTERESTS]?.label ?? r.interest, n: r.n }))} />
          <Breakdown title="Por lugar del sitio (30 días)" rows={stats.byPlacement.map((r) => ({ a: TYPES[r.type] ?? r.type, b: r.placement, n: r.n }))} />
        </div>
        <p className="mt-4 text-xs text-ink-3">
          {stats.accounts} {stats.accounts === 1 ? "cuenta creada" : "cuentas creadas"} · {stats.savedDesigns} diseños guardados en cuentas
        </p>

        <form
          className="mt-8 grid gap-3 rounded-[var(--radius-tile)] bg-paper p-5 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_auto_auto_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            void act(async () => {
              await api("/api/admin/leads", { body: { name: f.get("name"), company: f.get("company"), channel: f.get("channel"), stage: f.get("stage") } });
              form.reset();
            });
          }}
        >
          <input name="name" className="field" placeholder="Quién escribió" aria-label="Nombre" required />
          <input name="company" className="field" placeholder="Empresa" aria-label="Empresa" />
          <select name="channel" className="field" aria-label="Canal" defaultValue="whatsapp">
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="otro">Otro</option>
          </select>
          <select name="stage" className="field" aria-label="Etapa" defaultValue="consulta">
            {Object.entries(STAGES).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <button className="btn btn-primary">Agregar</button>
        </form>
        <ul className="mt-4 divide-y divide-line">
          {data.leads.map((lead) => (
            <li key={lead.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 text-sm">
              <span className="min-w-[10rem] flex-1">
                <span className="font-semibold">{lead.name}</span>
                {lead.company && <span className="text-ink-2"> · {lead.company}</span>}
                <span className="block text-xs text-ink-3">
                  {lead.channel} · {fmtDate(lead.created_at)}
                </span>
              </span>
              <select className="field w-auto py-2 text-sm" aria-label={`Etapa de ${lead.name}`} value={lead.stage} onChange={(e) => void act(() => api(`/api/admin/leads/${lead.id}`, { method: "PATCH", body: { stage: e.target.value } }))}>
                {Object.entries(STAGES).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
              <button type="button" className="text-ink-2 underline underline-offset-4 hover:text-ink" onClick={() => void act(() => api(`/api/admin/leads/${lead.id}`, { method: "DELETE" }))}>
                Quitar
              </button>
            </li>
          ))}
          {data.leads.length === 0 && <li className="py-4 text-sm text-ink-2">Todavía no cargaste ninguna oportunidad.</li>}
        </ul>
      </section>

      <section aria-labelledby="empresas-admin">
        <h2 id="empresas-admin" className="display-md">
          Empresas
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
          Cada empresa tiene su cuenta, sus configuradores y sus consultas, guardados aparte de los de las demás. El plan fija cuántos configuradores puede tener. La
          facturación no está integrada: el plan se acuerda y se cobra por fuera.
        </p>
        <form
          className="mt-5 grid gap-3 rounded-[var(--radius-tile)] bg-paper p-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_0.8fr_0.5fr_1.3fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            void act(async () => {
              await api("/api/admin/tenants", {
                body: { name: f.get("name"), slug: f.get("slug"), plan: f.get("plan"), configuratorLimit: Number(f.get("limit")), members: String(f.get("members")).split(/[\s,;]+/).filter(Boolean) },
              });
              form.reset();
            }, "Empresa creada.");
          }}
        >
          <input name="name" className="field" placeholder="Nombre de la empresa" aria-label="Nombre de la empresa" required />
          <input name="slug" className="field" placeholder="direccion-corta" aria-label="Dirección corta: minúsculas, números y guiones" pattern="[a-z0-9][a-z0-9\-]{1,38}[a-z0-9]" required />
          <input name="plan" className="field" placeholder="Plan" aria-label="Nombre del plan" />
          <input name="limit" type="number" min={1} max={100} defaultValue={1} className="field" aria-label="Configuradores que incluye el plan" required />
          <input name="members" className="field" placeholder="emails con acceso" aria-label="Emails con acceso, separados por coma" />
          <button className="btn btn-primary">Crear</button>
        </form>
        <ul className="mt-4 divide-y divide-line">
          {data.tenants.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 py-4 text-sm">
              <span className="min-w-[12rem] flex-1">
                <span className="font-semibold">{t.name}</span> <span className="text-ink-3">/embed/?t={t.slug}</span>
                <span className="block text-xs text-ink-2">
                  {t.plan || "Sin plan"} · hasta {t.configuratorLimit} {t.configuratorLimit === 1 ? "configurador" : "configuradores"} · {t.members.join(", ") || "sin accesos"}
                </span>
              </span>
              <label className="flex items-center gap-2 text-xs text-ink-2">
                Configuradores
                <input type="number" min={1} max={100} className="field w-20 py-2 text-sm" defaultValue={t.configuratorLimit} onBlur={(e) => Number(e.target.value) !== t.configuratorLimit && void act(() => api(`/api/admin/tenants/${t.id}`, { method: "PATCH", body: { configuratorLimit: Number(e.target.value) } }))} />
              </label>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void act(() => api(`/api/admin/tenants/${t.id}`, { method: "PATCH", body: { status: t.status === "activa" ? "pausada" : "activa" } }))}>
                {t.status === "activa" ? "Pausar" : "Reactivar"}
              </button>
              <button
                type="button"
                className="text-ink-2 underline underline-offset-4 hover:text-ink"
                onClick={() => window.confirm(`¿Eliminar ${t.name} con todos sus configuradores y consultas? No se puede deshacer.`) && void act(() => api(`/api/admin/tenants/${t.id}`, { method: "DELETE" }))}
              >
                Eliminar
              </button>
            </li>
          ))}
          {data.tenants.length === 0 && <li className="py-4 text-sm text-ink-2">Todavía no hay empresas.</li>}
        </ul>
      </section>

      <section aria-labelledby="estado-admin">
        <h2 id="estado-admin" className="display-md">
          Estado
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
          {data.emailEnabled
            ? "El envío de emails está activo: funcionan el acceso con enlace y los recordatorios."
            : "El envío de emails no está configurado. Para activarlo hay que cargar la clave del proveedor (RESEND_API_KEY) como secreto en GitHub y volver a publicar."}
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="tile p-5">
      <p className="text-xs text-ink-2">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-[0.7rem] leading-snug text-ink-3">{note}</p>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: { a: string; b: string; n: number }[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-ink-2">Sin datos todavía.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line text-sm">
          {rows.slice(0, 8).map((r) => (
            <li key={`${r.a}-${r.b}`} className="flex justify-between gap-4 py-2">
              <span>
                {r.b} <span className="text-ink-3">· {r.a}</span>
              </span>
              <span className="tabular-nums">{r.n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
