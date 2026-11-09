import { Note, Ui } from "../../prose";
import type { DocArticle } from "../../types";

export const vistasYLote: DocArticle = {
  slug: "vistas-y-lote",
  title: "Vistas guardadas y cambios en lote",
  description: "Guarda tus búsquedas y filtros con nombre, y cambia o borra varios registros de una vez.",
  keywords: ["vista", "filtro guardado", "lote", "masivo", "varios", "seleccionar", "borrar varios"],
  intro: (
    <p>
      Dos atajos para el trabajo diario: volver a una combinación de filtros con un clic, y no tener que editar los
      registros de uno en uno.
    </p>
  ),
  sections: [
    {
      id: "vistas",
      title: "Vistas guardadas",
      body: (
        <>
          <p>
            Una vista guarda con un nombre la búsqueda, los filtros, el orden y la agrupación que estás viendo, por
            ejemplo «Bajo mínimo» o «Pasillo B».
          </p>
          <ol>
            <li>Prepara la tabla como quieras verla.</li>
            <li>
              Abre <Ui>Vistas</Ui> y elige <Ui>Guardar la vista actual…</Ui>.
            </li>
            <li>Escribe un nombre y guárdala.</li>
          </ol>
          <p>
            Todas las personas con acceso a la tabla pueden usarla desde el mismo menú. Con{" "}
            <Ui>Gestionar vistas…</Ui> se cambia su nombre, se actualiza con lo que ves ahora o se elimina. Eliminar una
            vista no toca los registros.
          </p>
          <Note>Cada tabla admite hasta 20 vistas guardadas.</Note>
        </>
      ),
    },
    {
      id: "seleccionar",
      title: "Seleccionar varios registros",
      body: (
        <p>
          Marca la casilla de cada registro, o la del encabezado para seleccionar toda la página. Aparece una barra con
          las acciones para los seleccionados. Puedes seleccionar hasta 100 a la vez.
        </p>
      ),
    },
    {
      id: "cambiar-un-valor",
      title: "Cambiar un valor en todos",
      body: (
        <>
          <p>
            Con <Ui>Cambiar un valor</Ui> eliges una columna y el valor nuevo, y todos los registros seleccionados lo
            toman. El resto de sus celdas no cambia. Déjalo vacío para vaciar esa celda en todos.
          </p>
          <p>
            Las columnas de valor único no aparecen: si dos registros tuvieran el mismo valor, dejaría de ser único.
          </p>
        </>
      ),
    },
    {
      id: "eliminar-varios",
      title: "Eliminar varios",
      body: (
        <p>
          <Ui>Eliminar</Ui> borra los seleccionados con todos sus datos, y dejan de aparecer en las relaciones de otras
          tablas. Se cambian o se borran todos o ninguno: si otra persona ha borrado alguno mientras tanto, no se toca
          nada y te pide volver a seleccionarlos.
        </p>
      ),
    },
  ],
};
