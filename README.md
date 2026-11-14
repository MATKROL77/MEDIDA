# MEDIDA

Configuradores 3D de productos a medida para fabricantes, carpinterías y
comercios. El cliente arma el producto en 3D, lo guarda o lo suma a un carrito
de consulta y manda la consulta completa; a la empresa le llega con las
medidas, los materiales, el despiece y el plano de corte.

MEDIDA es el software. No fabrica ni vende muebles.

- Sitio publicado: https://medida.matiascolimodio.workers.dev
- Estado verificado y lo que falta: [`MEDIDA_ESTADO.md`](./MEDIDA_ESTADO.md)
- Reglas del proyecto: [`CLAUDE.md`](./CLAUDE.md) y [`AGENTS.md`](./AGENTS.md)

## Qué hay

| Parte | Estado |
| --- | --- |
| Landing, catálogo de configuradores y páginas de servicios | Funcionando |
| Configurador de placares y vestidores | Demo funcionando: es el más completo, con despiece dibujado, plano de corte y PDF |
| Mesas y escritorios, ratonas y mesas de luz, muebles de TV, bibliotecas, sillones modulares | Demo funcionando: medidas, opciones, terminaciones, precio de muestra, guardar y consultar. Sin PDF ni plano de corte |
| Los configuradores se abren como ventana sobre la página | Funcionando; el enlace directo sigue abriendo a pantalla completa |
| Favoritos, carrito de consulta y guardado automático | Funcionando, en el dispositivo |
| Contacto comercial por WhatsApp y email | Funcionando; el número se cambia desde `/admin/` |
| Aviso de cookies y páginas legales | Funcionando |
| Servidor (API, base de datos) | Funcionando en Cloudflare |
| Cuenta por email y sincronización entre dispositivos | Hecho y probado; **en producción falta cargar la clave del proveedor de email** |
| Recordatorios por email y notificaciones del navegador | Hecho y probado en local; dependen de la cuenta |
| Administración (`/admin/`) y panel de empresa (`/panel/`) | Funcionando; se entra con la cuenta |
| Configurador embebible por empresa (`/embed/?t=…`) | Funcionando |
| Facturación recurrente | No existe. Los planes se acuerdan y se cobran por fuera; nada lo simula |

## Para activar el acceso por email

Es lo único que falta para que en producción anden la cuenta, los
recordatorios y el ingreso a `/admin/` y `/panel/`:

