import assert from "node:assert/strict";
import { test } from "node:test";

import { buildFurniture, defaultFurniture } from "./furniture.ts";
import { hiddenFaces } from "./gaps.ts";

const bit = (axis: number, positive: boolean) => 1 << (axis * 2 + (positive ? 1 : 0));

test("en el mueble de TV, las ranuras entre cajones quedan marcadas y las caras a la vista no", () => {
  const parts = buildFurniture(defaultFurniture("tv")).assembly.runs.flatMap((r) => r.parts);
  const hidden = hiddenFaces(parts);
  const fronts = parts.filter((p) => p.kind === "drawer-front").sort((a, b) => a.position[0] - b.position[0]);
  assert.ok(fronts.length >= 2);
  // el costado derecho del primer frente mira al izquierdo del segundo, a 3 mm
  assert.ok((hidden.get(fronts[0].id) ?? 0) & bit(0, true));
  assert.ok((hidden.get(fronts[1].id) ?? 0) & bit(0, false));
  // la cara de adelante de un frente está a la vista
  assert.equal((hidden.get(fronts[0].id) ?? 0) & bit(2, true), 0);
  // la tapa, arriba y adelante, también
  assert.equal((hidden.get("top") ?? 0) & (bit(1, true) | bit(2, true)), 0);
  // el canto de un divisor, detrás de dos frentes, queda en sombra
  const divider = parts.find((p) => p.kind === "divider" && p.position[0] > 0)!;
  assert.ok((hidden.get(divider.id) ?? 0) & bit(2, true));
});
