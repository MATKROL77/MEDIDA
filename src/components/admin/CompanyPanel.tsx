"use client";

import { useCallback, useEffect, useState } from "react";

import { toBase64Url } from "@/lib/base64url";
import { ApiError, api } from "@/lib/api";
import { catalog } from "@/lib/catalog";
import { formatWhatsapp } from "@/lib/site";

import { Gate, fmtDate, fmtMoney } from "./Gate";

type Tenant = { id: string; slug: string; name: string; plan: string; configuratorLimit: number; status: string };
type Params = { margin?: number; materials?: string[]; boardPrices?: Record<string, number> };
type Configurator = { id: string; family: string; name: string; active: boolean; params: Params };
type Inquiry = { id: string; configuratorId: string; at: number; channel: string; config: unknown; summary: { dimensions: string; lines: string[] }; price: number | null; status: string };
type Detail = { tenant: Tenant; profile: { whatsapp: string; email: string; tagline: string }; configurators: Configurator[]; inquiries: Inquiry[]; usage: { configuratorId: string; opens: number; inquiries: number }[] };

const STATUSES: Record<string, string> = { nueva: "Nueva", contactada: "Contactada", cotizada: "Cotizada", ganada: "Ganada", descartada: "Descartada" };
const CHANNELS: Record<string, string> = { whatsapp: "WhatsApp", email: "email", share: "PDF compartido" };

export function CompanyPanel() {
  return (
    <Gate title="Panel de empresa" allow={(a) => a.isAdmin || a.tenants.length > 0}>
      {() => <Panel />}
    </Gate>
  );
}

