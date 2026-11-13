# MEDIDA — estado operativo compartido

Actualizado: 2026-11-13 (Argentina).

## Verificado

**Migración.** MEDIDA vivía en `configurador/` de `MATKROL77/Investig`. Se
migró a `MATKROL77/MEDIDA` con su historial, tomando la versión de la rama
`codex/medida-demo-validation`, que era la publicada.

**Publicación.** `.github/workflows/deploy.yml` publica desde este repositorio
en https://medida.matiascolimodio.workers.dev. Cuatro ejecuciones en verde
(11 y 12/11/2026). La última comprobó en producción: HTTP 200 de las páginas,
que la portada es la de esta versión, que `/api/health` y `/api/public/site`
responden, que `/api/me`, `/api/panel` y `/api/admin/overview` sin sesión dan
401, y que el configurador embebido de una empresa inexistente da 404.

**Fase 1 — landing y conversión.** Landing, catálogo, servicios, contacto por
WhatsApp y email centralizado, cookies, legales, SEO.

**Fase 2 — configuradores ampliados.** Mesas y escritorios, ratonas y mesas
de luz, muebles de TV, bibliotecas y sillones modulares, sobre el motor del
placard. Cada uno con medidas, opciones, terminaciones, precio de muestra,
guardado y consulta. Además: paleta blanca y marrón, títulos con serif, vidrio
en lo que flota y los configuradores abiertos como ventana sobre la página.

**Fase 3 — favoritos y carrito.** Guardado en el dispositivo, Mis diseños,
consulta conjunta, guardado automático, cuenta por email y sincronización.

**Fase 4 — recordatorios.** Consentimiento aparte, dos recordatorios como
máximo con cancelación automática, notificaciones del navegador, enlaces de un
solo uso.

**Fase 5 — base SaaS.** Empresas con datos separados, tope de configuradores
por plan, panel de empresa, configurador embebible que le escribe a la
empresa, administración.

**Realismo y rediseño (13/11/2026).** Modo foto con trazado de rayos en el
navegador (`three-gpu-pathtracer`): con la escena quieta, el 3D se recalcula
con luz que rebota, luces de área en cada tira LED y un softbox, con un filtro
de grano; apenas algo se mueve vuelve el 3D rápido. Estudio tipo ciclorama
(fondo curvo sin esquinas) con piso de cemento que se funde en él; luz y
reflejos de una foto HDR de estudio (CC0). Coordenadas de textura en metros en
cada pieza. Cuero en los sillones (suela y negro, con recargo de muestra). La
página pasa a cuero beige iluminado con luz azul marino, texto azul noche,
botones y detalles de madera rojiza y superficies de vidrio más
transparentes; la portada es el sillón curvo de bouclé calculado con
trazado de rayos, con modelo, tela y cuerpos para cambiar; una sección
muestra las texturas reales del motor. La barra de precio del configurador
quedó más chica.

Evidencia, corrida en este repositorio:

- `npm test`: 67 pruebas. 7 arman los muebles nuevos en todos sus extremos y
  comprueban medidas reales, que cada pieza entre en una placa y que el precio
  no baje al agrandar. 26 son de la API contra SQLite en memoria: acceso,
  sesión, vencimientos, límites de pedidos, sincronización y aislamiento entre
  cuentas, recordatorios con el reloj adelantado, firma de notificaciones,
  medición sin identificadores, permisos de administración y aislamiento entre
  empresas.
- `npm run typecheck` (sitio, Worker y pruebas), `npm run lint`,
  `npm run build`: sin errores.
- `node scripts/e2e.mjs` contra el runtime local de Cloudflare
  (`npm run preview`): 59 comprobaciones en Chromium a 390 y 1440 px, todas en
  orden. Incluye entrar con el código, abrir el enlace en otro dispositivo,
  ver ahí los diseños, que un cambio en uno aparezca en el otro, crear una
  empresa, que el plan le ponga tope, y que el configurador embebido lleve su
  marca y su WhatsApp.

## Hecho pero sin poder verificarlo en producción

- **Acceso por email.** En producción no hay proveedor de email configurado:
  falta el secreto `RESEND_API_KEY` (ver README, "Para activar el acceso por
  email"). Hasta entonces nadie puede entrar a una cuenta, ni a `/admin/`, ni
  a `/panel/`; el sitio lo muestra como no disponible. El flujo completo se
  probó en local, donde los emails quedan en una bandeja de prueba.
- **Envío real de emails y de notificaciones.** La lógica y la firma están
  probadas; que Resend y los servicios de notificaciones de los navegadores
  entreguen el mensaje no se pudo comprobar desde el entorno de trabajo.
- **El sitio publicado en un navegador.** Ese entorno no puede abrir la
  dirección pública: la comprobación de producción es la del workflow.
  Conviene mirarlo en un teléfono real.
- **Vista previa de un diseño guardado.** Con render por software (el del
  entorno de trabajo) no llega a capturarse; en un equipo con placa de video
  debería.
- **iPhone y Android reales.** No se probaron. En iPhone las notificaciones
  solo existen si el sitio se agrega a la pantalla de inicio.

## Pendiente

- **Despiece completo de las familias nuevas.** Listan sus piezas de placa,
  pero no tienen PDF, plano de corte ni vista del taller como el placard. Sus
  reglas de fabricación son más simples que las del placard y conviene
  revisarlas con un fabricante antes de usarlas para producir.
- **Modo foto en placas reales.** El trazado de rayos se probó en el entorno
  de trabajo, que no tiene placa de video (Chromium con render por software):
  ahí funciona pero tarda minutos por imagen. En una computadora con placa
  debería refinar en segundos; falta medirlo en equipos reales, sobre todo en
  notebooks con video integrado y en teléfonos (donde arranca apagado).
- **Modelos.** Los muebles se arman con piezas paramétricas (placas con canto
  redondeado, almohadones, cilindros), no con modelos de un artista 3D: las
  costuras, los pliegues de una tela o el canto de un herraje no están.
- **Facturación recurrente.** No hay cobros ni suscripciones; el plan de una
  empresa es un nombre y un tope cargados a mano.
- **Textos legales.** Describen lo que el sistema hace y citan la Ley 25.326;
  conviene que los revise un profesional.
- **Investig.** En la rama `claude/dreamy-franklin-wxoz6q` de ese repositorio
  quedó el puntero a este y se quitó el workflow que publicaba desde allá,
  para que no pueda pisar esta publicación. La carpeta `configurador/` sigue
  ahí como copia congelada: borrarla por git fue rechazado por el servidor
  desde el entorno de trabajo, así que queda para hacer a mano. El PR #1 de
  Investig (rama de Codex) quedó superado por la migración.

## Informado por otros agentes, sin volver a verificar

- Publicación manual del 30/10/2026 (versión de Cloudflare
  `fca313e1-1629-4da3-b1cf-7f881a7080b6`), según el PR #1 de Investig.
