# MEDIDA — estado operativo compartido

Actualizado: 2026-11-12 (Argentina).

## Verificado en esta etapa

**Migración.** MEDIDA vivía en `configurador/` de `MATKROL77/Investig`. Se
migró a `MATKROL77/MEDIDA` con su historial, tomando la versión de la rama
`codex/medida-demo-validation`, que era la publicada.

**Publicación.** `.github/workflows/deploy.yml` publica desde este
repositorio. La primera ejecución (11/11/2026) encontró el environment de
GitHub con el token de Cloudflare, publicó en
https://medida.matiascolimodio.workers.dev y comprobó HTTP 200 en `/`,
`/demo/` y `/demo/taller/`.

**Fase 1 — landing y conversión.** Landing nueva, catálogo de configuradores,
páginas de servicios, contacto por WhatsApp y email centralizado, aviso de
cookies, páginas legales, sitemap, robots, imagen para redes e íconos.

**Fase 3, parte local — favoritos y carrito.** Guardado de diseños en el
dispositivo, Mis diseños (favoritos y carrito de consulta), abrir, editar,
renombrar, duplicar, eliminar, consulta conjunta y guardado automático.

Evidencia, corrida en este repositorio:

- `npm test`: 34 pruebas (despiece, precio, contacto, diseños, consulta,
  consentimiento). `npm run typecheck`, `npm run lint` y `npm run build` sin
  errores.
- `node scripts/e2e.mjs`: 39 comprobaciones en Chromium a 390 y 1440 px. Las
  diez páginas cargan sin scroll horizontal ni errores; el aviso de cookies
  no bloquea, guarda la elección y se puede cambiar; el diseño sobrevive a
  recargar y a volver a entrar; guardar, editar, duplicar, renombrar, carrito
  y eliminar; "Enviar al taller" ofrece los dos caminos y la cotización de la
  demo no apunta a ningún número.
- Encabezados de caché y de seguridad (`public/_headers`) probados con
  `wrangler dev`.
- Revisión visual de landing, configurador, hoja de envío y Mis diseños.

## Sin verificar todavía

- El sitio publicado no se puede abrir desde el entorno donde trabajó el
  agente (la red de ese entorno no lo permite). La comprobación de producción
  es la del workflow: HTTP 200 de cada página y que la portada sea la de esta
  versión. Conviene mirarlo en un teléfono real.
- El 3D se probó con render por software. En ese modo la vista previa de un
  diseño guardado puede no llegar a capturarse; en un equipo con placa de
  video debería, pero no se pudo comprobar acá.
- No se probó en iPhone ni en Android reales.

## Pendiente

- Cuenta por email, sincronización entre dispositivos y panel de
  administración (necesitan el servidor).
- Recordatorios por email y notificaciones del navegador.
- Cuentas de empresas, configurador embebible y planes.
- Configuradores de las otras familias: hoy solo existe el de placares.
- Los textos legales describen el sistema completo; conviene que los revise un
  profesional antes de operar comercialmente.

## Informado por otros agentes, sin volver a verificar

- Publicación manual del 30/10/2026 (versión de Cloudflare
  `fca313e1-1629-4da3-b1cf-7f881a7080b6`), según el PR #1 de Investig.
