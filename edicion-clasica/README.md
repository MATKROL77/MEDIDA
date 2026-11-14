# Edición clásica (el link principal)

El link principal de MEDIDA muestra la edición clásica: la versión del
12/11/2026 (commit en `BASE`), con placares, muebles de TV, bibliotecas y
bases de cama, texturas dibujadas y el 3D liviano. Lo que se desarrolla en esta
rama (el modo foto, el estudio, los sillones nuevos) se publica aparte, en el
Worker `medida-nuevo`, hasta que esté listo.

- `BASE`: el commit de partida.
- `cambios.patch`: lo que se le cambió a esa versión. Muestra solo placares,
  TV, bibliotecas y bases de cama (mesas, ratonas y sillones quedan en el
  código pero no se publican), suma la base de cama con el motor de esa
  versión (caja, piso falso partido en placas, cajones a los pies y al
  costado con su pared de fondo y su piso, contrafrente en todos los cajones,
  respaldo liso o con estantes), la imagen de su tarjeta y sus pruebas.

La publicación (`.github/workflows/deploy.yml`) arma esa versión así:

```bash
git worktree add ../clasica "$(cat edicion-clasica/BASE)"
git -C ../clasica apply edicion-clasica/cambios.patch
cd ../clasica && npm ci && npm test && npm run build && npx wrangler deploy
```

Para cambiarla: armala igual en una copia de trabajo, hacé los cambios ahí,
verificalos (`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`
y el navegador a 390 y 1440 px), y volvé a sacar el parche contra la base:

```bash
git -C ../clasica add -A
git -C ../clasica diff --binary --cached "$(cat edicion-clasica/BASE)" > edicion-clasica/cambios.patch
```

El servidor (`worker/`) y `wrangler.jsonc` son iguales en las dos ediciones:
los datos del link principal no se tocan al volver a esta versión. La
edición nueva, al ser otro Worker, tiene sus datos aparte.
