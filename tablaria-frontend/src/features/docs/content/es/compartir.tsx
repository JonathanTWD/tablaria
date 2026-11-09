import { DocLink, DocTable, Note, Ui } from "../../prose";
import type { DocArticle } from "../../types";

export const compartir: DocArticle = {
  slug: "compartir",
  title: "Compartir tablas",
  description: "Invita a otras personas a una tabla como lectoras o editoras, o compártela con un enlace de solo lectura.",
  keywords: ["invitar", "permisos", "lector", "editor", "colaborar", "enlace público", "solo lectura", "acceso"],
  intro: (
    <p>
      Hay tres formas de trabajar con otras personas: invitarlas a una tabla concreta, que es lo que explica esta guía;
      crear un enlace público de solo lectura, o crear una <DocLink to="organizaciones">organización</DocLink> para que
      vean todas sus tablas.
    </p>
  ),
  sections: [
    {
      id: "invitar",
      title: "Invitar a una tabla",
      body: (
        <>
          <ol>
            <li>
              En la tabla, pulsa <Ui>Compartir</Ui>.
            </li>
            <li>Escribe el email de la persona y elige su permiso.</li>
            <li>
              Pulsa <Ui>Enviar invitación</Ui>. Le llegará un email con un enlace para aceptarla; si aún no tiene cuenta,
              podrá crearla con ese email.
            </li>
          </ol>
          <DocTable
            caption="Permisos al compartir una tabla"
            head={["Permiso", "Qué puede hacer"]}
            rows={[
              ["Lector", "Ver la tabla, sus métricas y su actividad, y exportarla."],
              [
                "Editor",
                "Además, crear, editar y borrar registros, importar, anotar movimientos de stock y subir adjuntos.",
              ],
            ]}
          />
          <p>
            Las columnas y la propia tabla solo las cambia quien la administra. La persona invitada solo ve esa tabla,
            no el resto de tu espacio; la encontrará en <Ui>Compartidas contigo</Ui>, en el inicio.
          </p>
          <Note>Las invitaciones caducan a los 7 días y solo se pueden usar una vez.</Note>
        </>
      ),
    },
    {
      id: "gestionar",
      title: "Cambiar permisos o quitar el acceso",
      body: (
        <>
          <p>
            En <Ui>Compartir</Ui> ves las <Ui>Personas con acceso</Ui> y las <Ui>Invitaciones pendientes</Ui>. Desde
            ahí cambias el permiso de cada una, le quitas el acceso o anulas una invitación que aún no han aceptado.
          </p>
          <p>
            Si te han compartido una tabla y ya no la necesitas, usa <Ui>Salir de la tabla</Ui> en el menú de la tabla.
            Para volver, tendrán que invitarte de nuevo.
          </p>
          <p>Cada tabla se puede compartir con hasta 25 personas.</p>
        </>
      ),
    },
    {
      id: "enlace-publico",
      title: "Enlace público de solo lectura",
      body: (
        <>
          <p>
            Para enseñar una tabla a alguien sin cuenta, como un catálogo para un cliente, crea un enlace público en{" "}
            <Ui>Compartir</Ui> → <Ui>Crear enlace</Ui>. Quien lo abra verá la tabla y podrá buscar en ella, sin iniciar
            sesión y sin poder cambiar nada.
          </p>
          <ul>
            <li>Las columnas de relación no se muestran, para no enseñar datos de otras tablas.</li>
            <li>
              Copia el enlace al crearlo: por seguridad, no se puede volver a mostrar. Si lo pierdes, crea uno nuevo y el
              anterior dejará de funcionar.
            </li>
            <li>
              Con <Ui>Desactivar</Ui>, el enlace deja de funcionar al momento.
            </li>
          </ul>
          <Note>En la demo no se pueden crear enlaces públicos.</Note>
        </>
      ),
    },
  ],
};
