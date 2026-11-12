import type { Metadata } from "next";
import Link from "next/link";

import { CookiePreferencesButton } from "@/components/site/CookiePreferencesButton";
import { LegalPage } from "@/components/site/Legal";

export const metadata: Metadata = {
  title: "Política de cookies",
  description: "Qué guarda MEDIDA en tu dispositivo, qué es necesario, qué es opcional y cómo cambiar tu elección.",
  alternates: { canonical: "/cookies/" },
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Política de cookies"
      lead="MEDIDA guarda muy pocas cosas en tu dispositivo. Lo necesario para funcionar no se pregunta; lo opcional está apagado hasta que lo aceptás, y rechazarlo no te limita nada."
    >
      <p>
        <CookiePreferencesButton />
      </p>

      <h2>Qué es esto</h2>
      <p>
        Una cookie es un dato chico que un sitio guarda en tu navegador. Los navegadores tienen además un almacenamiento local, que cumple una función parecida. Esta
        política cubre las dos cosas.
      </p>

      <h2>Necesarias</h2>
      <p>Hacen que el sitio funcione y guardan lo que vos pediste guardar. No se pueden apagar desde el sitio, pero sí borrar desde tu navegador.</p>
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Tipo</th>
            <th>Para qué</th>
            <th>Cuánto dura</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>medida_s</td>
            <td>Cookie</td>
            <td>Mantiene tu sesión iniciada. Solo existe si entraste con tu email. No es accesible desde scripts.</td>
            <td>30 días</td>
          </tr>
          <tr>
            <td>medida.designs.v1</td>
            <td>Almacenamiento local</td>
            <td>Tus diseños guardados: favoritos y carrito de consulta.</td>
            <td>Hasta que los borres</td>
          </tr>
          <tr>
            <td>medida.draft.*</td>
            <td>Almacenamiento local</td>
            <td>Lo último que estabas armando, para no perderlo si cerrás el navegador.</td>
            <td>Hasta que lo reemplaces</td>
          </tr>
          <tr>
            <td>medida.consent</td>
            <td>Almacenamiento local</td>
            <td>Tu elección sobre cookies opcionales.</td>
            <td>Hasta que la cambies</td>
          </tr>
          <tr>
            <td>medida.account</td>
            <td>Almacenamiento local</td>
            <td>Recuerda que hay una sesión iniciada y cuándo se sincronizaron tus diseños.</td>
            <td>Hasta que cierres sesión</td>
          </tr>
          <tr>
            <td>medida.site, medida.pitch</td>
            <td>Almacenamiento de sesión</td>
            <td>Datos de contacto del sitio ya consultados y avisos que cerraste, para no repetirlos.</td>
            <td>Hasta cerrar la pestaña</td>
          </tr>
        </tbody>
      </table>

      <h2>Medición (opcional)</h2>
      <p>
        Si la aceptás, MEDIDA cuenta cuántas veces se toca cada botón de contacto (WhatsApp o email), desde qué página y cuándo. No usa cookies para esto, no te
        identifica, no sigue tu navegación y no comparte nada con terceros. Sirve para saber qué parte del sitio genera consultas. Abrir WhatsApp se anota como un clic,
        no como un mensaje enviado.
      </p>

      <h2>Publicidad (opcional)</h2>
      <p>Hoy MEDIDA no usa cookies publicitarias ni de redes sociales. Tu elección se guarda igual, para respetarla si en el futuro se suma alguna.</p>

      <h2>Cómo cambiar tu elección</h2>
      <p>
        Con el botón de arriba o con el enlace «Preferencias de cookies» que está al pie de todas las páginas. También podés borrar lo guardado desde la configuración de
        tu navegador; si lo hacés, se pierden los diseños que no estén en una cuenta.
      </p>

      <h2>Constancia de tu elección</h2>
      <p>
        Cuando aceptás, rechazás o personalizás, se guarda un registro con la fecha, la versión de esta política y lo que elegiste, junto a un identificador al azar que no
        dice quién sos. Más detalles en la <Link href="/privacidad/">política de privacidad</Link>.
      </p>
    </LegalPage>
  );
}
