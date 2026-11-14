/**
 * Qué edición del sitio es esta compilación. El link principal publica la
 * edición clásica (ver edicion-clasica/); esta, la nueva, se publica aparte
 * mientras se desarrolla, con MEDIDA_EDICION=nueva al compilar.
 */
export const IN_DEVELOPMENT = process.env.NEXT_PUBLIC_MEDIDA_EDICION === "nueva";
