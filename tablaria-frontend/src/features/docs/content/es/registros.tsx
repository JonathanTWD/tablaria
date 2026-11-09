import { DocLink, DocTable, Kbd, Note, Ui } from "../../prose";
import type { DocArticle } from "../../types";

export const registros: DocArticle = {
  slug: "registros",
  title: "Registros",
  description: "Crear y editar registros, buscar, filtrar, ordenar y agrupar.",
  keywords: ["fila", "editar", "celda", "buscar", "filtro", "ordenar", "agrupar", "paginación", "borrar"],
  intro: (
    <p>
      Cada fila de la tabla es un registro. Se trabaja con ellos en la pestaña <Ui>Registros</Ui>. Para crearlos,
      editarlos o borrarlos necesitas permiso de editor.
    </p>
  ),
  sections: [
    {
      id: "crear-y-editar",
      title: "Crear y editar",
      body: (
        <>
          <p>
            Pulsa <Ui>Nuevo registro</Ui> para rellenar un formulario con todas las columnas. Los campos marcados con *
            son obligatorios.
          </p>
          <p>
            Para cambiar un dato, haz clic en su celda y escribe: <Kbd>Enter</Kbd> guarda y <Kbd>Escape</Kbd> cancela.
            Desde el menú de cada fila también puedes <Ui>Editar en formulario</Ui>, abrir su ficha o{" "}
            <Ui>Borrar registro</Ui>.
          </p>
          <Note>
            Si otra persona está editando la misma celda, la verás marcada con su nombre. Si las dos guardáis, se queda
            el último cambio.
          </Note>
        </>
      ),
    },
    {
      id: "buscar",
      title: "Buscar",
      body: (
        <p>
          El buscador encuentra el texto en las columnas de texto, en las opciones de las listas y en los nombres de los
          registros enlazados. No distingue mayúsculas.
        </p>
      ),
    },
    {
      id: "filtros",
      title: "Filtros",
      body: (
        <>
          <p>
            Con <Ui>Filtros</Ui> muestras solo los registros que cumplen todas las condiciones. Cada tipo de columna
            tiene el suyo:
          </p>
          <DocTable
            caption="Filtros por tipo de columna"
            head={["Columna", "Filtro"]}
            rows={[
              ["Texto, relación y consulta", "Contiene un texto (en las relaciones, el nombre del registro enlazado)."],
              ["Número, precio, fecha y resumen", "Desde y hasta, o solo uno de los dos."],
              ["Lista de opciones", "Una o varias opciones."],
              ["Sí / No", "Sí, no o cualquiera."],
            ]}
          />
          <p>
            Las fórmulas se calculan al mostrar la página, así que todavía no se puede filtrar ni ordenar por ellas.
          </p>
          <p>
            Los filtros activos aparecen como etiquetas sobre la tabla; quítalos de uno en uno o con{" "}
            <Ui>Quitar todos</Ui>.
          </p>
        </>
      ),
    },
    {
      id: "ordenar-y-agrupar",
      title: "Ordenar y agrupar",
      body: (
        <>
          <p>
            Haz clic en el encabezado de una columna para ordenar por ella; otro clic invierte el orden. Las relaciones
            se ordenan por el nombre del registro enlazado.
          </p>
          <p>
            Con el selector de agrupar, los registros se reúnen por el valor de una columna de lista de opciones, sí /
            no, texto o relación simple, con cuántos hay en cada grupo.
          </p>
        </>
      ),
    },
    {
      id: "paginas-y-url",
      title: "Páginas y enlaces a una vista",
      body: (
        <>
          <p>Elige cuántos registros ver por página: 10, 25, 50 o 100.</p>
          <p>
            La búsqueda, los filtros, el orden, la agrupación y la página van en la dirección de la página. Copia el
            enlace y quien lo abra (con acceso a la tabla) verá lo mismo que tú. Para guardarlas con nombre, usa las{" "}
            <DocLink to="vistas-y-lote">vistas guardadas</DocLink>.
          </p>
        </>
      ),
    },
  ],
};