1. Crear una cuenta en [Resend](https://resend.com) y generar una clave de API.
2. En GitHub, en el mismo environment donde está `CLOUDFLARE_API_TOKEN`,
   agregar el secreto `RESEND_API_KEY` con esa clave.
3. Volver a correr el workflow "Publicar MEDIDA" (o hacer cualquier push).

Sin dominio propio, Resend solo deja mandar al email del dueño de la cuenta de
Resend: alcanza para entrar a `/admin/` con `matiascolimodio@gmail.com`. Para
mandarle a cualquier persona hay que verificar un dominio en Resend y cargar la
variable `EMAIL_FROM` (por ejemplo `MEDIDA <acceso@tu-dominio.com>`) en
Settings → Secrets and variables → Actions → Variables.

Mientras no esté la clave, el sitio lo dice: Mi cuenta muestra que el acceso
todavía no está activo y los diseños se siguen guardando en el dispositivo.

## Rutas

| Ruta | Qué es |
| --- | --- |
| `/` | Landing: el hero con el configurador vivo, lo que se puede cambiar, las familias, los servicios y el contacto |
| `/configuradores/` | Catálogo: lo que se puede probar hoy y lo que está en desarrollo |
| `/servicios/` y `/servicios/<servicio>/` | Los tres servicios para empresas |
| `/demo/` | El configurador de placares |
| `/demo/<familia>/` | Los de `mesas`, `ratonas`, `tv`, `bibliotecas` y `sillones` |
| `/demo/taller/` | Lo que recibe el fabricante: despiece, placas, herrajes, costos |
| `/mis-disenos/` | Diseños guardados: favoritos y carrito de consulta |
| `/cuenta/` y `/cuenta/verificar/` | Cuenta por email, preferencias y la llegada del enlace de acceso |
| `/admin/` | Administración de MEDIDA: contacto, oportunidades, empresas |
| `/panel/` | Panel de cada empresa: sus configuradores, consultas y uso |
| `/embed/?t=<empresa>` | El configurador de una empresa, para insertar en su web |
| `/privacidad/`, `/cookies/`, `/terminos/` | Textos legales |
| `/render/` | El 3D solo, sin interfaz: lo usa `scripts/capture.mjs` |
| `/api/*` | El servidor |

La configuración viaja entera en el link (`?c=...`), así que un enlace
compartido abre exactamente el mismo diseño en cualquier dispositivo.

## Dos recorridos que no se mezclan

- **Quien configura un mueble.** Prueba la demo, guarda diseños, arma un
  carrito de consulta.
- **La empresa que quiere MEDIDA.** Habla con quien lo vende, por WhatsApp o
  por email, sin formularios ni registro.

"Enviar al taller" en la demo pregunta cuál de las dos cosas busca la persona.
La cotización muestra el resumen y aclara que es una demostración: no hay un
taller asociado y el resumen no se le manda a nadie por defecto (la persona lo
comparte con quien quiera). El contacto comercial abre WhatsApp con un mensaje
que dice de qué servicio se trata. En el configurador de una empresa
(`workshop` en `Configurator`), "Enviar al taller" va a esa empresa y nunca a
MEDIDA.

## Contacto comercial

El número de WhatsApp y el email viven en un solo lugar: `src/lib/site.ts`
(`defaultContact`). Todos los botones pasan por `ContactLink`, que arma el
enlace con el mensaje del interés elegido (`INTERESTS`). Abrir WhatsApp se
anota como intención de contacto, no como mensaje enviado, y solo si la
persona aceptó la medición (`src/lib/track.ts`).

## Diseños guardados

`src/lib/designs.ts` (reglas, puras y con pruebas) y `src/lib/designStore.ts`
(almacenamiento local). Cada diseño guarda la familia, la configuración
completa, un resumen legible, el precio estimado, una vista previa, las fechas
de creación y modificación y un identificador único. Se puede abrir, editar,
renombrar, duplicar, eliminar y sumar al carrito. El carrito junta muebles
para pedir cotización: no es una compra.

Lo que se está armando se guarda solo (borrador): si se cierra el navegador,
al volver a `/demo/` está ahí.

## El servidor

Un Worker de Cloudflare (`worker/`) con SQLite en Durable Objects. El sitio
sigue siendo estático: solo `/api/*` pasa por el Worker.

- **Dos bases.** `PlatformDO` guarda cuentas, diseños sincronizados,
  consentimientos, clics de contacto, el contacto vigente y la lista de
  empresas. `TenantDO` es una base **por empresa**, con sus configuradores,
  las consultas de sus clientes y su uso: los datos de una empresa no
  comparten almacenamiento con los de otra.
- **La lógica no depende de Cloudflare.** Está en `worker/core/` y recibe la
  base, el reloj y los envíos desde afuera; por eso las pruebas la ejercitan
  entera con el SQLite de Node (`worker/test/app.test.ts`).
- **Acceso sin contraseña.** Enlace y código de un solo uso que vencen a los 15
  minutos; de ninguno se guarda el valor, solo su huella. El enlace lleva el
  valor después del `#`, así que no viaja a ningún servidor al abrirse. La
  sesión va en una cookie `HttpOnly; Secure; SameSite=Lax`.
- **Sincronización.** Para cada diseño gana la versión modificada más tarde;
  un borrado viaja a los otros dispositivos. Navegador y servidor validan con
  las mismas reglas (`src/lib/designs.ts`).
- **Recordatorios.** Solo para quien los activa: uno al día y otro a los tres
  días de la última edición, y ninguno más. Editar reinicia la cuenta; borrar
  el diseño o desactivarlos los cancela. Cada uno lleva un enlace de un solo
  uso que vuelve al diseño. El servidor se despierta solo (alarma del Durable
  Object) y además limpia lo vencido.
- **Notificaciones del navegador.** Se piden recién cuando la persona las
  activa en Mi cuenta. El aviso viaja sin contenido, firmado con claves que el
  servidor genera y guarda; el texto lo pide el navegador con la sesión
  (`public/sw.js`).
- **Medición.** Se anota qué botón de contacto se tocó, dónde y cuándo, sin
  identificadores y solo con permiso. En `/admin/` los clics van separados de
  las consultas recibidas, las reuniones y los clientes, que se cargan a mano.

### Empresas y planes

Quien administra MEDIDA crea la empresa en `/admin/` con su dirección corta,
los emails que pueden entrar y cuántos configuradores incluye su plan. La
empresa entra a `/panel/`, carga el WhatsApp donde quiere recibir las
consultas, crea sus configuradores (hasta el tope del plan) y ajusta margen,
terminaciones y precios. Todas usan el mismo motor: lo que cambia son
parámetros (`configureCatalog` en `src/lib/catalog.ts`), no una solución
distinta por cliente.

La facturación recurrente no está hecha. El plan es un nombre y un tope que se
cargan a mano; para sumar cobros hay que agregar el proveedor de pagos y atar
el tope al estado de la suscripción.

### Probar el servidor en la compu

```bash
npm run preview    # compila y levanta sitio + servidor en http://localhost:8787
```

En ese modo los emails no se mandan: quedan en `/api/dev/outbox`, que solo
existe ahí. `node scripts/e2e.mjs http://localhost:8787` recorre además la
cuenta, la sincronización entre dos dispositivos, la administración, el panel
de empresa y el configurador embebido.

## Las otras familias

`src/lib/furniture.ts` describe cada familia con parámetros (qué medidas y
opciones tiene, con sus mínimos y máximos) y una función que la arma pieza por
pieza, con el mismo tipo de pieza que usa el placard. Por eso comparten el 3D,
los materiales, la habitación, los cajones y puertas que se abren, la vista
explotada y la lista de piezas de placa: sumar una familia es describirla, no
escribir otro motor. `src/components/FurnitureConfigurator.tsx` dibuja los
controles a partir de esa descripción.

Cada familia tiene estilos para mostrar lo que da el motor: tapas rectas,
redondeadas o de vidrio; patas rectas, cónicas, pórticos de hierro, laterales
llenos o cajonera; ratonas tipo puente, losa o con tapa de vidrio; muebles de
TV flotantes; bibliotecas con estructura de hierro o puertas de vidrio;
sillones rectos o tipo puff, al piso o con patas. A todas menos el sillón se
les puede sumar luz LED, que se prende en la escena.

Cada mueble se muestra solo, en el estudio: lo suelto sobre una tarima y lo
que va contra la pared con un tabique detrás. La decoración (la tele sobre el
mueble de TV, los libros, una lámpara, la ropa en el placard) se dibuja pero
no se mide, no se corta ni se cobra, y se saca con el botón de arriba a la
izquierda. Los sillones se tapizan en lino, pana, bouclé o cuero de
tapicería; el curvo es de una sola pieza.

Los máximos salen de lo fabricable: ninguna pieza supera la placa refilada, y
hay una prueba que lo comprueba en todas las combinaciones. Los sillones
llevan tapizado (material aparte, con trama) y sus valores son de muestra,
como todos los precios de la demo.

## Estilo

Beige liso y azul marino liso (`src/app/globals.css`), sin texturas ni
degradés en la página: la textura la ponen los muebles. El texto, los botones
y lo elegido son azul marino; las superficies, blancas translúcidas sobre el
beige. Títulos en la serif del sistema (Times New Roman y equivalentes, el de
la portada en mayúsculas) y texto en Inter.

Los configuradores se abren en una ventana sobre la página
(`src/components/site/ConfiguratorWindow.tsx`), que queda atrás apenas fuera
de foco. Mientras la ventana está abierta, el 3D de la portada deja de dibujar.

## Realismo del 3D

- **Texturas fotográficas** de Poly Haven (CC0): chapas de nogal y roble;
  lino, pana, bouclé, lana y cuero de tapicería; cemento, baldosa, pared. Las
  baja y las prepara `npm run textures` (`scripts/textures.mjs`), con su tamaño
  real en `src/components/viewer/textures.json`. Cada pieza lleva coordenadas
  de textura en metros (`meterUvs` en `photo.ts`) con la veta a lo largo de su
  lado más largo: nada se estira al cambiar una medida. Créditos en
  `public/tex/CREDITOS.md`.
- **Telas que se leen como telas**: cada tela tiene su trama en gris (con
  promedio y contraste parejos; la del bouclé sale de su propio relieve), su
  relieve y el brillo rasante de la fibra (sheen). Con el mueble entero en
  pantalla, una trama a escala real se promedia y desaparece: como en una foto
  de catálogo, se agranda un poco para que se lea (`READABLE` en `photo.ts`).
- **Sillón curvo de una pieza**: la base, el respaldo y los almohadones son
  piezas curvas (una sección redondeada barrida a lo largo del arco, con la
  tela corriendo a lo largo de la curva), sin tramos rectos ni líneas entre
  cuerpos. El puff va pegado al frente del asiento.
- **Decoración escaneada**: los jarrones, libros, cuencos, plantas,
  portarretratos y almohadones son modelos de Poly Haven (CC0), escaneados o
  hechos por artistas, optimizados para la web (`npm run models`,
  `scripts/models.mjs`: texturas WebP de 512 px y geometría con meshopt) y
  bajados solo cuando la escena los usa. Se apoyan a su medida real
  (`src/lib/decor-models.ts`); un estante chico los achica enteros, nunca los
  deforma. Son ambientación: no entran en el despiece ni en el precio.
  Créditos en `public/models/CREDITOS.md`.
- **Telas con cuerpo** (`PartNode.tsx`): lo que se deforma se arma sobre una
  caja redondeada de malla pareja (`gridRoundedBox`), con las caras soldadas
  sin rajaduras. Sobre ella: el relleno de un almohadón (`puff`: cada cara se
  infla en el medio), las arrugas de la funda (`wrinkle`), el capitoné
  (`tuft`: celdas infladas entre líneas de botones hundidos), la caída de una
  tela sobre lo que cubre (`drape`: el acolchado y la manta doblan sobre el
  canto del colchón conservando su espesor y cuelgan con pliegues) y el
  almohadón de adorno (`pinch`: fino en el borde, con las puntas
  pellizcadas) y el vivo (`welt`: un cordón de tela que rodea las caras
  grandes siguiendo el canto). La ropa del placard es de lino, con pliegues
  y el gancho de la percha. El sillón curvo hace lo mismo sobre su sección barrida, con
  las puntas redondeadas como un almohadón.
- **Juntas en sombra** (`src/lib/gaps.ts`): las caras de una placa metidas en
  una ranura (el costado de un frente contra el del vecino, el canto de un
  divisor detrás de dos frentes) se detectan en el armado y van en una malla
  aparte con una variante oscura del material: la junta se ve como la línea
  oscura de una foto. Al abrir, despiezar o mirar con rayos X vuelven al
  material de siempre. Es una malla aparte y no un grupo de materiales porque
  el trazado de rayos no respeta los grupos dentro de una malla.
- **Madera doblada**: las esquinas curvas (mesas de luz y ratonas, mueble de
  TV) son un cuarto de caño (`geometry: "bend"`) con la veta dando la vuelta a
  la curva; en el despiece salen como MDF flexible curvado, cortado plano al
  largo del arco. Los frentes que siguen la curva son placas con las esquinas
  redondeadas (`corners`), con sus radios anotados para el taller.
- **Lo que se ve por una ranura**: la caja de un cajón cerrado va con la
  variante oscura de su material (por la ranura entre frentes se ve en
  sombra, no la melamina clara); al abrirlo vuelve a su color.
- **Piezas barridas** (`sweepGeometry`): una sección redondeada que recorre
  una curva libre en planta, con su alto cambiando a lo largo, relleno,
  arrugas y puntas redondeadas: el sillón curvo orgánico (asiento, respaldo
  y zócalo).
- **Tapas en planta** (`plan`): rectángulo con el mismo radio en las cuatro
  esquinas, elipse o media elipse, y marcos (un aro con hueco) para el vidrio.
- **Piedra**: mármol pulido (textura CC0 de Poly Haven) para la tapa de la
  mesita del sillón.
- **Cantos**: las placas tienen cantos redondeados de 2 mm con facetas planas;
  con normales suaves, en menos de un píxel el suavizado de bordes los hacía
  brillar a puntitos. La textura se proyecta por triángulo, y las normales se
  interpolan en el centroide del píxel (`materials.ts`), así un triángulo más
  fino que un píxel no se sombrea con una normal extrapolada.
- **Veta continua**: los frentes vecinos (cajones, puertas) toman la foto de
  la madera desde su posición en el mueble, así la veta sigue de uno a otro
  como si salieran de la misma placa enchapada.
- **Estudio**: el mueble se muestra en un ciclorama liso, el fondo curvo sin
  esquinas de un estudio de fotografía, del beige de la página. Lo que se
  apoya o se cuelga de una pared tiene un tabique detrás. Se puede elegir un
  piso con foto (madera, pinotea, cemento, baldosa), que se funde en el fondo.
- **Luz**: una foto HDR de un estudio real (Studio Small 09, CC0) da los
  reflejos y el relleno; una luz principal da las sombras.
- **Modo foto** (`PhotoMode.tsx`, con `three-gpu-pathtracer`): cuando la
  escena se queda quieta medio segundo, el mismo 3D se recalcula con trazado
  de rayos en la placa de video. La luz rebota de verdad, los LED iluminan lo
  que tienen cerca (cada tira es una luz de área), la luz principal es un
  softbox y las sombras se abren con la distancia. Se refina de a poco, con
  un filtro que alisa el grano sin borronear cantos, y apenas algo se mueve
  vuelve el 3D rápido. Lo que en el 3D rápido es un truco (la mancha de luz
  pintada, la sombra de contacto) lleva `userData.fake` y el trazado no lo ve.
  Ojo: el trazado lee los colores por vértice con una transparencia que no
  tienen, así que una geometría con `vertexColors` le desaparece.
  Arranca apagado siempre y se calcula solo al apretar "Realismo" (usa la
  placa de video del equipo; no se recuerda entre visitas). Para que no se
  vea grano, la foto tapa el 3D recién con el 85 % de sus pasadas, filtrada;
  hasta ahí se ve el 3D de siempre con el porcentaje. Necesita WebGL 2 con
  texturas de punto flotante: si no hay, queda el 3D rápido.

## El configurador de placares

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

## Lo que recibe el fabricante

"Enviar al taller" arma en el navegador un PDF con:

- tapa con una captura del 3D, las medidas, el precio y el resumen por tipo de
  pieza ("10 × Estante con luz LED");
- una tarjeta por grupo de piezas iguales con su dibujo acotado: tapacanto,
  canal para el perfil LED, cazoletas de las bisagras, agujeros del tirador,
  ranuras, espejo, cortes en ángulo, trapecios y curvas;
- herrajes, luces y placas.

La orden (`/demo/taller/`) muestra lo mismo y se puede bajar en PDF o en CSV.
El CSV sirve para una planilla; el formato de una seccionadora concreta
requiere adaptación. Los precios de la demo son de muestra
(`catalog.brand.samplePricing`).

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

## Rendimiento

- La landing no baja el motor 3D con la página: muestra una imagen ya
  optimizada y, cuando la página quedó quieta y el hero está en pantalla, baja
  el 3D y lo funde encima. Con ahorro de datos o movimiento reducido espera a
  que la persona lo pida. Fuera de pantalla deja de dibujar.
- Las imágenes del sitio son capturas reales del configurador en WebP
  (`public/img/`). Las de la portada salen del modo foto (`foto=1` en
  `/render/`, ver `scripts/capture.mjs`): son la misma escena que después
  calcula el navegador.
- El modo foto no traba la página: calcula de a pedazos, ajusta cuántos por
  cuadro según cómo va el equipo, tiene un tope de píxeles (menos en un
  teléfono), deja de calcular al llegar a la cantidad de pasadas y solo vuelve
  a pasar la imagen a pantalla cuando hay una pasada nueva. Mientras calcula,
  el medidor de rendimiento no baja la calidad por esos cuadros.
- La calidad del 3D se adapta sola al equipo. `/demo/?calidad=baja` fuerza el
  modo liviano y `?calidad=alta` deja todos los efectos (para grabar video; con
  esa opción el 3D deja en `window.__medidaAnim` el estado de puertas, cajones
  y luces).

## Cómo se corre

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 71 pruebas: despiece, precio, los otros muebles, contacto, diseños y la API entera
npm run typecheck
npm run lint
npm run build      # export estático en out/
```

Pruebas en el navegador (hacen falta Playwright y Chromium, que no son
dependencias del proyecto):

```bash
npm run build && npx serve out -l 4100
node scripts/e2e.mjs http://localhost:4100
```

Imágenes del sitio, cuando cambian los materiales o el motor (además hace
falta sharp):

```bash
npm run capture -- http://localhost:4100
```

## Dónde tocar cada cosa

| Quiero cambiar… | Archivo |
| --- | --- |
| Nombre, descripción, WhatsApp y email de MEDIDA, mensajes precargados | `src/lib/site.ts` |
| Familias de producto y cuál tiene demo | `src/lib/families.ts` |
| Medidas, opciones y armado de mesas, ratonas, TV, bibliotecas y sillones | `src/lib/furniture.ts` |
| La ventana donde se abren los configuradores | `src/components/site/ConfiguratorWindow.tsx` |
| Los servicios para empresas | `src/lib/services.ts` |
| La landing | `src/app/(site)/page.tsx` y `src/components/landing/` |
| Encabezado, pie, aviso de cookies | `src/components/site/` |
| Textos legales | `src/app/(site)/privacidad`, `cookies`, `terminos` |
| Materiales, precios de muestra, margen | `src/lib/catalog.ts` |
| Reglas de fabricación (medidas, cajones, maletero, curvas) | `src/lib/model.ts` |
| Cómo se arma cada pieza | `src/lib/assembly.ts` |
| Acomodo de piezas en la placa | `src/lib/nesting.ts` |
| Cálculo de costo y precio | `src/lib/quote.ts` |
| El mensaje de la consulta y el resumen de un diseño | `src/lib/share.ts`, `src/lib/inquiry.ts` |
| Dibujo técnico de cada pieza | `src/lib/drawings.ts` |
| El PDF | `src/lib/orderPdf.ts` |
| Escena 3D, cámara, luces, efectos | `src/components/viewer/Scene.tsx` |
| Cómo se anima cada pieza | `src/components/viewer/PartNode.tsx` |
| Habitación, paredes, ventana | `src/components/viewer/Room.tsx` |
| Panel y barra del configurador | `src/components/Configurator.tsx` |
| "Enviar al taller" | `src/components/SendSheet.tsx` |
| Mis diseños | `src/components/designs/` |
| La vista del taller | `src/components/Workshop.tsx` |
| Paleta, tipografía, animaciones de la interfaz | `src/app/globals.css` |
| La API y sus reglas | `worker/core/app.ts` y el resto de `worker/core/` |
| Emails de acceso y de recordatorio | `worker/core/email.ts` |
| Cuenta, sincronización y notificaciones en el navegador | `src/lib/account.ts`, `src/lib/push.ts`, `public/sw.js` |
| Administración y panel de empresa | `src/components/admin/` |
| Quién puede entrar a `/admin/` | `ADMIN_EMAILS` en `wrangler.jsonc` |

## Publicarlo

El link principal (`medida.matiascolimodio.workers.dev`) publica lo que hay en
esta rama. `.github/workflows/deploy.yml` lo verifica (pruebas, tipos, lint),
lo compila, lo publica en el Worker `medida` de Cloudflare y comprueba que
responda, en cada push a `main` o a una rama `claude/**`. El token de
Cloudflare (`CLOUDFLARE_API_TOKEN`) está cargado como secreto de un
environment de GitHub; el archivo explica cómo lo encuentra. Si falta el
token, la ejecución falla en vez de terminar en verde sin publicar.

Un commit cuyo mensaje lleva `[skip ci]` no dispara la publicación: sirve para
guardar trabajo a medio hacer.

A mano, desde la compu: `npm run build` y `npx wrangler deploy`. Con
`NEXT_PUBLIC_MEDIDA_EDICION=nueva` al compilar, el sitio dice "En desarrollo"
y no se indexa (sirve para publicar una prueba en otro Worker, con
`--name`).

Hasta el 14/11/2026 el link principal mostraba la edición clásica y la nueva
se probaba en el Worker `medida-nuevo`, que dejó de actualizarse. La clásica
queda guardada en `edicion-clasica/` (ver su README).

## Textos legales

Las páginas de privacidad, cookies y términos describen lo que el sistema hace
de verdad y citan la Ley 25.326. Conviene que las revise un profesional antes
de operar comercialmente.
