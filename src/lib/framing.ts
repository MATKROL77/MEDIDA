/**
 * Cuánto se aleja la cámara según la forma del visor: en uno más alto que
 * ancho, el mueble tiene que entrar de costado y la cámara va más lejos.
 * La usan el encuadre del 3D y el visor del teléfono que se achica al
 * deslizar, para que el mueble quede igual de encuadrado que si el lienzo
 * cambiara de tamaño.
 */
export function aspectReach(aspect: number): number {
  return aspect < 1 ? Math.pow(aspect, -0.85) : 1;
}

/**
 * Acercamiento de la cámara para que un lienzo de alto `canvas`, recortado al
 * centro a un alto `visible`, muestre lo mismo que un lienzo de ese alto.
 */
export function shrinkZoom(width: number, canvas: number, visible: number): number {
  if (canvas <= 0 || visible <= 0) return 1;
  return (visible / canvas) * (aspectReach(width / canvas) / aspectReach(width / visible));
}
