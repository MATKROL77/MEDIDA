/**
 * Arma la versión de prueba para publicar como página de Claude:
 * un HTML con el CSS adentro y un solo archivo de JavaScript al lado.
 *
 *   npm run artifact            → artifact-out/index.html y artifact-out/app.js
 *   npm run artifact -- <dir>   → en otra carpeta
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwind from "@tailwindcss/postcss";
import { build } from "esbuild";
import postcss from "postcss";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.resolve(process.argv[2] ?? path.join(root, "artifact-out"));
await mkdir(out, { recursive: true });

await build({
  entryPoints: [path.join(root, "artifact/entry.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  outfile: path.join(out, "app.js"),
  alias: {
    "next/link": path.join(root, "artifact/shims/next-link.tsx"),
    "next/dynamic": path.join(root, "artifact/shims/next-dynamic.tsx"),
  },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_ARTIFACT": '"1"',
  },
  logLevel: "warning",
});

const cssSource = await readFile(path.join(root, "src/app/globals.css"), "utf8");
const css = await postcss([tailwind({ base: root })]).process(cssSource, { from: path.join(root, "src/app/globals.css") });

// las tipografías salen de Google Fonts, el único lugar que deja cargar Claude
const html = `<title>Configurador Medida</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@500;600;700&display=swap">
<style>
:root { --font-inter: "Inter", ui-sans-serif, system-ui, sans-serif; --font-inter-tight: "Inter Tight", "Inter", ui-sans-serif, system-ui, sans-serif; }
${css.css}
html, body { background: var(--color-paper); color: var(--color-ink); }
body { font-family: var(--font-sans); font-size: 16px; }
</style>
<div id="app"></div>
<script src="app.js"></script>
`;
await writeFile(path.join(out, "index.html"), html);
console.log(`listo: ${out}`);