function Panel() {
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    api<{ tenants: Tenant[] }>("/api/panel")
      .then(({ tenants }) => {
        setTenants(tenants);
        setCurrent(tenants[0]?.id ?? null);
      })
      .catch(() => setNote("No se pudo cargar. Probá de nuevo."));
  }, []);

  const load = useCallback(() => (current ? api<Detail>(`/api/panel/${current}`).then(setDetail) : Promise.resolve()), [current]);
  useEffect(() => {
    setDetail(null);
    void load().catch(() => setNote("No se pudo cargar la empresa."));
  }, [load]);

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setNote(null);
    try {
      await fn();
      await load();
      if (ok) setNote(ok);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : "";
      setNote(
        code === "limite_del_plan"
          ? "Tu plan no incluye más configuradores. Escribinos para ampliarlo."
          : code === "datos_invalidos"
            ? "Revisá los datos: el WhatsApp tiene que llevar código de país."
            : "No se pudo guardar. Probá de nuevo.",
      );
    }
  };

  if (tenants && tenants.length === 0) return <div className="wrap py-20 text-ink-2">Todavía no hay ninguna empresa cargada.</div>;
  if (!detail) return <div className="wrap py-20">{note ?? <div className="shimmer h-64 rounded-3xl" role="status" aria-label="Cargando" />}</div>;

  const { tenant, profile, configurators, inquiries, usage } = detail;
  const base = `/api/panel/${tenant.id}`;
  const left = tenant.configuratorLimit - configurators.length;
  const embedUrl = (c: Configurator) => `${origin}/embed/?t=${tenant.slug}&k=${c.id}`;

  return (
    <div className="wrap space-y-14 pb-24 pt-12 sm:pt-16">
      <header>
        <p className="eyebrow">Panel de empresa</p>
        <h1 className="display-lg mt-4">{tenant.name}</h1>
        <p className="mt-3 text-sm text-ink-2">
          {tenant.plan ? `Plan ${tenant.plan}` : "Sin plan asignado"} · {configurators.length} de {tenant.configuratorLimit} {tenant.configuratorLimit === 1 ? "configurador" : "configuradores"}
          {tenant.status !== "activa" && " · pausada: tus configuradores no se muestran"}
        </p>
        {tenants && tenants.length > 1 && (
          <select className="field mt-4 w-auto" aria-label="Empresa" value={current ?? ""} onChange={(e) => setCurrent(e.target.value)}>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        {note && (
          <p role="status" className="mt-5 rounded-2xl bg-paper px-4 py-3 text-sm">
            {note}
          </p>
        )}
      </header>

      <section aria-labelledby="perfil">
        <h2 id="perfil" className="display-md">
          A dónde llegan las consultas
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
          «Enviar al taller» abre el WhatsApp de tu empresa con el diseño del cliente. Sin un número cargado, el configurador no se publica.
          {profile.whatsapp && ` Hoy: ${formatWhatsapp(profile.whatsapp)}.`}
        </p>
        <form
          className="mt-5 grid max-w-3xl gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void act(() => api(`${base}/profile`, { method: "PUT", body: { whatsapp: f.get("whatsapp"), email: f.get("email"), tagline: f.get("tagline") } }), "Datos guardados.");
          }}
        >
          <input name="whatsapp" className="field" aria-label="WhatsApp con código de país" placeholder="+54 9 11 5555-0000" defaultValue={profile.whatsapp} required />
          <input name="email" type="email" className="field" aria-label="Email (opcional)" placeholder="Email (opcional)" defaultValue={profile.email} />
          <input name="tagline" className="field" aria-label="Frase bajo tu nombre" placeholder="Placares a medida" defaultValue={profile.tagline} maxLength={80} />
          <button className="btn btn-primary">Guardar</button>
        </form>
      </section>

      <section aria-labelledby="configuradores-panel">
        <h2 id="configuradores-panel" className="display-md">
          Configuradores
        </h2>
        <div className="mt-5 space-y-4">
          {configurators.map((c) => {
            const u = usage.find((x) => x.configuratorId === c.id);
            return (
              <ConfiguratorForm
                key={c.id}
                configurator={c}
                url={embedUrl(c)}
                usage={u ? `${u.opens} aperturas y ${u.inquiries} consultas en 30 días` : "Sin uso en los últimos 30 días"}
                onSave={(body) => act(() => api(`${base}/configurators`, { body: { id: c.id, ...body } }), "Configurador guardado.")}
                onRemove={() => window.confirm(`¿Eliminar ${c.name}?`) && void act(() => api(`${base}/configurators/${c.id}`, { method: "DELETE" }))}
              />
            );
          })}
        </div>
        {left > 0 ? (
          <form
            className="mt-4 flex flex-wrap gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              void act(async () => {
                await api(`${base}/configurators`, { body: { family: "placares", name: new FormData(form).get("name") } });
                form.reset();
              }, "Configurador creado.");
            }}
          >
            <input name="name" className="field max-w-sm" placeholder="Nombre del configurador nuevo" aria-label="Nombre del configurador nuevo" required />
            <button className="btn btn-secondary">Crear configurador de placares</button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-ink-2">Tu plan incluye {tenant.configuratorLimit} y ya los usaste. Para sumar otro hay que ampliar el plan.</p>
        )}
        <p className="mt-3 text-xs text-ink-3">Hoy se pueden crear configuradores de placares y vestidores. Las otras familias están en desarrollo.</p>
      </section>

      <section aria-labelledby="consultas-panel">
        <h2 id="consultas-panel" className="display-md">
          Consultas de tus clientes
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
          Cada vez que alguien toca «Enviar al taller» queda acá el diseño y por dónde eligió mandarlo. Que figure no confirma que el mensaje te haya llegado: eso se ve
          en tu WhatsApp o tu correo.
        </p>
        <ul className="mt-4 divide-y divide-line">
          {inquiries.map((q) => (
            <li key={q.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 py-3 text-sm">
              <span className="min-w-[14rem] flex-1">
                <span className="font-semibold tabular-nums">{q.summary.dimensions || "Diseño"}</span>
                <span className="block text-xs text-ink-2">{q.summary.lines.slice(0, 3).join(" · ")}</span>
                <span className="block text-xs text-ink-3">
                  {fmtDate(q.at)} · por {CHANNELS[q.channel] ?? q.channel}
                  {q.price !== null && ` · ${fmtMoney(q.price)} estimado`}
                </span>
              </span>
              <a href={`/embed/?t=${tenant.slug}&k=${q.configuratorId}&c=${toBase64Url(JSON.stringify(q.config))}`} target="_blank" rel="noopener noreferrer" className="link-arrow">
                Abrir el diseño
              </a>
              <select className="field w-auto py-2 text-sm" aria-label="Estado de la consulta" value={q.status} onChange={(e) => void act(() => api(`${base}/inquiries/${q.id}`, { method: "PATCH", body: { status: e.target.value } }))}>
                {Object.entries(STATUSES).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </li>
          ))}
          {inquiries.length === 0 && <li className="py-4 text-sm text-ink-2">Todavía no llegaron consultas.</li>}
        </ul>
      </section>
    </div>
  );
}

