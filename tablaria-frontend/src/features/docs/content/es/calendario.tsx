import { DocLink, Note, Ui } from "../../prose";
import type { DocArticle } from "../../types";

export const calendario: DocArticle = {
  slug: "calendario",
  title: "Calendario",
  description: "Los registros de cada tabla en un calendario, según sus columnas de fecha.",
  keywords: [
    "fecha",
    "mes",
    "agenda",
    "entrega",
    "caducidad",
    "garantía",
    "vencimiento",
    "revisión",
    "arrastrar",
    "planificar",
  ],
  intro: (
    <p>
      La pestaña <Ui>Calendario</Ui> coloca cada registro en el día de sus fechas: la entrega de un pedido, la caducidad
      de un lote, el fin de una garantía o la próxima revisión de un equipo. Aparece en las tablas que tienen al menos una{" "}
      <DocLink to="columnas">columna de fecha</DocLink>.
    </p>
  ),
  sections: [
    {
      id: "ver-el-mes",
      title: "Ver el mes",
      body: (
        <>
          <p>
            En el ordenador, el calendario muestra el mes por semanas, de lunes a domingo. Cada día enseña hasta tres
            registros; si tiene más, pulsa <Ui>+N más</Ui> para verlos todos. En el móvil se ve como una agenda: solo los
            días con registros, uno debajo de otro.
          </p>
          <p>
            Cambia de mes con las flechas y vuelve al actual con <Ui>Hoy</Ui>. El mes que ves queda en la dirección de la
            página, así que puedes guardarla o enviarla.
          </p>
        </>
      ),
    },
    {
      id: "fechas-y-colores",
      title: "Qué fechas y colores se muestran",
      body: (
        <ul>
          <li>
            <Ui>Fechas que se muestran</Ui>: si la tabla tiene varias columnas de fecha, el calendario las enseña todas a
            la vez, con el nombre de la columna junto a cada registro. Elige una para ver solo esa, por ejemplo solo
            las entregas de los pedidos.
          </li>
          <li>
            <Ui>Color</Ui>: si la tabla tiene una lista de opciones, cada registro toma el color de su opción, como el
            estado de un pedido. Se usa la primera lista de la tabla; puedes elegir otra o <Ui>Sin color</Ui>. Encima del
            calendario aparece qué significa cada color.
          </li>
        </ul>
      ),
    },
    {
      id: "abrir-un-registro",
      title: "Abrir un registro",
      body: (
        <p>
          Pulsa un registro para abrir su ficha, con todas sus columnas y su{" "}
          <DocLink to="etiquetas-qr">etiqueta QR</DocLink>. Si puedes editar la tabla, desde la ficha cambias el
          registro con <Ui>Editar en formulario</Ui>.
        </p>
      ),
    },
    {
      id: "cambiar-una-fecha",
      title: "Cambiar una fecha arrastrando",
      body: (
        <>
          <p>
            En el ordenador, arrastra un registro a otro día para cambiar esa fecha. Se guarda al soltarlo y te lo
            confirma un aviso. Si la tabla muestra varias columnas de fecha, cambia la del registro que arrastras.
          </p>
          <Note>
            Arrastrar necesita permiso para editar la tabla. En el móvil, o si prefieres no arrastrar, abre el registro y
            cambia la fecha en el formulario.
          </Note>
        </>
      ),
    },
    {
      id: "limites",
      title: "Límites",
      body: (
        <p>
          El calendario carga hasta 500 registros por columna de fecha en las semanas que muestra. Si un mes tiene más,
          te avisa: para verlos todos, filtra la tabla por fechas en <Ui>Registros</Ui>. Los cambios de otras personas
          aparecen solos, como en el resto de la tabla.
        </p>
      ),
    },
  ],
};
