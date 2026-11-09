import { Link } from "react-router";
import { DocTable, Note, Ui } from "@/features/docs/prose";
import type { DocArticle } from "@/features/docs/types";
import { LEGAL_CONTACT_EMAIL, LEGAL_OWNER } from "../../owner";

const email = <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>;

export const privacidad: DocArticle = {
  slug: "privacidad",
  title: "Política de privacidad",
  description: "Qué datos guarda Tablaria, para qué, con quién se comparten y cómo ejercer tus derechos.",
  intro: (
    <p>
      Tablaria es un proyecto personal y gratuito, sin publicidad ni actividad comercial. Solo trata los datos que
      necesita para que la aplicación funcione, no los vende ni los usa para nada más.
    </p>
  ),
  sections: [
    {
      id: "responsable",
      title: "Responsable",
      body: (
        <p>
          El responsable del tratamiento es {LEGAL_OWNER}. Para cualquier duda sobre tus datos o para ejercer tus
          derechos, escribe a {email}.
        </p>
      ),
    },
    {
      id: "datos",
      title: "Qué datos tratamos",
      body: (
        <ul>
          <li>
            <strong>Tu cuenta:</strong> tu email, tu contraseña (guardada con un hash Argon2id, nunca en claro) y la
            fecha de alta.
          </li>
          <li>
            <strong>Lo que guardas en Tablaria:</strong> tus tablas, columnas, registros, vistas guardadas, movimientos
            de stock y adjuntos, y la actividad de cada tabla (quién cambió qué y cuándo).
          </li>
          <li>
            <strong>Tu equipo:</strong> los emails de las personas a las que invitas y los espacios y roles que
            compartís.
          </li>
          <li>
            <strong>El asistente de IA:</strong> cuántas preguntas haces cada día. Las conversaciones no se guardan.
          </li>
          <li>
            <strong>Datos técnicos:</strong> las cookies de sesión, y la dirección IP cuando una petición supera los
            límites contra el abuso, que queda en los registros del servidor.
          </li>
        </ul>
      ),
    },
    {
      id: "finalidad",
      title: "Para qué y con qué base legal",
      body: (
        <>
          <DocTable
            caption="Finalidades del tratamiento y su base legal"
            head={["Para", "Base legal"]}
            rows={[
              [
                "Darte acceso, guardar y mostrar tus datos, y enviarte los emails del servicio (verificación, recuperación de contraseña, invitaciones).",
                "La ejecución del servicio que pides al crear la cuenta (art. 6.1.b del RGPD).",
              ],
              [
                "Responder a tus preguntas con el asistente de IA, solo cuando lo usas.",
                "La ejecución del servicio (art. 6.1.b del RGPD).",
              ],
              [
                "Proteger el servicio: limitar intentos de acceso, frenar el abuso y registrar cambios de permisos.",
                "El interés legítimo en mantener Tablaria seguro (art. 6.1.f del RGPD).",
              ],
            ]}
          />
          <p>
            Tablaria no envía publicidad, no hace perfiles, no vende datos y no los usa para entrenar modelos de IA.
          </p>
        </>
      ),
    },
    {
      id: "proveedores",
      title: "Con quién se comparten",
      body: (
        <>
          <p>
            Tus tablas solo las ven las personas con las que tú las compartes. Para funcionar, Tablaria usa estos
            proveedores, que tratan los datos por encargo de Tablaria y solo para prestar su servicio:
          </p>
          <DocTable
            caption="Proveedores que tratan datos"
            head={["Proveedor", "Para qué", "Dónde"]}
            rows={[
              ["Render", "Alojar la web y la API.", "Estados Unidos"],
              ["Neon", "Base de datos con tu cuenta y tus tablas.", "Unión Europea (Fráncfort)"],
              ["Filebase", "Guardar los adjuntos.", "Estados Unidos"],
              ["Resend", "Enviar los emails del servicio.", "Estados Unidos"],
              ["Groq", "El modelo de IA del asistente: recibe tu pregunta y los datos que consulta.", "Estados Unidos"],
            ]}
          />
          <p>
            Si dictas una pregunta al asistente, el reconocimiento de voz lo hace tu navegador; en Chrome, por ejemplo,
            el audio lo procesa Google. Si prefieres evitarlo, escribe la pregunta.
          </p>
        </>
      ),
    },
    {
      id: "transferencias",
      title: "Transferencias fuera de la Unión Europea",
      body: (
        <p>
          Algunos proveedores están en Estados Unidos. Esas transferencias se amparan en las garantías que ofrece cada
          uno: su adhesión al Marco de Privacidad de Datos UE-EE. UU. o las cláusulas contractuales tipo de la Comisión
          Europea.
        </p>
      ),
    },
    {
      id: "conservacion",
      title: "Cuánto tiempo se guardan",
      body: (
        <ul>
          <li>Tu cuenta y tus datos, mientras la cuenta exista. Al borrarla, se borran al momento.</li>
          <li>Las copias de seguridad del proveedor de base de datos pueden conservarlos unos días más.</li>
          <li>Las cuentas de la demo y todo lo que contienen, 24 horas.</li>
          <li>La sesión, 7 días sin usarla; las invitaciones, 7 días si no se aceptan.</li>
          <li>Los registros técnicos del servidor, el tiempo limitado que los guarda el proveedor de alojamiento.</li>
        </ul>
      ),
    },
    {
      id: "derechos",
      title: "Tus derechos",
      body: (
        <>
          <p>
            Puedes acceder a tus datos, rectificarlos, borrarlos, llevártelos a otro servicio, oponerte a su
            tratamiento o pedir que se limite. Casi todo lo puedes hacer tú mismo en <Ui>Ajustes</Ui>:
          </p>
          <ul>
            <li>
              <Ui>Descargar mis datos</Ui> te da un archivo con tu cuenta y tus tablas.
            </li>
            <li>
              <Ui>Borrar mi cuenta</Ui> lo borra todo.
            </li>
          </ul>
          <p>
            Para lo demás, escribe a {email}. Si crees que no se han respetado tus derechos, puedes reclamar ante la
            Agencia Española de Protección de Datos (<a href="https://www.aepd.es">aepd.es</a>).
          </p>
        </>
      ),
    },
    {
      id: "seguridad",
      title: "Seguridad",
      body: (
        <p>
          Todo viaja cifrado por HTTPS. Las sesiones usan cookies que el código de la página no puede leer, los permisos
          se comprueban en el servidor en cada petición y los adjuntos se guardan en un almacenamiento privado, con
          enlaces que caducan en minutos.
        </p>
      ),
    },
    {
      id: "menores",
      title: "Menores",
      body: <p>Tablaria no está pensada para menores de 14 años, que no deben crear una cuenta.</p>,
    },
    {
      id: "cambios",
      title: "Cambios en esta política",
      body: (
        <>
          <p>
            Si esta política cambia, la fecha de arriba lo dirá. Si el cambio es importante, se avisará por email a las
            cuentas registradas.
          </p>
          <Note>
            Las cookies se explican en la <Link to="/cookies">política de cookies</Link>.
          </Note>
        </>
      ),
    },
  ],
};
