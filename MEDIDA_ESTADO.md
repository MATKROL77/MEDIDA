# MEDIDA — estado operativo compartido

Actualizado: 2026-11-17 (Argentina).

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

**Lo pedido sobre la edición publicada (14/11/2026, a la tarde).**
- Realismo a pedido: arranca solo con el botón y no muestra grano (la foto
  tapa el 3D recién al 85 % de sus pasadas). El render en un servidor con
  placa de video no está hecho: necesita una cuenta de un proveedor de GPU
  y su clave.
- Visor: sin el cartel de arriba; "Con decoración" abajo a la izquierda.
- Luz en cada hueco y adentro de cada cajón (TV, camas, mesas de luz), con
  su mancha de luz en el 3D rápido.
- Mesas: mesa o escritorio; forma recta, con esquinas redondeadas (radio
  parejo) o redonda u ovalada; vidrio con marco de madera o de hierro; largo
  y ancho con el mismo rango (tapa en dos mitades si no entra en una placa);
  las patas ya no se esconden detrás del vidrio.
- Mesa de luz y ratona: puerta de madera o de vidrio, rueditas, cajón bajo
  el vidrio; el tabique de atrás mide al menos 4,8 m.
- Cama: cajones a la izquierda, a la derecha o de los dos lados; trampilla
  que levanta el colchón; puertas en el respaldo con estantes.
- Sillones: el recto con base y respaldo de una pieza (solo se separan los
  almohadones) y apoyabrazos integrados; las burbujas de corrido; el curvo
  pasa a ser orgánico, con curvatura regulable, zócalo de madera y mesita
  de madera doblada con tapa de mármol.
- Cada módulo se edita solo: cuerpos del mueble de TV y columnas de la
  biblioteca, tocándolos en el 3D.
- Portarretratos mirando al frente.
Verificado: `npm test` (81 pruebas), `typecheck`, `lint` y `build` sin
errores; capturas en Chromium de cada mueble; edición de un módulo probada
tocándolo en el 3D; sin scroll horizontal a 390 y 1440 px en la portada y
en los siete configuradores.

**Teléfono: el 3D se achica siguiendo el dedo (14/11/2026, a la noche).**
Al entrar a un configurador desde el teléfono, el 3D ocupa el 78 % del alto
con una seña animada de "Deslizá". Al deslizar se achica de a poco, al ritmo
del dedo, hasta el 46 %; mientras tanto el panel sube entero pegado al borde
del 3D (en el placard, también las solapas), y recién con el 3D chico se
desplaza lo de adentro del panel. Al volver arriba se agranda de a poco. El
mueble se ve entero en todo el recorrido: el lienzo no cambia de tamaño y la
cámara se aleja en la misma medida. Verificado en Chromium emulando un iPhone
13: a 100 px de deslizamiento el 3D mide 418 px y el panel empieza en 418 px;
desde 213 px queda en 305 px y el panel pasa por debajo. Sin scroll
horizontal a 390 y 1440 px;
`npm test` (83 pruebas, dos nuevas sobre el encuadre), `typecheck`, `lint`
y `build` sin errores. Falta probarlo en un teléfono real.

**Editar cada módulo, arreglado (17/11/2026).** Matías avisó que en las
bibliotecas y los muebles de TV no se podía editar cada parte. La edición por
módulo existía pero fallaba en el uso: tocar dentro de un hueco (el fondo, un
estante corrido, un adorno) no elegía nada, y en el teléfono las opciones del
módulo quedaban abajo, fuera de la vista. Ahora tocar cualquier parte de un
módulo lo elige, hay un aviso sobre el 3D ("Tocá un módulo para editarlo") y
al elegirlo sus opciones quedan a la vista (en el teléfono el 3D se achica;
en la compu el panel vuelve arriba). Verificado en Chromium a 1280 px y
emulando un iPhone 13, en el mueble de TV y la biblioteca.

**Armado animado y fluidez (17/11/2026).** Armado animado: al abrir
un configurador las piezas llegan volando desde fuera de la pantalla y arman
el mueble en orden de taller (base, laterales, fondo y tapa, interior,
frentes); lo que se agrega después llega igual. El mapa de sombras solo se
redibuja cuando el mueble cambia, y al quedar quieto el 3D dibuja un cuadro
final a toda nitidez antes de dormirse. Verificado en Chromium con una
secuencia cuadro a cuadro (placard y mueble de TV) y con `npm test` (84
pruebas), `typecheck`, `lint` y `build`. Sigue en curso, sin publicar: la
ropa del placard, la luz, las sombras y el ambiente, y la decoración de las
demás familias.

