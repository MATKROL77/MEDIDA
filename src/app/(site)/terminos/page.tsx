import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/site/Legal";
import { defaultContact, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Términos de uso",
  description: "Las condiciones para usar el sitio y los configuradores de demostración de MEDIDA.",
  alternates: { canonical: "/terminos/" },
};

export default function TermsPage() {
  const email = defaultContact.email;
  return (
    <LegalPage title="Términos de uso" lead="Las condiciones para usar este sitio y sus configuradores de demostración. Si no estás de acuerdo con alguna, no uses el sitio.">
      <h2>Qué es MEDIDA</h2>
      <p>
        MEDIDA es un software de configuradores 3D de productos a medida, desarrollado por {site.maker} en {site.makerCity}, Argentina. MEDIDA no fabrica ni vende
        muebles.
      </p>

      <h2>Los configuradores de demostración</h2>
      <ul>
        <li>Se pueden usar libremente y sin registro, para conocer el producto.</li>
        <li>
          Los precios que muestran son <strong>valores de muestra</strong>: no son una oferta, un presupuesto ni un precio de venta.
        </li>
        <li>No hay un taller asociado a la demostración. Guardar un diseño, sumarlo al carrito o enviar una consulta no genera un pedido ni una obligación de compra.</li>
        <li>
          Las medidas, el despiece y los planos que genera la demostración son orientativos. Antes de fabricar, quien fabrica tiene que verificar las medidas en el lugar,
          los materiales y los costos.
        </li>
      </ul>

      <h2>El carrito de consulta</h2>
      <p>
        El carrito reúne muebles configurados para pedir una cotización. No procesa pagos y no confirma compras. Un precio solo es definitivo cuando lo confirma por
        escrito quien va a fabricar o vender el producto.
      </p>

      <h2>Configuradores de empresas</h2>
      <p>
        Cuando un fabricante usa MEDIDA en su propio sitio, la relación comercial es entre vos y ese fabricante: los precios, plazos, garantías y la atención son
        responsabilidad suya. MEDIDA provee la herramienta y no interviene en esa operación.
      </p>

      <h2>Tu cuenta</h2>
      <ul>
        <li>La cuenta es opcional y sirve para guardar tus diseños y abrirlos desde otro dispositivo.</li>
        <li>Se entra con un enlace o un código que llega a tu email. Quien tenga acceso a tu casilla puede entrar a tu cuenta: cuidala.</li>
        <li>Podés eliminar la cuenta y todos sus datos cuando quieras desde Mi cuenta.</li>
      </ul>

      <h2>Uso permitido</h2>
      <p>
        No está permitido intentar acceder a cuentas o datos ajenos, interferir con el funcionamiento del sitio, automatizar pedidos masivos, ni usar el sitio para
        algo ilegal. Si eso pasa, el acceso se puede suspender.
      </p>

      <h2>Propiedad intelectual</h2>
      <p>
        El software, el diseño del sitio, la marca MEDIDA y sus textos pertenecen a su autor. Los diseños que armás con el configurador son tuyos: podés usarlos,
        compartirlos y llevárselos a quien quieras.
      </p>

      <h2>Disponibilidad y responsabilidad</h2>
      <p>
        El sitio se ofrece tal como está. Se hace lo razonable para que funcione bien y para cuidar lo que guardás, pero no se garantiza que esté disponible sin
        interrupciones ni que los cálculos de la demostración estén libres de errores. En la medida en que la ley lo permita, MEDIDA no responde por los daños que
        resulten de fabricar a partir de una demostración sin la verificación de un profesional. Nada de esto limita los derechos que la ley les reconoce a los
        consumidores.
      </p>

      <h2>Contratación de servicios</h2>
      <p>
        Los servicios para empresas (un configurador para tu web, una página completa o la plataforma) se contratan aparte, con una propuesta que fija alcance, precio y
        plazos. Estos términos no reemplazan ese acuerdo.
      </p>

      <h2>Ley aplicable</h2>
      <p>Estos términos se rigen por las leyes de la República Argentina.</p>

      <h2>Contacto</h2>
      <p>
        Por cualquier duda sobre estos términos, escribí a <a href={`mailto:${email}`}>{email}</a>. Ver también la <Link href="/privacidad/">política de privacidad</Link>{" "}
        y la <Link href="/cookies/">política de cookies</Link>.
      </p>
    </LegalPage>
  );
}
