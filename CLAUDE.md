# Contexto del proyecto

**MEDIDA**: configuradores 3D de productos a medida para fabricantes, de
**Matías Colimodio** (matiascolimodio@gmail.com), estudiante de Ingeniería
Mecánica en Pilar, Buenos Aires. Este repositorio es solo MEDIDA; viene de la
carpeta `configurador/` de `MATKROL77/Investig`, migrada con su historial.

Next.js 15 + TypeScript + Tailwind v4 + react-three-fiber, export estático,
publicado en Cloudflare Workers. Leé el `README.md` antes de tocar código y
`MEDIDA_ESTADO.md` para saber qué está verificado y qué falta.

## Reglas

- **No se inventan datos.** Ni clientes, ni testimonios, ni métricas, ni
  ahorros. Los precios de muestra están marcados como orientativos. La marca es
  MEDIDA y no lleva rótulo ni marca de agua DEMO; MEDIDA identifica al software
  y no representa a un fabricante de muebles.
- **No se presenta como terminado lo que no existe.** Lo que está en desarrollo
  se dice. Nada de funciones simuladas que aparenten andar.
- Español rioplatense, con voseo hacia el visitante.
- Lo que se ve en 3D y el despiece salen de `buildAssembly`: no dibujar piezas
  que no estén en el despiece ni al revés.
- Las tipografías se sirven locales (`next/font/local`): el build no sale a
  internet.
- No se guardan claves ni credenciales en Git.

## Antes de dar algo por terminado

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Si tocaste algo visual, verificalo en el navegador a 390 px y a 1440 px, sin
scroll horizontal.
