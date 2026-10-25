"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { catalog } from "@/lib/catalog";
import { DEFAULT_CONFIG, LAYOUT_LABELS, totalHeight, type WardrobeConfig } from "@/lib/model";
import { money, quote, type BoardUse, type CutRow } from "@/lib/quote";
import { decodeConfig, encodeConfig } from "@/lib/share";

/**
 * Lo que recibe el taller cuando entra un pedido: despiece para la
 * seccionadora, plano de cada placa, herrajes y la cuenta de costo y margen.
 * En la versión para un taller real esta vista va detrás de su usuario.
 */
export default function Workshop() {
  const [config, setConfig] = useState<WardrobeConfig>(DEFAULT_CONFIG);
  useEffect(() => {
    const fromUrl = decodeConfig(new URLSearchParams(window.location.search).get("c"));
    if (fromUrl) setConfig(fromUrl);
  }, []);

  const q = useMemo(() => quote(config), [config]);
  const boardCount = q.boards.reduce((s, b) => s + b.count, 0);
  const margin = q.price - q.cost;

  const downloadCsv = () => {
    const header = ["Cantidad", "Pieza", "Material", "Largo (mm)", "Ancho (mm)", "Espesor (mm)", "Canto", "Nota"];
    const lines = q.rows.map((r) => [r.qty, r.label, r.materialName, r.length, r.width, r.thickness, r.edges, r.note]);
    const csv = [header, ...lines].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    // BOM para que Excel en castellano abra los acentos bien
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `despiece-${Math.round(config.runs[0].width / 10)}x${Math.round(totalHeight(config) / 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const summary = [
    config.runs.map((r) => Math.round(r.width / 10)).join(" + ") + ` × ${Math.round(totalHeight(config) / 10)} × ${Math.round(config.depth / 10)} cm`,
    `${config.runs.reduce((s, r) => s + r.modules.length, 0)} módulos`,
    config.doors === "none" ? "sin puertas" : config.doors === "hinged" ? "puertas batientes" : "puertas corredizas",
  ].join(" · ");

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Orden de producción · {catalog.brand.name}</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Placard a medida</h1>
          <p className="mt-1 text-ink-2">{summary}</p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Link href={`/demo/?c=${encodeConfig(config)}`} className="btn btn-ghost text-sm">
            ← Volver al diseño
          </Link>
          <button type="button" onClick={downloadCsv} className="btn btn-ghost text-sm">
            Descargar CSV
          </button>
          <button type="button" onClick={() => window.print()} className="btn btn-primary text-sm">
            Imprimir
          </button>
        </div>
      </header>

      {catalog.brand.demo && (
        <p className="no-print rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent-strong">
          Demo: los precios son de ejemplo. Con un taller real, los costos salen de su lista de precios.
        </p>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Precio al cliente" value={money(q.price)} />
        <Stat label="Costo" value={money(q.cost)} />
        <Stat label="Margen" value={money(margin)} note={`${Math.round((margin / q.price) * 100)} % del precio`} />
        <Stat label="Placas" value={String(boardCount)} note={`${q.bandingMeters.toFixed(1)} m de canto`} />
      </section>

      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-5 py-4 font-display text-lg font-semibold">Despiece</h2>
        <CutTable rows={q.rows} />
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Plano de corte por placa</h2>
        {q.boards.map((b) => (
          <BoardGroup key={b.material} use={b} />
        ))}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card overflow-hidden">
          <h2 className="border-b border-line px-5 py-4 font-display text-lg font-semibold">Herrajes</h2>
          <ul className="divide-y divide-line text-sm">
            {q.assembly.hardware.map((h) => (
              <li key={h.key} className="flex justify-between gap-4 px-5 py-2.5">
                <span>{h.label}</span>
                <span className="tabular-nums text-ink-2">{h.unit === "u" ? `${h.qty} u` : `${h.qty.toFixed(2)} ${h.unit}`}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card overflow-hidden">
          <h2 className="border-b border-line px-5 py-4 font-display text-lg font-semibold">Costos</h2>
          <ul className="divide-y divide-line text-sm">
            {q.costs.map((c) => (
              <li key={c.label} className="flex justify-between gap-4 px-5 py-2.5">
                <span>
                  {c.label}
                  <span className="block text-xs text-ink-2">{c.detail}</span>
                </span>
                <span className="tabular-nums">{money(c.amount)}</span>
              </li>
            ))}
            <li className="flex justify-between gap-4 px-5 py-3 font-semibold">
              <span>Total costo</span>
              <span className="tabular-nums">{money(q.cost)}</span>
            </li>
          </ul>
        </section>
      </div>

      <section className="card p-5 text-sm">
        <h2 className="font-display text-lg font-semibold">Interior por módulo</h2>
        <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {config.runs.flatMap((r, ri) =>
            r.modules.map((m, i) => (
              <li key={`${ri}-${i}`} className="rounded-xl bg-paper px-3 py-2">
                <span className="font-medium">
                  {config.runs.length > 1 ? (ri === 0 ? "Frente" : "Lateral") : "Módulo"} {i + 1} ({Math.round(m.width / 10)} cm):
                </span>{" "}
                {LAYOUT_LABELS[m.layout]}
                {m.drawers > 0 && `, ${m.drawers} cajones`}
                {(m.layout === "shelves" || m.layout === "drawers-shelves") && `, ${m.shelves} estantes`}
                {(m.ledShelves || m.ledSides) && ", con luz"}
              </li>
            )),
          )}
        </ol>
      </section>
    </main>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-xs text-ink-2">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold tabular-nums">{value}</p>
      {note && <p className="text-xs text-ink-2">{note}</p>}
    </div>
  );
}

function CutTable({ rows }: { rows: CutRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-sm">
        <thead className="bg-paper text-left text-xs text-ink-2">
          <tr>
            <th className="px-5 py-2 font-medium">Cant.</th>
            <th className="px-3 py-2 font-medium">Pieza</th>
            <th className="px-3 py-2 font-medium">Material</th>
            <th className="px-3 py-2 text-right font-medium">Largo</th>
            <th className="px-3 py-2 text-right font-medium">Ancho</th>
            <th className="px-3 py-2 text-right font-medium">Esp.</th>
            <th className="px-3 py-2 font-medium">Canto</th>
            <th className="px-5 py-2 font-medium">Nota</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={`${r.label}-${r.material}-${r.length}-${r.width}-${r.note}`}>
              <td className="px-5 py-2 tabular-nums">{r.qty}</td>
              <td className="px-3 py-2">{r.label}</td>
              <td className="px-3 py-2 text-ink-2">{r.materialName}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.length}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.width}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.thickness}</td>
              <td className="px-3 py-2 text-ink-2">{r.edges}</td>
              <td className="px-5 py-2 text-xs text-ink-2">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-5 py-3 text-xs text-ink-2">
        Medidas en mm, largo en el sentido de la veta. Canto: L = lado largo, C = lado corto.
      </p>
    </div>
  );
}

function BoardGroup({ use }: { use: BoardUse }) {
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">
          {use.materialName} {use.thickness} mm
        </h3>
        <p className="text-sm text-ink-2">
          {use.count} {use.count === 1 ? "placa" : "placas"} · aprovechamiento {Math.round(use.nesting.utilization * 100)} %
        </p>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {use.nesting.boards.map((placements, i) => (
          <figure key={i} className="space-y-1">
            <svg
              viewBox={`0 0 ${catalog.board.length} ${catalog.board.width}`}
              className="w-full rounded-lg border border-line bg-paper"
              role="img"
              aria-label={`Placa ${i + 1} de ${use.materialName}`}
            >
              <g transform={`translate(${catalog.board.trim} ${catalog.board.trim})`}>
                {placements.map((p) => {
                  const text = `${p.label} ${Math.round(p.length)}×${Math.round(p.width)}`;
                  // la letra se achica hasta entrar en la pieza; si queda ilegible, no se escribe
                  const fontSize = Math.min(64, p.h / 3, (p.w * 0.9) / (text.length * 0.56));
                  return (
                    <g key={p.id}>
                      <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="var(--color-accent-soft)" stroke="var(--color-accent)" strokeWidth={4} />
                      {fontSize >= 20 && (
                        <text
                          x={p.x + p.w / 2}
                          y={p.y + p.h / 2}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize={fontSize}
                          fill="var(--color-ink)"
                        >
                          {text}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
            <figcaption className="text-xs text-ink-2">
              Placa {i + 1} · {catalog.board.length} × {catalog.board.width} mm
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
