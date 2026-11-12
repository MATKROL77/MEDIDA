/** los emails que manda MEDIDA: el acceso a la cuenta y los recordatorios */

import type { Mail } from "./types.ts";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function layout(title: string, paragraphs: string[], button: { label: string; href: string } | null, footer: string): string {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f5f5f6;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111214">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px"><tr><td style="padding:32px">
<p style="margin:0 0 24px;font-size:13px;font-weight:700;letter-spacing:3px">MEDIDA</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25">${esc(title)}</h1>
${paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#5f6368">${p}</p>`).join("\n")}
${button ? `<p style="margin:24px 0"><a href="${esc(button.href)}" style="display:inline-block;background:#111214;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 24px;border-radius:999px">${esc(button.label)}</a></p>` : ""}
<p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #e3e3e6;font-size:12px;line-height:1.6;color:#8b8e94">${footer}</p>
</td></tr></table></td></tr></table></body></html>`;
}

export function loginMail(to: string, link: string, code: string): Mail {
  return {
    to,
    subject: "Tu acceso a MEDIDA",
    text: [
      "Para entrar a MEDIDA y ver tus diseños guardados, abrí este enlace:",
      link,
      "",
      `O escribí este código en la página: ${code}`,
      "",
      "Vence en 15 minutos y sirve una sola vez. Si no lo pediste, ignorá este mensaje: nadie entra a tu cuenta sin él.",
    ].join("\n"),
    html: layout(
      "Tu acceso a MEDIDA",
      [
        "Tocá el botón para entrar y ver tus diseños guardados.",
        `O escribí este código en la página: <strong style="color:#111214;font-size:20px;letter-spacing:3px">${esc(code)}</strong>`,
      ],
      { label: "Entrar a MEDIDA", href: link },
      "Vence en 15 minutos y sirve una sola vez. Si no lo pediste, ignorá este mensaje: nadie entra a tu cuenta sin él.",
    ),
  };
}

export type ReminderInfo = {
  /** 1: al día de dejar el diseño; 2: a los tres días */
  step: number;
  designName: string;
  /** "placard", "mesa": para decir qué se estaba armando */
  noun: string;
  /** cuántos diseños más tiene guardados */
  others: number;
  link: string;
  accountLink: string;
};

export function reminderText(info: ReminderInfo): { title: string; body: string } {
  const more = info.others > 0 ? ` Tenés ${info.others} ${info.others === 1 ? "diseño más" : "diseños más"} guardados.` : "";
  if (info.step === 1) return { title: "Tu diseño sigue guardado en MEDIDA", body: `«${info.designName}» está tal como lo dejaste.${more}` };
  return { title: `Podés continuar personalizando tu ${info.noun}`, body: `«${info.designName}» sigue listo para seguir editándolo.${more}` };
}

export function reminderMail(to: string, info: ReminderInfo): Mail {
  const { title, body } = reminderText(info);
  const footer = `Recibís este mensaje porque activaste los recordatorios en MEDIDA. Es ${info.step === 1 ? "el primero de dos" : "el último"}: si no volvés a editar, no llegan más. Podés desactivarlos en <a href="${esc(info.accountLink)}" style="color:#8b8e94">tu cuenta</a>.`;
  return {
    to,
    subject: title,
    text: [body, "", "Seguí donde lo dejaste:", info.link, "", "El enlace sirve una sola vez y vence en 7 días.", `Para dejar de recibir recordatorios: ${info.accountLink}`].join("\n"),
    html: layout(title, [esc(body)], { label: "Seguir con mi diseño", href: info.link }, `El enlace sirve una sola vez y vence en 7 días. ${footer}`),
  };
}
