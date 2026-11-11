# Instrucciones para agentes — repositorio MEDIDA

Este archivo coordina **Codex**, **Claude Code** y revisiones de **ChatGPT** a
través de GitHub. Tener el archivo no conecta ni ejecuta automáticamente a los
agentes. Viene del protocolo escrito para `MATKROL77/Investig` el 30/10/2026,
adaptado a este repositorio.

## Antes de trabajar

1. Leer `CLAUDE.md`, `MEDIDA_ESTADO.md` y `README.md`.
2. Verificar la rama, el PR y los cambios pendientes; no pisar trabajo ajeno.
3. Trabajar sobre ramas separadas. No fusionar ni realizar compras sin
   autorización explícita. La publicación en Cloudflare es automática en cada
   push a `main` o a una rama `claude/**` (ver `.github/workflows/deploy.yml`):
   el usuario la autorizó el 11/11/2026.
4. Registrar en `MEDIDA_ESTADO.md` los cambios, evidencias, bloqueos y
   siguiente paso. Distinguir **verificado** de **informado por otro agente**.

## Responsabilidades

- **Codex:** implementación de código, tests, build, comprobación visual y
  propuesta de PR.
- **Claude Code:** implementación, segunda revisión técnica o investigación
  específica cuando se le solicite. Un error de cuota (429) NO cuenta como
  aprobación.
- **ChatGPT:** coordinación, revisión del estado y prioridades comerciales. Las
  sugerencias no representan ejecución automática.

## Presupuesto y permisos

- Priorizar el uso incluido de los planes. No consumir créditos pagos, recargar,
  aumentar límites ni activar planes pagos sin aprobación del usuario para esa
  tarea.
- No iniciar bucles de agentes, análisis repetidos ni llamadas a APIs pagas para
  comprobaciones que puedan ejecutarse localmente.
- No guardar claves, credenciales ni datos privados en Git. Nunca registrar
  secretos en informes de error.
- No enviar mensajes comerciales, fijar precios contractuales o cerrar acuerdos
  fuera de las condiciones y permisos explícitos del usuario.

## Validaciones

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```

Para cambios visuales: navegador a 390 px y 1440 px, sin scroll horizontal y con
PDF/CSV/enlaces si se afectan. No afirmar tests pasados sin resultado de
ejecución.

Los costos de muestra no son cotizaciones definitivas. Un CSV genérico no es un
formato validado para una seccionadora específica. La vista de taller y los
datos cargados en el cliente pueden ser públicos; no incorporar costos
confidenciales antes de protegerlos.

## Flujo de trabajo entre agentes

1. Crear o actualizar una tarea en GitHub (issue/PR) con objetivo, alcance y
   criterios de aceptación.
2. Implementar en una rama propia, adjuntar resultados y actualizar el estado.
3. Revisar el diff y los resultados. Si hace falta segunda opinión, pedir una
   revisión **acotada y autorizada**.
4. El usuario autoriza la fusión. Comprobar la URL real después de publicar: el
   workflow falla si falta el token de Cloudflare y verifica que el sitio
   responda, pero conviene mirar el resultado en el navegador.
5. Anotar resultado, link del PR y versión publicada en `MEDIDA_ESTADO.md`.

No ejecutar automáticamente agentes a partir de GitHub Actions sin un diseño
posterior aprobado y control de gasto verificable.
