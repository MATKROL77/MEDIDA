/**
 * Una compilación de prueba: con NEXT_PUBLIC_MEDIDA_EDICION=nueva el sitio
 * dice "En desarrollo" y no se indexa. El link principal se compila sin ella.
 */
export const IN_DEVELOPMENT = process.env.NEXT_PUBLIC_MEDIDA_EDICION === "nueva";
