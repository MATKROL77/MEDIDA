import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/site/Legal";
import { defaultContact, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Qué datos trata MEDIDA, para qué, con quién los comparte y cómo ejercer tus derechos.",
  alternates: { canonical: "/privacidad/" },
};

export default function PrivacyPage() {
  const email = defaultContact.email;
  return (
    <LegalPage title="Política de privacidad" lead="MEDIDA se puede usar sin registrarse y sin dejar ningún dato personal. Esta página explica qué pasa con tus datos cuando decidís dejar alguno.">
      <h2>Quién es responsable</h2>
      <p>
        El responsable de los datos es {site.maker}, con domicilio en {site.makerCity}, Argentina. Para cualquier consulta sobre privacidad escribí a{" "}
        <a href={`mailto:${email}`}>{email}</a>.
      </p>

      <h2>Qué datos se tratan y para qué</h2>
      <table>
        <thead>
          <tr>
            <th>Dato</th>
            <th>Cuándo</th>
            <th>Para qué</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Tus diseños: medidas, materiales, módulos y una vista previa</td>
            <td>Cuando tocás Guardar o armás algo en un configurador</td>
            <td>Para que los encuentres al volver. Quedan en tu dispositivo; si creás una cuenta, también en el servidor, para verlos desde otro dispositivo.</td>
          </tr>
          <tr>
            <td>Tu email</td>
            <td>Solo si creás una cuenta</td>
            <td>Para mandarte el enlace o el código de acceso y, si lo activás, recordatorios sobre tus diseños guardados.</td>
          </tr>
          <tr>
            <td>Tus preferencias</td>
            <td>Cuando elegís sobre cookies, recordatorios o novedades</td>
            <td>Para respetar lo que elegiste y poder demostrarlo.</td>
          </tr>
          <tr>
            <td>La suscripción a notificaciones de tu navegador</td>
            <td>Solo si activás las notificaciones</td>
            <td>Para avisarte en ese navegador. Es una dirección técnica que genera el navegador; no incluye tu nombre ni tu teléfono.</td>
          </tr>
          <tr>
            <td>Uso anónimo de los botones de contacto</td>
            <td>Solo si aceptás la medición</td>
            <td>Para saber qué parte del sitio genera consultas. Se anota qué botón se tocó, en qué página y cuándo. No lleva identificadores ni se asocia a tu cuenta.</td>
          </tr>
          <tr>
            <td>Tu dirección IP</td>
            <td>En cada visita</td>
            <td>
              La procesa el servicio de alojamiento para entregarte el sitio. MEDIDA guarda por un máximo de una hora un derivado irreversible, únicamente para frenar
              abusos (por ejemplo, pedidos masivos de enlaces de acceso).
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        Cuando escribís por WhatsApp o por email, esa conversación ocurre en esos servicios y no en MEDIDA. Abrir WhatsApp desde un botón del sitio no le manda ningún
        dato tuyo a MEDIDA.
      </p>

      <h2>Lo que MEDIDA no hace</h2>
      <ul>
        <li>No vende ni alquila datos personales.</li>
        <li>No usa publicidad de terceros ni rastreadores de redes sociales.</li>
        <li>No te suma a listas de novedades por haber creado una cuenta: eso se acepta aparte y se puede retirar cuando quieras.</li>
        <li>No te pide el email para entrar ni para probar un configurador.</li>
      </ul>

      <h2>Por qué se pueden tratar</h2>
      <p>
        Los datos de la cuenta se tratan porque hacen falta para darte la función que pediste (guardar y recuperar tus diseños). La medición, los recordatorios, las
        notificaciones y las novedades comerciales se basan en tu consentimiento, que es libre y se puede retirar en cualquier momento desde{" "}
        Mi cuenta o desde las preferencias de cookies.
      </p>

      <h2>Con quién se comparten</h2>
      <ul>
        <li>
          <strong>Cloudflare</strong> aloja el sitio y la base de datos. Sus servidores están en varios países, entre ellos Estados Unidos, por lo que hay una
          transferencia internacional de datos.
        </li>
        <li>
          <strong>Un proveedor de envío de emails</strong> (Resend) recibe tu dirección y el contenido del mensaje para entregarte los enlaces de acceso y los
          recordatorios.
        </li>
        <li>
          <strong>El servicio de notificaciones de tu navegador</strong> (Google, Mozilla, Apple o Microsoft, según el caso) entrega las notificaciones que activaste.
        </li>
      </ul>
      <p>Fuera de eso, los datos solo se entregan si lo exige una autoridad competente.</p>

      <h2>Cuando usás el configurador de una empresa</h2>
      <p>
        Si armás un producto en el sitio de un fabricante que usa MEDIDA, la consulta que mandás la recibe esa empresa, que es responsable de lo que haga con ella. MEDIDA
        guarda esa consulta como proveedor de la empresa y no la usa para ofrecerte sus propios servicios.
      </p>

      <h2>Cuánto tiempo se guardan</h2>
      <ul>
        <li>La cuenta y los diseños, hasta que los borres o elimines la cuenta.</li>
        <li>Los enlaces y códigos de acceso vencen a los 15 minutos; los enlaces de los recordatorios, a los 7 días. Sirven una sola vez.</li>
        <li>La sesión iniciada dura 30 días sin uso.</li>
        <li>Los registros de consentimiento, 24 meses.</li>
        <li>Los datos anónimos de medición, 13 meses.</li>
      </ul>

      <h2>Tus derechos</h2>
      <p>
        Podés pedir en cualquier momento el acceso a tus datos, su rectificación, actualización o supresión. Desde Mi cuenta podés eliminar tu
        cuenta con todos sus diseños en el acto; para lo demás, escribí a <a href={`mailto:${email}`}>{email}</a> y vas a tener respuesta dentro de los plazos legales.
      </p>
      <p>
        El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo
        que se acredite un interés legítimo al efecto, conforme lo establecido en el artículo 14, inciso 3 de la Ley N.º 25.326.
      </p>
      <p>
        La Agencia de Acceso a la Información Pública, en su carácter de Órgano de Control de la Ley N.º 25.326, tiene la atribución de atender las denuncias y reclamos
        que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.
      </p>

      <h2>Menores de edad</h2>
      <p>MEDIDA no está dirigida a menores de edad y no recopila a sabiendas datos de menores.</p>

      <h2>Cambios en esta política</h2>
      <p>
        Si esta política cambia de forma relevante se actualiza la fecha de arriba y, cuando el cambio afecta lo que aceptaste, se te vuelve a preguntar. Ver también la{" "}
        <Link href="/cookies/">política de cookies</Link> y los <Link href="/terminos/">términos de uso</Link>.
      </p>
    </LegalPage>
  );
}
