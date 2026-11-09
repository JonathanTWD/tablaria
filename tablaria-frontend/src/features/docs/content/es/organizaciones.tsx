import { DocTable, Note, Ui } from "../../prose";
import type { DocArticle } from "../../types";

export const organizaciones: DocArticle = {
  slug: "organizaciones",
  title: "Organizaciones y roles",
  description: "Un espacio compartido para tu equipo: miembros, roles y qué puede hacer cada uno.",
  keywords: ["equipo", "empresa", "miembros", "roles", "administrador", "propietario", "permisos", "espacio"],
  intro: (
    <p>
      Una organización es un espacio compartido, como el de una tienda o un taller. Sus miembros ven todas sus tablas,
      cada uno con el permiso de su rol, sin tener que compartirlas de una en una.
    </p>
  ),
  sections: [
    {
      id: "crear",
      title: "Crear una organización",
      body: (
        <>
          <p>
            Abre el selector de espacio, en la parte superior de la barra lateral, y elige{" "}
            <Ui>Crear organización</Ui>. Serás su propietario. Las tablas que crees con ese espacio seleccionado serán de
            la organización.
          </p>
          <p>
            Con <Ui>Gestionar organización</Ui> cambias su nombre, invitas a miembros y gestionas sus roles.
          </p>
        </>
      ),
    },
    {
      id: "roles",
      title: "Roles",
      body: (
        <>
          <p>Cada rol puede hacer lo mismo que el anterior, y algo más:</p>
          <DocTable
            caption="Roles de una organización"
            head={["Rol", "Qué puede hacer"]}
            rows={[
              ["Lector", "Ver todas las tablas y exportarlas."],
              ["Editor", "Crear, editar y borrar registros, importar, anotar stock y subir adjuntos."],
              ["Administrador", "Crear y borrar tablas, cambiar columnas, compartir tablas y gestionar miembros."],
              ["Propietario", "Borrar la organización y nombrar a otros propietarios."],
            ]}
          />
        </>
      ),
    },
    {
      id: "miembros",
      title: "Invitar y gestionar miembros",
      body: (
        <>
          <p>
            En <Ui>Invitar</Ui>, escribe el email y elige el rol. Le llegará un email con un enlace para unirse; si aún
            no tiene cuenta, podrá crearla con ese email. En <Ui>Miembros</Ui> puedes cambiar el rol de cada persona,
            quitarla o anular una invitación pendiente.
          </p>
          <Note>Una organización admite hasta 25 miembros, y cada cuenta puede crear hasta 10 organizaciones.</Note>
        </>
      ),
    },
    {
      id: "salir-o-borrar",
      title: "Salir o borrar la organización",
      body: (
        <>
          <p>
            En la <Ui>Zona de peligro</Ui> puedes <Ui>Salir de la organización</Ui>. Si eres su único propietario, antes
            tendrás que nombrar a otra persona propietaria.
          </p>
          <p>
            <Ui>Borrar organización</Ui> borra todas sus tablas y registros para todos sus miembros. No se puede
            deshacer.
          </p>
        </>
      ),
    },
  ],
};
