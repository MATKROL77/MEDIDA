# Medida: configurador 3D de placares a medida

El cliente de un taller arma su placard en 3D, ve el precio al instante y manda
el pedido por WhatsApp. Al taller le llega el despiece, el plano de corte de
cada placa, los herrajes, las luces y la cuenta de costo y margen.

"Medida" es un nombre de trabajo: se cambia en `src/lib/product.ts`.

## Estado verificado — 30/10/2026

La interfaz lleva la marca MEDIDA, sin rótulo ni marca de agua DEMO, por pedido
del usuario. Los precios siguen señalados como valores orientativos de muestra
(`catalog.brand.samplePricing`), independientemente de la marca de agua.
Las opciones de altillo, techo inclinado y terminales curvos se agrupan en
«Opciones especiales» para simplificar el primer recorrido.

Se verificaron 18 pruebas del modelo y despiece, tipos, lint y export estático.
En navegador se probó a 390 y 1440 px: cambio de medidas, conservación en el
enlace, vista del taller y descargas PDF/CSV, sin desborde horizontal.

El CSV sirve para una planilla; el formato de una seccionadora concreta requiere
adaptación. No hay login ni servidor: el catálogo se descarga al navegador y la
vista del taller puede abrirse con su enlace. No cargar costos confidenciales
sin resolver el acceso y la arquitectura antes.

GitHub tenía verificaciones exitosas, pero la publicación anterior se omitió
por falta de los secretos de Cloudflare. Una verificación exitosa no demuestra
que exista una URL publicada. Las mejoras se entregan en una rama para revisión;
publicar exige autorización del usuario.

## Qué se puede armar

- **Formas:** recto, en L con el lateral a la izquierda o a la derecha, altillo
  con puertas, techo inclinado (bajo escalera, buhardilla) y terminales curvos
  abiertos en los extremos libres.
- **Interior:** módulos de distinto ancho; estantes, barral, doble barral y
  cajones.
- **Frentes:** sin puertas, batientes o corredizas; liso, ranurado, espejo o
  vidrio con perfil de aluminio; tirador barral, botón o sin tirador.
- **Luz:** tira LED bajo cada estante y perfiles verticales, por módulo; luz
  cálida, neutra, fría o RGB de cualquier color; sensor al abrir.
- **Colores** de cuerpo y frentes del catálogo del taller.

En el visor: girar 360° sin límites, vistas rápidas (frente, 3/4, costado,
arriba, atrás), abrir puertas y cajones, ver adentro sin abrir, vista explotada
y luces prendidas. Tocando una hoja corrediza en el 3D se la corre para el
otro lado. El visor muestra solo el placard y sus controles; el
ambiente (habitación o fondo liso, color de pared y piso de madera clara,
pinotea, cemento alisado o baldosa beige) se elige en la solapa Color.

## Lo que recibe el taller

El botón "Enviar al taller" arma en el navegador un PDF con:

- tapa con una captura del 3D, las medidas, el precio y el resumen por tipo de
  pieza ("10 × Estante con luz LED");
- una tarjeta por grupo de piezas iguales con su dibujo acotado: tapacanto,
  canal para el perfil LED, cazoletas de las bisagras, agujeros del tirador,
  ranuras, espejo, cortes en ángulo, trapecios y curvas;
- herrajes, luces y placas.

En el celular el PDF se comparte directo a WhatsApp. En la compu se abre
WhatsApp con el resumen y el link a la orden (`/demo/taller/`), que muestra lo
mismo y se puede bajar en PDF o en CSV.

## Rutas

| Ruta | Qué es |
| --- | --- |
| `/` | Página para venderle el producto a los talleres |
| `/demo/` | El configurador MEDIDA, con costos orientativos de muestra |
| `/demo/taller/` | Lo que recibe el taller: despiece, placas, herrajes, costos |

La configuración viaja entera en el link (`?c=...`), así que el pedido que llega
por WhatsApp abre exactamente el placard que armó el cliente. No hay base de
datos ni servidor.

