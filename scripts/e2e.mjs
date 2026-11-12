/**
 * Pruebas funcionales del sitio en un navegador de verdad.
 *
 *   npm run build && npx serve out -l 4100     (solo el sitio)
 *   npm run preview                            (el sitio con su servidor, en el puerto 8787)
 *   node scripts/e2e.mjs [http://localhost:4100]
 *
 * Recorre lo que hace una persona: mira la landing en teléfono y en
 * escritorio, elige sobre las cookies, arma un placard, lo guarda, lo
 * recupera, lo duplica, arma una consulta conjunta y abre "Enviar al taller".
 * Si el servidor está, prueba además la cuenta y la sincronización.
 *
 * Necesita Playwright con Chromium, que no es dependencia del proyecto.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = (() => {
  try {
    return require("playwright");
  } catch {
    return createRequire("/")("playwright");
  }
})();

const base = (process.argv[2] ?? "http://localhost:4100").replace(/\/+$/, "");
const results = [];
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    results.push(`  ok   ${name}`);
  } catch (e) {
    failed++;
    results.push(`  FALLA ${name}\n        ${String(e.message ?? e).split("\n")[0]}`);
  }
}
const assert = (cond, message) => {
  if (!cond) throw new Error(message);
};

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

/** una visita nueva: sin nada guardado, con el tamaño de pantalla pedido */
async function visit(width, height, { consent = true } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce", isMobile: width < 500, hasTouch: width < 500 });
  if (consent) {
    await context.addInitScript(() => {
      if (!localStorage.getItem("medida.consent")) localStorage.setItem("medida.consent", JSON.stringify({ id: "prueba-0000", version: "2026-11", at: 1, analytics: false, marketing: false }));
    });
  }
  const page = await context.newPage();
  // sin placa de video el 3D se dibuja por software y todo tarda más
  page.setDefaultTimeout(90_000);
  page.setDefaultNavigationTimeout(120_000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return { context, page, errors };
}
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// ---------------------------------------------------------------- landing y páginas

const PAGES = ["/", "/configuradores/", "/servicios/", "/servicios/configurador-para-tu-web/", "/servicios/web-completa/", "/servicios/plataforma/", "/mis-disenos/", "/privacidad/", "/cookies/", "/terminos/"];

for (const [width, height] of [
  [390, 844],
  [1440, 900],
]) {
  const { context, page, errors } = await visit(width, height);
  for (const path of PAGES) {
    await check(`${path} a ${width} px: carga, sin scroll horizontal ni errores`, async () => {
      errors.length = 0;
      const res = await page.goto(base + path, { waitUntil: "networkidle" });
      assert(res.status() === 200, `respondió ${res.status()}`);
      assert((await page.locator("h1").count()) === 1, "tiene que haber un solo h1");
      const extra = await overflow(page);
      assert(extra <= 0, `sobran ${extra} px de ancho`);
      assert(errors.length === 0, `error en la página: ${errors[0]}`);
    });
  }
  await context.close();
}

{
  const { context, page } = await visit(1440, 900);
  await page.goto(base + "/", { waitUntil: "networkidle" });

  await check("landing: título, subtítulo y los dos botones del hero", async () => {
    const h1 = (await page.locator("h1").innerText()).replace(/\s+/g, " ");
    assert(h1.includes("Tus productos.") && h1.includes("Infinitas configuraciones."), `h1: ${h1}`);
    assert(await page.getByText("Convertí tus productos personalizados en experiencias interactivas de compra.").isVisible(), "falta el subtítulo");
    assert((await page.getByRole("link", { name: "Probar configuradores" }).getAttribute("href")) === "/configuradores/", "Probar configuradores no va al catálogo");
    const wa = await page.getByRole("link", { name: "Quiero MEDIDA para mi empresa" }).getAttribute("href");
    assert(/^https:\/\/wa\.me\/\d{8,15}\?text=/.test(wa), `enlace de WhatsApp: ${wa}`);
  });

  await check("contacto: todo enlace de WhatsApp y de email sale del mismo contacto y lleva mensaje", async () => {
    const hrefs = await page.locator('a[href^="https://wa.me/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    assert(hrefs.length >= 6, `hay ${hrefs.length} enlaces de WhatsApp`);
    const numbers = new Set(hrefs.map((h) => h.match(/wa\.me\/(\d+)/)?.[1]));
    assert(numbers.size === 1, `números distintos: ${[...numbers]}`);
    assert(hrefs.every((h) => decodeURIComponent(h.split("text=")[1] ?? "").startsWith("Hola")), "algún enlace no lleva mensaje");
    const mails = await page.locator('a[href^="mailto:"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    assert(mails.length >= 3 && mails.every((m) => m.includes("subject=") && m.includes("body=")), "algún email no lleva asunto y texto");
  });

  await check("contacto: al elegir un interés cambia el mensaje precargado", async () => {
    const section = page.locator("#contacto");
    await section.getByRole("button", { name: "Web completa con configuradores" }).click();
    const wa = await section.getByRole("link", { name: "Escribime por WhatsApp" }).getAttribute("href");
    assert(decodeURIComponent(wa).includes("Hola, quiero una página web con configuradores de productos integrados."), wa);
    await section.getByRole("button", { name: "Una página web" }).click();
    const wa2 = await section.getByRole("link", { name: "Escribime por WhatsApp" }).getAttribute("href");
    assert(decodeURIComponent(wa2).includes("me interesa contratar una página web profesional"), wa2);
  });

  await check("familias: una sola con demo, las demás dicen que están en desarrollo", async () => {
    assert((await page.getByText("Demo funcionando").count()) === 1, "tiene que haber una demo");
    assert((await page.getByText("En desarrollo", { exact: true }).count()) === 5, "tienen que ser cinco en desarrollo");
  });

  await check("hero: el motor 3D no se baja con la página", async () => {
    // con movimiento reducido el 3D espera a que lo pidan: no tiene que haber lienzo
    assert((await page.locator("canvas").count()) === 0, "hay un lienzo 3D sin haberlo pedido");
    assert(await page.getByRole("button", { name: "Ver en 3D" }).isVisible(), "falta el botón para activarlo");
  });
  await context.close();
}

// ---------------------------------------------------------------- cookies

{
  const { context, page } = await visit(1440, 900, { consent: false });
  await page.goto(base + "/", { waitUntil: "networkidle" });
  const banner = page.getByRole("region", { name: "Aviso de cookies" });

  await check("cookies: el aviso aparece, no tapa la página y tiene las tres opciones", async () => {
    await banner.waitFor();
    for (const name of ["Aceptar", "Rechazar", "Personalizar"]) assert(await banner.getByRole("button", { name }).isVisible(), `falta ${name}`);
    // la página se puede usar con el aviso abierto
    await page.getByRole("link", { name: "Probar configuradores" }).click({ trial: true });
  });

  await check("cookies: rechazar guarda la elección y el aviso no vuelve", async () => {
    await banner.getByRole("button", { name: "Rechazar" }).click();
    await banner.waitFor({ state: "hidden" });
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("medida.consent")));
    assert(stored.analytics === false && stored.marketing === false && stored.id && stored.at, JSON.stringify(stored));
    await page.reload({ waitUntil: "networkidle" });
    assert((await banner.count()) === 0, "el aviso volvió a aparecer");
  });

  await check("cookies: se pueden cambiar después desde el pie", async () => {
    await page.getByRole("contentinfo").getByRole("button", { name: "Preferencias de cookies" }).click();
    const dialog = page.getByRole("dialog", { name: "Preferencias de cookies" });
    await dialog.waitFor();
    await dialog.getByText("Medición", { exact: true }).click();
    await dialog.getByRole("button", { name: "Guardar preferencias" }).click();
    await dialog.waitFor({ state: "hidden" });
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("medida.consent")));
    assert(stored.analytics === true && stored.marketing === false, JSON.stringify(stored));
  });
  await context.close();
}

