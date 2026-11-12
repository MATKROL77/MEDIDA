"use client";

import Link from "next/link";
import { useState } from "react";

import { ContactLink } from "@/components/site/ContactLink";
import { Sheet } from "@/components/site/Sheet";
import { IconArrowRight, IconCheck, IconCopy, IconDownload, IconMail, IconShare, IconWhatsapp } from "@/components/site/icons";
import type { DesignSummary } from "@/lib/designs";
import type { OrderPdf } from "@/lib/orderPdf";
import { money, summaryByTitle, type CutRow } from "@/lib/quote";
import { mailtoLink, whatsappLink } from "@/lib/site";
import type { Workshop } from "@/lib/workshop";

type Props = {
  /** qué mueble es: "Placard a medida" */
  title?: string;
  /** esta familia no arma PDF de despiece: se comparte el resumen */
  noPdf?: boolean;
  /** a quién le llega; null en la demo de MEDIDA, que no tiene taller */
  workshop: Workshop | null;
  summary: DesignSummary;
  price: number;
  /** el resumen en texto, como se manda por WhatsApp o email */
  message: string;
  pdf: OrderPdf | null;
  failed: boolean;
  rows: CutRow[];
  /** enlace que abre este mismo diseño */
  designLink: string;
  /** enlace a la vista del taller de este diseño */
  workshopHref: string;
  /** en el sitio de una empresa: avisa que la persona eligió un canal para mandar la consulta */
  onInquiry?: (channel: "whatsapp" | "email" | "share") => void;
  onClose: () => void;
};

const canSharePdf = () => {
  try {
    return typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [new File([""], "x.pdf", { type: "application/pdf" })] });
  } catch {
    return false;
  }
};

/**
 * "Enviar al taller".
 *
 * En el configurador de una empresa manda la consulta a esa empresa. En la
 * demo de MEDIDA no hay taller, así que primero pregunta qué busca la persona:
 * ver cómo sería la cotización de su diseño, o tener un configurador así en su
 * propia empresa. Son dos conversaciones distintas y no se mezclan.
 */