**Motor más rápido (17/11/2026).** El 3D deja de dibujar cuando está
quieto y se despierta con cualquier toque, cambio de opción o
deslizamiento; el trazado de rayos (unos 200 KB) se baja recién al prender
"Realismo"; la portada adelanta en segundo plano el motor 3D y la foto del
estudio; texturas, modelos y la foto del estudio quedan guardados un día en
el navegador. Verificado en Chromium: quieto, 0 dibujos en 3 s; al
arrastrar el mueble o mover una medida vuelve a dibujar; sin errores.
`npm test`, `typecheck`, `lint` y `build` sin errores. Falta medir los
cuadros por segundo en una Mac y en teléfonos reales (el entorno de trabajo
no tiene placa de video).

**Portada directa y 3D más liviano (16/11/2026).** A pedido de Matías, la
portada arranca con "Tus productos. Infinitas configuraciones." y, justo
debajo, los siete configuradores; se sacaron el 3D del sillón con sus
opciones, las cualidades, las muestras de telas y la sección de
interacción. Siguen abajo Para empresas, Cómo funciona, Lo que recibe tu
empresa y Contacto. En la compu queda igual que en el teléfono: el título
en dos líneas y los siete configuradores del mismo tamaño, en tres columnas,
visibles sin bajar (a 1440 × 900 empiezan a 517 px). La portada ya no tiene 3D. Para que los configuradores
anden fluidos en una Mac con pantalla Retina, el 3D tiene un tope de unos
2,4 millones de píxeles (antes podía dibujar al doble de densidad en toda la
pantalla), la oclusión se calcula a media resolución y el suavizado y las
sombras suaves usan menos muestras. Verificado en Chromium a 390 y 1440 px:
sin scroll horizontal, sin errores y sin lienzo 3D en la portada; `npm
test`, `typecheck`, `lint` y `build` sin errores. Falta medirlo en una Mac
real y en Safari: el entorno de trabajo solo tiene Chromium.

**El panel ya no se pliega (15/11/2026).** A pedido de Matías, en el
teléfono "Personalizar tu mueble" queda siempre desplegado: se sacó la
flecha que lo plegaba.

**Link principal con la edición nueva (14/11/2026, más tarde).** A pedido
de Matías, el link principal publica la edición nueva (beige y azul marino,
siete familias, modo realista); la clásica deja de publicarse y queda en
`edicion-clasica/`; `medida-nuevo` deja de actualizarse.

**Dos links (14/11/2026).** El link principal vuelve a la edición clásica
(versión del 12/11 con placares, TV y bibliotecas) más una base de cama hecha
con el motor de esa versión; la edición nueva se publica aparte, en el Worker
`medida-nuevo`, marcada "En desarrollo" y sin indexar. Ver
`edicion-clasica/README.md`. Verificado en local: el parche se aplica sobre la
base, pasan sus 68 pruebas, compila y se ve a 390 y 1440 px.

**Modelos más reales (14/11/2026), solo en la edición nueva.** Comparados con
las fotos de referencia que mandó Matías: el mueble de TV se arma como uno
real (frentes que tapan medio divisor con 3 mm de luz y, en "nicho y cajón",
un nicho corrido con la luz a lo largo); las juntas entre frentes se ven
oscuras; los cantos ya no brillan a puntitos. Sillones con almohadones
rellenos y arrugas, almohadón de adorno con forma de almohadón, capitoné con
celdas infladas, sillón curvo con las puntas redondeadas. Cama con acolchado
que cae por los costados, almohadas de pluma y manta a los pies. La mesa de
comedor lleva jarrón y cuenco, no velador; el velador es un pie de cerámica
escaneado con pantalla de lino. Esquinas curvas de madera doblada (MDF
flexible en el despiece) en mesas de luz y ratonas, con el cajón colgado bajo
la tapa como en la referencia, y como opción en el mueble de TV. Vivo en los
almohadones del sillón y en el respaldo tapizado de la cama. La ropa del
placard es de tela, con perchas, y la página de render viste el placard como
el configurador. Los selectores de muchas opciones pasan a filas: a 390 px
el de frentes del mueble de TV se salía del panel. Verificado con capturas en
Chromium (3D rápido y trazado de rayos); `npm test` (78 pruebas: una
nueva sobre las juntas y otra sobre el despiece de las curvas), `typecheck`, `lint` y `build` sin errores.

**Realismo y rediseño (13/11/2026).** Modo foto con trazado de rayos en el
navegador (`three-gpu-pathtracer`): con la escena quieta, el 3D se recalcula
con luz que rebota, luces de área en cada tira LED y un softbox, con un filtro
de grano; apenas algo se mueve vuelve el 3D rápido. Estudio liso tipo
ciclorama (fondo curvo sin esquinas) del beige de la página; luz y reflejos
de una foto HDR de estudio (CC0). Telas con trama, relieve y brillo de fibra
que se leen a distancia de catálogo; cuero de tapicería con poro y pliegues.
Sillón curvo de una sola pieza (sin líneas entre cuerpos) y puff pegado al
frente. La página pasa a beige liso y azul marino liso, sin texturas, con la
portada del sillón curvo calculado con trazado de rayos y sus opciones
(modelo, tela, cuerpos), una sección con las texturas reales del motor y la
barra de precio del configurador más chica.

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