// ---------------------------------------------------------------- configurador, guardado y carrito

{
  const { context, page, errors } = await visit(1440, 900);
  await page.goto(base + "/demo/?calidad=baja", { waitUntil: "networkidle" });
  const width = page.locator("#dim-Ancho");

  await check("configurador: cambiar una medida actualiza el precio y la dirección", async () => {
    const before = await page.getByText(/^\$\s?[\d.]+$/).first().innerText();
    await width.fill("300");
    await width.blur();
    await page.waitForFunction(() => new URLSearchParams(location.search).has("c"));
    await page.waitForTimeout(900);
    const after = await page.getByText(/^\$\s?[\d.]+$/).first().innerText();
    assert(before !== after, `el precio no cambió: ${before}`);
  });

  await check("configurador: el diseño sobrevive a recargar y a volver a entrar sin enlace", async () => {
    await page.reload({ waitUntil: "networkidle" });
    assert((await width.inputValue()) === "300", "al recargar se perdió el ancho");
    await page.goto(base + "/demo/?calidad=baja", { waitUntil: "networkidle" });
    assert((await width.inputValue()) === "300", "sin enlace no recuperó el borrador");
    assert(await page.getByText("Recuperamos el diseño que estabas armando.").isVisible(), "no avisó que lo recuperó");
  });

  await check("guardar: el diseño queda en favoritos con sus datos", async () => {
    await page.getByRole("button", { name: "Guardar este diseño" }).click();
    const dialog = page.getByRole("dialog", { name: "Guardar este diseño" });
    await dialog.getByLabel("Nombre").fill("Placard del dormitorio");
    await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    assert(await page.getByText("Guardado en tus favoritos.").isVisible(), "no confirmó el guardado");
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem("medida.designs.v1")));
    const d = state.designs[0];
    assert(state.designs.length === 1 && d.name === "Placard del dormitorio" && d.favorite && !d.cart, JSON.stringify(d).slice(0, 200));
    assert(d.type === "placares" && d.summary.dimensions.startsWith("300 ×") && d.price > 0 && d.createdAt && d.updatedAt && /^[0-9a-f-]{36}$/.test(d.id), "faltan datos del diseño");
    assert(d.config.runs[0].width === 3000 && d.config.bodyMaterial && d.config.doorMaterial, "falta la configuración");
  });

  await check("guardar: editar un diseño guardado lo actualiza solo", async () => {
    await page.locator("#dim-Alto").fill("220");
    await page.locator("#dim-Alto").blur();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("medida.designs.v1")).designs[0].config.height === 2200, null, { timeout: 30_000 });
    const d = await page.evaluate(() => JSON.parse(localStorage.getItem("medida.designs.v1")).designs[0]);
    assert(d.summary.dimensions === "300 × 220 × 60 cm" && d.updatedAt > d.createdAt, d.summary.dimensions);
  });

  await check("enviar al taller: en la demo ofrece los dos caminos, separados", async () => {
    await page.getByRole("button", { name: "Enviar al taller" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /Solicitar cotización del diseño/ }).waitFor();
    await dialog.getByRole("button", { name: /Quiero un configurador como este para mi empresa/ }).click();
    const wa = await dialog.getByRole("link", { name: "Escribime por WhatsApp" }).getAttribute("href");
    assert(decodeURIComponent(wa).includes("estuve probando MEDIDA y me interesa tener un configurador de este estilo para mi empresa"), wa);
    assert((await dialog.getByRole("link", { name: "Escribime por email" }).getAttribute("href")).startsWith("mailto:"), "falta el email");
    await dialog.getByRole("button", { name: "Volver" }).click();
    await dialog.getByRole("button", { name: /Solicitar cotización del diseño/ }).click();
    assert(await dialog.getByText("Esto es una demostración.").isVisible(), "no aclara que es una demostración");
    assert(await dialog.getByText("300 × 220 × 60 cm").isVisible(), "falta el resumen con las medidas");
    // el resumen no se le manda a MEDIDA: ningún enlace de esa pantalla lleva su número
    const targeted = await dialog.locator('a[href^="https://wa.me/"]').evaluateAll((as) => as.filter((a) => /wa\.me\/\d/.test(a.href)).length);
    assert(targeted === 0, "la cotización de la demo apunta a un número");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
  });

  await check("mis diseños: abrir, renombrar, duplicar, carrito y eliminar", async () => {
    await page.goto(base + "/mis-disenos/", { waitUntil: "networkidle" });
    const card = page.getByRole("listitem").filter({ hasText: "Placard del dormitorio" }).first();
    assert(await card.getByText("300 × 220 × 60 cm").isVisible(), "la tarjeta no muestra las medidas");
    assert((await card.getByRole("link", { name: "Abrir y editar" }).getAttribute("href")).startsWith("/demo/?id="), "no abre el diseño guardado");
    await card.getByRole("button", { name: "Duplicar Placard del dormitorio" }).click();
    await page.getByRole("listitem").filter({ hasText: "Placard del dormitorio (copia)" }).waitFor();
    const copy = page.getByRole("listitem").filter({ hasText: "Placard del dormitorio (copia)" });
    await copy.getByRole("button", { name: "Cambiar el nombre de Placard del dormitorio (copia)" }).click();
    // al editar, el título pasa a ser un campo: se busca por su etiqueta
    await page.getByLabel("Nombre del diseño").fill("Placard del pasillo");
    await page.keyboard.press("Enter");
    const second = page.getByRole("listitem").filter({ hasText: "Placard del pasillo" });
    await second.waitFor();
    for (const item of [card, second]) await item.getByRole("button", { name: "Agregar al carrito de consulta" }).click();
    await page.getByRole("tab", { name: /Carrito de consulta/ }).click();
    // solo las tarjetas: cada una tiene adentro su propia lista de características
    const inCart = await page.locator('ul[aria-label="Lista de diseños"] > li').count();
    assert(inCart === 2, `el carrito tiene ${inCart} muebles, tienen que ser dos`);
    assert(await page.getByText("Esto no es una compra").isVisible(), "el carrito no aclara que no es una compra");
  });

  await check("consulta conjunta: lleva todos los muebles y no se le manda a MEDIDA", async () => {
    await page.getByRole("button", { name: "Enviar consulta conjunta" }).click();
    const dialog = page.getByRole("dialog", { name: "Tu consulta conjunta" });
    const share = await dialog.getByRole("link", { name: "WhatsApp", exact: true }).getAttribute("href");
    const text = decodeURIComponent(share.split("text=")[1]);
    assert(share.startsWith("https://wa.me/?text="), "la consulta de la demo apunta a un número");
    assert(text.includes("Placard del dormitorio") && text.includes("Placard del pasillo") && text.includes("Total estimado") && text.includes("/demo/?c="), text.slice(0, 200));
    assert(await dialog.getByText("Esto es una demostración.").isVisible(), "no aclara que es una demostración");
    await page.keyboard.press("Escape");
  });

  await check("mis diseños: eliminar pide confirmación y borra", async () => {
    await page.getByRole("tab", { name: /Todos/ }).click();
    const item = page.getByRole("listitem").filter({ hasText: "Placard del pasillo" });
    await item.getByRole("button", { name: "Eliminar Placard del pasillo" }).click();
    await item.getByRole("button", { name: "Sí" }).click();
    await item.waitFor({ state: "detached" });
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem("medida.designs.v1")));
    assert(state.designs.length === 1 && state.tombstones.length === 1, "no quedó registrado el borrado");
  });

  await check("abrir un diseño guardado trae sus medidas", async () => {
    await page.getByRole("link", { name: "Abrir y editar" }).click();
    await page.waitForURL(/\/demo\/\?id=/);
    await page.locator("#dim-Ancho").waitFor();
    assert((await page.locator("#dim-Ancho").inputValue()) === "300" && (await page.locator("#dim-Alto").inputValue()) === "220", "no abrió con las medidas guardadas");
    assert(await page.getByRole("button", { name: /Diseño guardado/ }).isVisible(), "no muestra que está guardado");
  });

  await check("configurador: sin errores de página en todo el recorrido", async () => assert(errors.length === 0, errors[0]));
  await context.close();
}

