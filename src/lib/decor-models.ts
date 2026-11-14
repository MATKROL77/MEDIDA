/**
 * Medida real (ancho, alto, profundidad, en mm) de cada objeto de ambientación
 * de public/models/. Lo escribe scripts/models.mjs: no editar a mano.
 */
export const DECOR_MODELS = {
  "jarron": [
    204,
    400,
    204
  ],
  "jarron-alto": [
    112,
    414,
    112
  ],
  "jarron-antiguo": [
    255,
    440,
    255
  ],
  "jarron-bronce": [
    82,
    170,
    61
  ],
  "libros": [
    551,
    237,
    163
  ],
  "planta": [
    701,
    841,
    657
  ],
  "suculenta": [
    168,
    267,
    185
  ],
  "almohadones": [
    1022,
    450,
    627
  ],
  "cuenco": [
    313,
    94,
    309
  ],
  "portarretrato": [
    100,
    250,
    201
  ],
  "lampara-colgante": [
    432,
    952,
    432
  ]
} as const;

export type DecorModel = keyof typeof DECOR_MODELS;