function ConfiguratorForm({ configurator: c, url, usage, onSave, onRemove }: { configurator: Configurator; url: string; usage: string; onSave: (body: { name: string; active: boolean; params: Params }) => void; onRemove: () => void }) {
  const [copied, setCopied] = useState(false);
  const snippet = `<iframe src="${url}" title="${c.name}" style="width:100%;height:760px;border:0" loading="lazy" allow="clipboard-write; web-share"></iframe>`;
  const enabled = (id: string) => !c.params.materials || c.params.materials.includes(id);

  return (
    <form
      className="tile p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const materials = catalog.materials.map((m) => m.id).filter((id) => f.get(`m-${id}`) === "on");
        const boardPrices: Record<string, number> = {};
        for (const m of catalog.materials) {
          const price = Number(f.get(`p-${m.id}`));
          if (price > 0 && price !== m.boardPrice) boardPrices[m.id] = price;
        }
        onSave({ name: String(f.get("name")), active: f.get("active") === "on", params: { margin: Number(f.get("margin")) / 100, materials, boardPrices } });
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <input name="name" className="field max-w-sm font-semibold" aria-label="Nombre del configurador" defaultValue={c.name} required />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={c.active} className="size-4 accent-[var(--color-ink)]" /> Publicado
        </label>
        <span className="text-xs text-ink-3">{usage}</span>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[auto_1fr]">
        <label className="text-sm">
          <span className="block font-medium">Margen sobre el costo</span>
          <span className="mt-2 flex items-center gap-2">
            <input name="margin" type="number" min={0} max={500} step={1} className="field w-24" defaultValue={Math.round((c.params.margin ?? catalog.margin) * 100)} /> %
          </span>
        </label>
        <fieldset>
          <legend className="text-sm font-medium">Terminaciones que ofrecés y precio de cada placa</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.materials.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm">
                <input type="checkbox" name={`m-${m.id}`} defaultChecked={enabled(m.id)} aria-label={`Ofrecer ${m.name}`} className="size-4 accent-[var(--color-ink)]" />
                <span className="size-4 shrink-0 rounded-full ring-1 ring-line" style={{ background: m.color }} aria-hidden />
                <span className="flex-1 truncate">{m.name}</span>
                <span className="text-ink-3">$</span>
                <input name={`p-${m.id}`} type="number" min={1} className="w-24 rounded-lg border border-line px-2 py-1 text-right tabular-nums" aria-label={`Precio de la placa ${m.name}`} defaultValue={c.params.boardPrices?.[m.id] ?? m.boardPrice} />
              </div>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="mt-5">
        <p className="text-sm font-medium">Para ponerlo en tu web</p>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-surface p-3 text-xs leading-relaxed text-ink-2">{snippet}</pre>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
          <button
            type="button"
            className="underline underline-offset-4 hover:text-accent"
            onClick={() => navigator.clipboard.writeText(snippet).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {})}
          >
            {copied ? "Copiado" : "Copiar el código"}
          </button>
          <a href={url} target="_blank" rel="noopener noreferrer" className="link-arrow">
            Abrirlo en un enlace propio
          </a>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button className="btn btn-primary btn-sm">Guardar cambios</button>
        <button type="button" className="text-sm text-ink-2 underline underline-offset-4 hover:text-ink" onClick={onRemove}>
          Eliminar
        </button>
      </div>
    </form>
  );
}