export function SendSheet(props: Props) {
  const [step, setStep] = useState<"choose" | "quote" | "business">("choose");
  if (props.workshop) {
    return (
      <Sheet title="Todo listo para mandar" eyebrow={`Consulta para ${props.workshop.name}`} onClose={props.onClose}>
        <Summary {...props} />
        <WorkshopActions {...props} workshop={props.workshop} />
      </Sheet>
    );
  }

  if (step === "choose") {
    return (
      <Sheet title="¿Qué querés hacer con este diseño?" eyebrow="Demostración de MEDIDA" onClose={props.onClose}>
        <div className="mt-5 grid gap-3">
          <Option title="Solicitar cotización del diseño" body="Mirá el resumen con las medidas, los materiales y los módulos, tal como lo recibiría un fabricante." onClick={() => setStep("quote")} />
          <Option
            title="Quiero un configurador como este para mi empresa"
            body="Si fabricás o vendés productos a medida, hablemos de cómo tenerlo en tu web."
            onClick={() => setStep("business")}
          />
        </div>
      </Sheet>
    );
  }

  if (step === "business") {
    return (
      <Sheet title="Un configurador como este, en tu empresa" eyebrow="MEDIDA para empresas" onClose={props.onClose}>
        <p className="mt-3 leading-relaxed text-ink-2">
          Se arma con tus productos, tus materiales y tu marca, y las consultas de tus clientes te llegan a vos. Escribime y lo vemos; no hace falta registrarse ni llenar
          un formulario.
        </p>
        <div className="mt-6 grid gap-2.5">
          <ContactLink channel="whatsapp" interest="demo" placement="demo-enviar" className="btn btn-whatsapp">
            <IconWhatsapp />
            Escribime por WhatsApp
          </ContactLink>
          <ContactLink channel="email" interest="demo" placement="demo-enviar" className="btn btn-secondary">
            <IconMail />
            Escribime por email
          </ContactLink>
        </div>
        <button type="button" onClick={() => setStep("choose")} className="mt-5 text-sm text-ink-2 underline underline-offset-4 hover:text-ink">
          Volver
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet title="Cotización de tu diseño" eyebrow="Demostración de MEDIDA" onClose={props.onClose}>
      <Summary {...props} />
      <p className="mt-5 rounded-2xl bg-accent-soft px-4 py-3 text-sm leading-relaxed text-accent-strong">
        <strong className="font-semibold">Esto es una demostración.</strong> MEDIDA es el software del configurador, no una fábrica de muebles: no hay un taller asociado
        que vaya a fabricar este diseño, y los precios son de muestra. En el sitio de un fabricante, este resumen le llega a esa empresa para que te cotice.
      </p>
      <DemoActions {...props} />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <p className="text-sm text-ink-2">¿Fabricás muebles a medida?</p>
        <button type="button" onClick={() => setStep("business")} className="link-arrow text-sm">
          Quiero un configurador como este
        </button>
      </div>
    </Sheet>
  );
}

function Option({ title, body, onClick }: { title: string; body: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex items-center gap-4 rounded-2xl border border-line p-5 text-left transition-colors duration-200 hover:border-ink hover:bg-paper">
      <span className="flex-1">
        <span className="block font-display text-lg font-semibold leading-snug tracking-tight">{title}</span>
        <span className="mt-1.5 block text-sm leading-relaxed text-ink-2">{body}</span>
      </span>
      <IconArrowRight className="shrink-0 text-ink-3 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-ink" />
    </button>
  );
}

/** el mueble, sus medidas, materiales y módulos, y la tapa del PDF */
function Summary({ summary, price, pdf, failed, rows, title = "Placard a medida", noPdf }: Props) {
  const pieces = summaryByTitle(rows);
  const total = pieces.reduce((n, p) => n + p.qty, 0);
  return (
    <div className={`mt-5 grid gap-4 ${noPdf ? "" : "grid-cols-[104px_1fr] sm:grid-cols-[120px_1fr]"}`}>
      {!noPdf && (
        <div className="aspect-[1/1.414] overflow-hidden rounded-lg border border-line bg-paper">
          {pdf ? <img src={pdf.preview} alt="Tapa del PDF con el diseño" className="fade-in h-full w-full object-cover" /> : <div className={`h-full w-full ${failed ? "" : "shimmer"}`} />}
        </div>
      )}
      <div className="min-w-0 text-sm">
        <p className="font-display text-lg font-semibold leading-tight tracking-tight">{title}</p>
        <p className="mt-0.5 tabular-nums text-ink-2">{summary.dimensions}</p>
        <ul className="mt-3 space-y-1 text-[0.82rem] leading-snug text-ink-2">
          {summary.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
          {total > 0 && (
            <li>
              {total} piezas de placa en {pieces.length} tipos
            </li>
          )}
        </ul>
        <p className="mt-3">
          <span className="font-semibold tabular-nums">{money(price)}</span> <span className="text-xs text-ink-2">estimado</span>
        </p>
        {!noPdf && <p className="mt-1 text-xs text-ink-2">{pdf ? `PDF de ${pdf.pages} hojas con el dibujo de cada pieza.` : failed ? "No se pudo armar el PDF." : "Armando el PDF…"}</p>}
      </div>
    </div>
  );
}

function usePdfFile(pdf: OrderPdf | null, fileName: string) {
  const file = pdf ? new File([pdf.blob], fileName, { type: "application/pdf" }) : null;
  const download = () => {
    if (!file) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  return { file, download };
}

/** en la demo no hay a quién mandarlo: la persona lo comparte con quien quiera, o se lo lleva */
function DemoActions({ pdf, message, designLink, workshopHref, noPdf }: Props) {
  const [shareable] = useState(() => !noPdf && canSharePdf());
  const [copied, setCopied] = useState(false);
  const { file, download } = usePdfFile(pdf, "diseno-medida.pdf");

  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], text: message, title: "Mi diseño en MEDIDA" });
    } catch {
      // si la persona cancela no pasa nada
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(designLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt("Copiá el enlace de tu diseño:", designLink);
    }
  };

  return (
    <>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {shareable ? (
          <button type="button" onClick={share} disabled={!file} className="btn btn-primary disabled:opacity-50 sm:col-span-2">
            <IconShare />
            Compartir el diseño
          </button>
        ) : (
          // sin número: WhatsApp deja elegir a quién mandárselo
          <a href={whatsappLink(null, message)} target="_blank" rel="noopener noreferrer" className="btn btn-primary sm:col-span-2">
            <IconShare />
            Compartir por WhatsApp
          </a>
        )}
        {!noPdf && (
          <button type="button" onClick={download} disabled={!file} className="btn btn-ghost disabled:opacity-50">
            <IconDownload />
            Descargar el PDF
          </button>
        )}
        <button type="button" onClick={copy} className={`btn btn-ghost ${noPdf ? "sm:col-span-2" : ""}`}>
          {copied ? <IconCheck /> : <IconCopy />}
          {copied ? "Enlace copiado" : "Copiar el enlace"}
        </button>
      </div>
      {!noPdf && (
        <Link href={workshopHref} className="link-arrow mt-4 text-sm">
          Ver lo que recibiría el fabricante
        </Link>
      )}
    </>
  );
}

/** en el sitio de una empresa: la consulta va a su WhatsApp o a su email */
function WorkshopActions({ pdf, message, workshop, onInquiry }: Props & { workshop: Workshop }) {
  const [shareable] = useState(canSharePdf);
  const fileName = `consulta-${workshop.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
  const { file, download } = usePdfFile(pdf, fileName);

  const share = async () => {
    if (!file) return;
    onInquiry?.("share");
    try {
      await navigator.share({ files: [file], text: message, title: `Consulta para ${workshop.name}` });
    } catch {
      // si la persona cancela no pasa nada; queda la hoja abierta
    }
  };

  return (
    <>
      <div className="mt-5 grid gap-2">
        {shareable && (
          <button type="button" onClick={share} disabled={!file} className="btn btn-whatsapp disabled:opacity-60">
            <IconWhatsapp />
            Mandar el PDF por WhatsApp
          </button>
        )}
        <a
          href={whatsappLink(workshop.whatsapp, message)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onInquiry?.("whatsapp")}
          className={`btn ${shareable ? "btn-ghost" : "btn-whatsapp"}`}
        >
          {!shareable && <IconWhatsapp />}
          {shareable ? "Mandar solo el resumen" : "Abrir WhatsApp con el resumen"}
        </a>
        {workshop.email && (
          <a href={mailtoLink(workshop.email, "Consulta por un placard a medida", message)} onClick={() => onInquiry?.("email")} className="btn btn-ghost">
            <IconMail />
            Mandar por email
          </a>
        )}
        <button type="button" onClick={download} disabled={!file} className="btn btn-ghost disabled:opacity-60">
          <IconDownload />
          Descargar el PDF
        </button>
      </div>
      {!shareable && (
        <p className="mt-3 text-xs leading-relaxed text-ink-2">El resumen lleva el enlace al despiece con los dibujos. Si querés, adjuntá también el PDF en el chat.</p>
      )}
    </>
  );
}
