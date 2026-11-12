/**
 * A quién le llega "Enviar al taller".
 *
 * En la demo de MEDIDA no hay taller: MEDIDA es el software. En el
 * configurador de una empresa, la consulta va a esa empresa y nunca a MEDIDA.
 */
export type Workshop = {
  /** nombre de la empresa, para el saludo del mensaje y el encabezado */
  name: string;
  /** WhatsApp de la empresa: solo dígitos, con código de país */
  whatsapp: string;
  email?: string;
};