## Cómo se corre

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # pruebas del despiece y el precio
npm run typecheck
npm run lint
npm run build      # export estático en out/
```

Para grabar un video sin marca de agua, el guion de grabación esconde los
elementos con `data-watermark`; con `?calidad=alta` el 3D deja además en
`window.__medidaAnim` el estado de puertas, cajones y luces, para sincronizar
los sonidos con lo que se mueve.

`/demo/?calidad=baja` fuerza el modo liviano del 3D (sin oclusión ambiental ni
antialias por muestreo). Sirve para equipos muy viejos y para sacar capturas en
máquinas sin placa de video. `/demo/?calidad=alta` hace lo contrario: deja todos
los efectos aunque el equipo no llegue a 60 cuadros, para grabar video.

## Marca de agua

Mientras `catalog.brand.demo` sea `true`, el 3D, la vista del taller y cada hoja
del PDF llevan "MEDIDA · DEMO" en diagonal, y arriba a la derecha aparece el
contacto de quien vende el producto. Sirve para mandar el link o el video sin
que se confunda con un placard real. El texto se cambia en `src/lib/product.ts`;
en el sitio de un taller real se pone `demo: false` y desaparece.

## Dónde tocar cada cosa

| Quiero cambiar… | Archivo |
| --- | --- |
| Marca, WhatsApp, materiales, precios, margen del taller | `src/lib/catalog.ts` |
| Nombre del producto y contacto del que lo vende | `src/lib/product.ts` |
| Reglas de fabricación (medidas, cajones, maletero, curvas) | `src/lib/model.ts` |
| Cómo se arma cada pieza | `src/lib/assembly.ts` |
| Acomodo de piezas en la placa | `src/lib/nesting.ts` |
| Cálculo de costo y precio | `src/lib/quote.ts` |
| El mensaje de WhatsApp | `src/lib/share.ts` |
| Dibujo técnico de cada pieza | `src/lib/drawings.ts` |
| El PDF para el taller | `src/lib/orderPdf.ts` |
| Escena 3D, cámara, luces, efectos | `src/components/viewer/Scene.tsx` |
| Cómo se anima cada pieza | `src/components/viewer/PartNode.tsx` |
| Habitación, paredes, ventana | `src/components/viewer/Room.tsx` |
| Texturas y materiales del 3D | `src/components/viewer/materials.ts` |
| Panel y barra del visor | `src/components/Configurator.tsx` |
| La vista del taller | `src/components/Workshop.tsx` |
| Paleta, tipografía, animaciones de la interfaz | `src/app/globals.css` |

## Cómo está pensado

- **Una sola fuente.** `buildAssembly` arma cada pieza con su caja en el espacio,
  su medida de corte y sus mecanizados (canal LED, cazoletas, agujeros de
  tirador, ranuras). El 3D dibuja esas cajas y el despiece las agrupa: lo que se
  ve es lo que se corta.
- **Dibujos y PDF sin servidor.** Cada dibujo se describe una vez como
  primitivas y se pinta en SVG (página) o en canvas (PDF). El PDF es una imagen
  por hoja dentro de un PDF mínimo escrito a mano: no usa librerías.
- **Ids estables.** Cada pieza tiene un id que dice qué es (`r0:m1:s2` es el
  segundo estante del módulo 1 del frente). Cuando cambia una medida, el 3D
  anima la misma pieza a su lugar nuevo en vez de reemplazarla.
- **Todo con resortes.** Posición, tamaño, giro, puertas, cajones, vista
  explotada, luces y transparencias siguen a su valor con resortes apenas
  subamortiguados (`viewer/anim.ts`): llegan con un rebote chiquito. Las piezas
  nuevas crecen y las que se van se encogen antes de desaparecer.
- **Se abre en el orden de verdad.** Lo que se mueve sigue las reglas de un
  placard real (`lib/motion.ts`, y `sequence` en `viewer/Scene.tsx` cuadro a
  cuadro): primero se abren las puertas y después salen los cajones; al cerrar,
  primero entran los cajones. Una hoja corrediza corre por su riel hasta tocar
  la otra hoja del mismo riel; si está trabada, empuja a la vecina. Antes de
  que una hoja pase por delante de un cajón abierto, el cajón se cierra, y un
  cajón tapado por una hoja no sale. Con batientes, de dos puertas que comparten
  divisor una abre a 90° y la otra a 72° para no chocarse, y la del cajón es la
  que abre entera. Detrás de batientes, el frente del cajón es 12 mm más
  angosto por lado para pasar junto a la puerta abierta. Detrás de corredizas,
  el cajón se hace del ancho del hueco más grande que las hojas pueden dejar
  delante de su módulo (en cada riel, unas hojas apiladas a la izquierda y otras
  a la derecha) y la caja va sobre suplementos de corredera, que están en el
  despiece y en el precio. Si ningún hueco deja salir un cajón útil (con dos
  hojas, el módulo del medio de tres), el cajón queda cerrado y el panel lo
  avisa.
- **Sin pantallas de carga.** Mientras baja el 3D se ve una vista de frente en
  SVG; cuando el 3D está listo entra con un fundido y el placard se arma de abajo
  hacia arriba.
- **Calidad adaptable.** Oclusión ambiental, brillo de LED, sombras suaves y
  reflejos de un ambiente generado en el momento. Si el equipo no llega a 60
  cuadros, baja sola la resolución y saca la oclusión.
- **Construcción.** Laterales y divisores van de piso a techo; techo, piso y
  zócalo van por módulo. Así todo entra en una placa de 2600 × 1830, aunque el
  placard mida 4 m. En L, el tramo lateral arranca delante del frente y la
  esquina es un solo espacio: el módulo del lateral que la toca no tiene
  lateral (lleva un parante de 10 cm adelante) y su techo, piso, estantes y
  barral siguen hasta encontrarse con los del frente. Quedan estantes y barral
  en L y no hay rincón muerto. En la esquina no van cajones: chocarían con el
  otro tramo.
- **Corredizas como en un placard real.** Una hoja por módulo, con los cantos
  sobre los divisores y 4 cm de solape entre hojas vecinas, alternando riel de
  adelante y de atrás. Hacen falta dos módulos de al menos 48 cm; si no entran,
  el placard va batiente. Las hojas de vidrio llevan perfil tirador de
  aluminio a los costados.
- **Límites de fabricación.** El alto llega hasta 250 cm porque un lateral
  tiene que entrar entero en la placa refilada (2580 mm útiles); con altillo se
  suma arriba. Por dentro, el módulo mide entre 35 y 100 cm.
- **Precios.** Todo sale del catálogo: placas según el acomodo, metros de
  canto, herrajes, espejo y vidrio por m², metros de tira LED, fuentes según el
  consumo, sensores, cortes en ángulo y curvos, mano de obra y margen. Los de la
  demo **son de ejemplo**.

## Publicarlo

Es un sitio estático: `npm run build` genera `out/`, que se sube tal cual a
Cloudflare Pages, Cloudflare Workers (assets) o GitHub Pages.

Está preparado para Cloudflare Workers (`wrangler.jsonc`, nombre `medida`):

- **Solo, desde GitHub:** `.github/workflows/deploy-configurador.yml` verifica
  (pruebas, tipos, lint, build) y publica en cada push que toque
  `configurador/`. Se enciende cargando en el repositorio los secretos
  `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`; el archivo explica cómo.
- **A mano, desde la compu:** `npm run build` y después
  `npx wrangler@4 deploy` (la primera vez pide entrar a Cloudflare).

Queda en `https://medida.<tu-subdominio>.workers.dev`: la página para talleres
en `/` y el configurador en `/demo/`.

Para probarlo sin dominio, `npm run artifact` arma una versión de un solo
archivo (`artifact-out/index.html` y `app.js`) que se publica como página
privada de Claude. Ahí todo funciona salvo bajar y compartir el PDF, que esos
marcos bloquean: en esa versión los botones no aparecen.

## Lo que falta para un taller real

- Panel para que el taller edite sus precios sin tocar código.
- Login para la vista del taller.
- Más productos: cocinas, bajo mesada, vestidor con isla.
- Exportar el despiece al formato de la seccionadora del taller.
