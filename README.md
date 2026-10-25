# Medida: configurador 3D de placares a medida

El cliente de un taller arma su placard en 3D, ve el precio al instante y manda
el pedido por WhatsApp. Al taller le llega el despiece, el plano de corte de
cada placa, los herrajes y la cuenta de costo y margen.

"Medida" es un nombre de trabajo: se cambia en `src/lib/product.ts`.

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

## Dónde tocar cada cosa

| Quiero cambiar… | Archivo |
| --- | --- |
| Marca, WhatsApp, materiales, precios, margen del taller | `src/lib/catalog.ts` |
| Nombre del producto y contacto del que lo vende | `src/lib/product.ts` |
| Reglas de fabricación (medidas mínimas, cajones, maletero) | `src/lib/model.ts` |
| Cómo se arma cada pieza | `src/lib/assembly.ts` |
| Acomodo de piezas en la placa | `src/lib/nesting.ts` |
| Cálculo de costo y precio | `src/lib/quote.ts` |
| El 3D | `src/components/Viewer3D.tsx` |
| Los controles | `src/components/Configurator.tsx` |
| La vista del taller | `src/components/Workshop.tsx` |
| Paleta y tipografía | `src/app/globals.css` |

## Cómo está pensado

- **Una sola fuente.** `buildAssembly` arma cada pieza con su caja en el espacio
  y su medida de corte. El 3D dibuja esas cajas y el despiece las agrupa: lo que
  se ve es lo que se corta.
- **Construcción.** Laterales y divisores van de piso a techo; techo, piso y
  zócalo van por módulo. Así ninguna pieza horizontal supera el ancho de un
  módulo y todo entra en una placa de 2600 × 1830, aunque el placard mida 4 m.
- **Límites de fabricación.** El alto llega hasta 250 cm porque un lateral
  tiene que entrar entero en la placa refilada (2580 mm útiles). Por dentro, el
  módulo mide entre 35 cm (entra una percha) y 100 cm (más ancho, el estante se
  flecha).
- **Acomodo en placa.** Corte guillotina por franjas, como una seccionadora.
  Respeta la veta en los materiales que la tienen.
- **Precios.** Todo sale del catálogo: placas según el acomodo, metros de
  canto, herrajes contados uno por uno, mano de obra y margen. Los de la demo
  **son de ejemplo**.

## Publicarlo

Es un sitio estático: `npm run build` genera `out/`, que se sube tal cual a
Cloudflare Pages, Cloudflare Workers (assets) o GitHub Pages.

## Lo que falta para un taller real

- Panel para que el taller edite sus precios sin tocar código.
- Login para la vista del taller.
- Más productos: vestidor en L, cocinas, bajo mesada.
- Exportar el despiece al formato de la seccionadora del taller.
