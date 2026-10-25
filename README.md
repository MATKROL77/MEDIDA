# Medida: configurador 3D de placares a medida

El cliente de un taller arma su placard en 3D, ve el precio al instante y manda
el pedido por WhatsApp. Al taller le llega el despiece, el plano de corte de
cada placa, los herrajes, las luces y la cuenta de costo y margen.

"Medida" es un nombre de trabajo: se cambia en `src/lib/product.ts`.

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
y luces prendidas. El visor muestra solo el placard y sus controles; el
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
| `/demo/` | El configurador, con una marca inventada (Altura Placares) |
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

`/demo/?calidad=baja` fuerza el modo liviano del 3D (sin oclusión ambiental ni
antialias por muestreo). Sirve para equipos muy viejos y para sacar capturas en
máquinas sin placa de video.

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
- **Sin pantallas de carga.** Mientras baja el 3D se ve una vista de frente en
  SVG; cuando el 3D está listo entra con un fundido y el placard se arma de abajo
  hacia arriba.
- **Calidad adaptable.** Oclusión ambiental, brillo de LED, sombras suaves y
  reflejos de un ambiente generado en el momento. Si el equipo no llega a 60
  cuadros, baja sola la resolución y saca la oclusión.
- **Construcción.** Laterales y divisores van de piso a techo; techo, piso y
  zócalo van por módulo. Así todo entra en una placa de 2600 × 1830, aunque el
  placard mida 4 m. En L, el tramo lateral arranca delante del frente y la
  esquina lleva un panel ciego.
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

## Lo que falta para un taller real

- Panel para que el taller edite sus precios sin tocar código.
- Login para la vista del taller.
- Más productos: cocinas, bajo mesada, vestidor con isla.
- Exportar el despiece al formato de la seccionadora del taller.
