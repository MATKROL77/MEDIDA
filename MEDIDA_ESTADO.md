# MEDIDA — estado operativo compartido

Actualizado: 2026-11-11 (Argentina).

## Migración a este repositorio — verificado

- MEDIDA vivía en `configurador/` de `MATKROL77/Investig`. El 11/11/2026 se
  migró a `MATKROL77/MEDIDA` con su historial (14 commits), tomando la versión
  de la rama `codex/medida-demo-validation`, que es la que estaba publicada.
- En la raíz del repositorio nuevo corrieron 18 pruebas, tipos, lint y build.
- La publicación pasa a hacerse desde este repositorio
  (`.github/workflows/deploy.yml`), con el token de Cloudflare cargado como
  secreto de un environment de GitHub.

## Informado por otros agentes, sin volver a verificar

- Publicación manual del 30/10/2026 en
  https://medida.matiascolimodio.workers.dev/demo/ (versión de Cloudflare
  `fca313e1-1629-4da3-b1cf-7f881a7080b6`), según el PR #1 de Investig.
