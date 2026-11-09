import { Link } from "react-router";
import type { DocArticle } from "@/features/docs/types";
import { LEGAL_CONTACT_EMAIL, LEGAL_OWNER } from "../../owner";

export const avisoLegal: DocArticle = {
  slug: "aviso-legal",
  title: "Aviso legal y condiciones de uso",
  description: "Quién está detrás de Tablaria y las condiciones para usarla.",
  intro: (
    <p>
      Al usar Tablaria, en tablaria.es, aceptas estas condiciones. Son pocas y están pensadas para que el servicio siga
      funcionando bien para todos.
    </p>
  ),
  sections: [
    {
      id: "titular",
      title: "Titular",
      body: (
        <p>
          Tablaria es un proyecto personal de {LEGAL_OWNER}, gratuito y sin actividad comercial. Contacto:{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
      ),
    },
    {
      id: "servicio",
      title: "El servicio",
      body: (
        <>
          <p>
            Tablaria es gratuito y se ofrece tal cual, sin garantía de disponibilidad continua. Puede cambiar, tener
            interrupciones o dejar de prestarse; si fuera a cerrar, se avisaría con antelación para que puedas descargar
            tus datos.
          </p>
          <p>
            Conviene que guardes copias de lo importante: desde cada tabla puedes exportarla a Excel o CSV, y desde{" "}
            <strong>Ajustes</strong> descargar todos tus datos.
          </p>
        </>
      ),
    },
    {
      id: "uso",
      title: "Uso aceptable",
      body: (
        <>
          <p>Al usar Tablaria te comprometes a no:</p>
          <ul>
            <li>guardar o compartir contenido ilegal o que vulnere derechos de otras personas;</li>
            <li>intentar acceder a cuentas o datos ajenos, o saltarte los permisos;</li>
            <li>sobrecargar el servicio de forma deliberada o usarlo de forma automatizada para abusar de él;</li>
            <li>usar el asistente de IA para fines distintos de consultar tus propias tablas.</li>
          </ul>
          <p>Las cuentas que incumplan estas condiciones pueden suspenderse o borrarse.</p>
        </>
      ),
    },
    {
      id: "contenido",
      title: "Tu contenido",
      body: (
        <p>
          Lo que guardas en Tablaria es tuyo. Solo se usa para mostrártelo a ti y a quien tú decidas, como explica la{" "}
          <Link to="/privacidad">política de privacidad</Link>. Eres responsable de tener derecho a guardar y compartir
          esos datos, sobre todo si incluyen datos personales de otras personas.
        </p>
      ),
    },
    {
      id: "asistente",
      title: "Respuestas del asistente",
      body: (
        <p>
          Las respuestas del asistente las genera un modelo de IA y pueden contener errores. Compruébalas en los registros
          que enlaza antes de tomar decisiones con ellas.
        </p>
      ),
    },
    {
      id: "responsabilidad",
      title: "Responsabilidad",
      body: (
        <p>
          Dentro de lo que permite la ley, el titular no responde de los daños derivados de interrupciones del servicio,
          pérdidas de datos o decisiones tomadas a partir de su contenido o de las respuestas del asistente.
        </p>
      ),
    },
    {
      id: "propiedad",
      title: "Propiedad intelectual",
      body: (
        <p>
          El diseño, el código y la marca Tablaria pertenecen a su titular. Algunos componentes son de código abierto y
          se usan según sus licencias.
        </p>
      ),
    },
    {
      id: "ley",
      title: "Ley aplicable",
      body: <p>Estas condiciones se rigen por la ley española.</p>,
    },
  ],
};