{
  const { context, page } = await visit(390, 844);
  await check("configurador en teléfono: sin scroll horizontal y con la barra de precio a la vista", async () => {
    await page.goto(base + "/demo/?calidad=baja", { waitUntil: "networkidle" });
    assert((await overflow(page)) <= 0, "sobra ancho");
    assert(await page.getByRole("button", { name: "Enviar al taller" }).isVisible(), "no se ve Enviar al taller");
    assert(await page.getByRole("button", { name: "Guardar este diseño" }).isVisible(), "no se ve Guardar");
  });
  await context.close();
}

// ---------------------------------------------------------------- cuenta y sincronización (solo con el servidor)

const hasServer = await fetch(base + "/api/health").then((r) => r.ok && (r.headers.get("content-type") ?? "").includes("json")).catch(() => false);
const outbox = await fetch(base + "/api/dev/outbox").then((r) => (r.ok ? r.json() : null)).catch(() => null);

if (hasServer && outbox) {
  const email = `prueba-${Date.now()}@ejemplo.com`;
  const lastMail = async () => (await (await fetch(base + "/api/dev/outbox")).json()).mails.find((m) => m.recipient === email);
  const phone = await visit(390, 844);

  await check("cuenta: se entra con el código que llega por email, sin contraseña", async () => {
    const page = phone.page;
    await page.goto(base + "/demo/?calidad=baja", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Guardar este diseño" }).click();
    await page.getByRole("dialog").getByLabel("Nombre").fill("Placard sincronizado");
    await page.getByRole("dialog").getByRole("button", { name: "Guardar", exact: true }).click();
    await page.getByText("Guardado en tus favoritos.").waitFor();
    await page.goto(base + "/cuenta/", { waitUntil: "networkidle" });
    assert((await page.locator('input[type="password"]').count()) === 0, "no tiene que pedir contraseña");
    const marketing = page.getByRole("checkbox");
    assert(!(await marketing.isChecked()), "las novedades tienen que venir sin tildar");
    await page.getByLabel("Tu email").fill(email);
    await page.getByRole("button", { name: "Recibir mi acceso" }).click();
    await page.getByLabel("Código").waitFor();
    const code = /código en la página: (\d{6})/.exec((await lastMail()).body)[1];
    await page.getByLabel("Código").fill(code);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.getByRole("heading", { name: "Tu cuenta" }).waitFor();
    assert(await page.getByText(email).isVisible(), "no muestra el email de la cuenta");
    const cookies = await phone.context.cookies();
    const session = cookies.find((c) => c.name === "medida_s");
    assert(session && session.httpOnly && session.sameSite === "Lax", "la cookie de sesión no está protegida");
  });

  const laptop = await visit(1440, 900);
  await check("cuenta: el enlace del email abre sesión en otro dispositivo y trae los diseños", async () => {
    await fetch(base + "/api/auth/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    const link = /(http\S+\/cuenta\/verificar\/#t=[\w-]+)/.exec((await lastMail()).body)[1];
    const page = laptop.page;
    await page.goto(link);
    await page.waitForURL(/\/mis-disenos\//, { timeout: 20000 });
    await page.getByRole("heading", { name: "Placard sincronizado" }).waitFor();
    assert(!page.url().includes("#t="), "el enlace quedó en la dirección");
    await page.goto(link);
    await page.getByRole("heading", { name: "Este enlace ya no sirve." }).waitFor();
  });

  await check("cuenta: lo que se cambia en un dispositivo aparece en el otro", async () => {
    const page = laptop.page;
    await page.goto(base + "/mis-disenos/", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Cambiar el nombre de Placard sincronizado" }).click();
    await page.getByLabel("Nombre del diseño").fill("Renombrado en la compu");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(3500);
    await phone.page.goto(base + "/mis-disenos/", { waitUntil: "networkidle" });
    await phone.page.getByRole("heading", { name: "Renombrado en la compu" }).waitFor({ timeout: 15000 });
  });

  await check("cuenta: recordatorios apagados de entrada; cerrar sesión saca los diseños del dispositivo", async () => {
    const page = phone.page;
    await page.goto(base + "/cuenta/", { waitUntil: "networkidle" });
    const byEmail = page.getByRole("checkbox", { name: /Por email/ });
    assert(!(await byEmail.isChecked()), "los recordatorios tienen que arrancar apagados");
    await page.getByText("Por email", { exact: true }).click();
    await page.waitForFunction(() => document.querySelector('input[type="checkbox"]')?.checked === true);
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await page.getByRole("heading", { name: /Guardá tu diseño/ }).waitFor();
    const left = await page.evaluate(() => JSON.parse(localStorage.getItem("medida.designs.v1") ?? '{"designs":[]}').designs.length);
    assert(left === 0, "quedaron diseños en el dispositivo");
  });
  await phone.context.close();
  await laptop.context.close();
} else {
  results.push(hasServer ? "  --   cuenta: el servidor no está en modo de prueba (sin bandeja de emails)" : "  --   cuenta y sincronización: sin servidor, no se prueban");
}

await browser.close();
console.log(results.join("\n"));
console.log(failed ? `\n${failed} con falla` : "\ntodo en orden");
process.exit(failed ? 1 : 0);
