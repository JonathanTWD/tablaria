import { DocLink, DocTable, Note, Ui } from "../../prose";
import type { DocArticle } from "../../types";

export const columnas: DocArticle = {
  slug: "columnas",
  title: "Columnas y tipos",
  description: "Qué tipos de columna hay, qué opciones tiene cada una y qué pasa al cambiar el tipo.",
  keywords: ["campo", "tipo", "obligatoria", "único", "por defecto", "lista", "opciones", "precio", "moneda"],
  intro: (
    <p>
      Las columnas dicen qué datos guarda cada registro. Se gestionan en la pestaña <Ui>Columnas</Ui> de la tabla, con{" "}
      <Ui>Añadir columna</Ui>. Solo quien administra la tabla puede cambiarlas.
    </p>
  ),
  sections: [
    {
      id: "tipos",
      title: "Tipos de columna",
      body: (
        <>
          <p>
            El tipo decide qué se puede escribir en la columna. Tablaria no deja guardar una fecha donde va un precio.
          </p>
          <DocTable
            caption="Tipos de columna"
            head={["Tipo", "Para qué sirve"]}
            rows={[
              ["Texto", "Nombres, referencias, notas. Hasta 2.000 caracteres."],
              ["Número", "Cantidades, medidas, stock."],
              ["Fecha", "Revisiones, caducidades, compras."],
              ["Sí / No", "Activo, revisado, en oferta."],
              ["Lista de opciones", "Estado o categoría, cada opción con su color. Hasta 50 opciones."],
              ["Precio", "Importes en la moneda que elijas."],
              ["Relación con otra tabla", "Enlaza cada registro con otro de otra tabla, como un producto con su proveedor."],
              ["Consulta de otra tabla", "Muestra un dato del registro enlazado, como el teléfono del proveedor."],
              ["Resumen de otra tabla", "Cuenta o suma los registros que enlazan aquí."],
              ["Fórmula", "Calcula con otras columnas, como precio × stock."],
            ]}
          />
          <p>
            Las cuatro últimas tienen su propia guía: <DocLink to="relaciones">Relaciones, consultas y resúmenes</DocLink>{" "}
            y <DocLink to="formulas">Fórmulas</DocLink>.
          </p>
        </>
      ),
    },
    {
      id: "opciones",
      title: "Opciones de cada columna",
      body: (
        <>
          <ul>
            <li>
              <Ui>Obligatoria</Ui>: cada registro tendrá que rellenarla.
            </li>
            <li>
              <Ui>Valor único</Ui>: ningún registro podrá repetir su valor, sin distinguir mayúsculas. Útil para SKU o
              números de serie, y para actualizar registros al importar.
            </li>
            <li>
              <Ui>Valor por defecto</Ui>: se usa al crear registros nuevos, y se rellena en los que ya existen al añadir
              la columna.
            </li>
            <li>
              <Ui>Columna de stock</Ui> (en números): guarda cada entrada, salida y cambio con quién lo hizo. Ver{" "}
              <DocLink to="stock">Stock y avisos</DocLink>.
            </li>
            <li>
              <Ui>Avisar cuando baje de</Ui> (en números): marca los valores por debajo y los muestra en las métricas de
              la tabla.
            </li>
            <li>
              <Ui>Avisar días antes</Ui> (en fechas): marca las fechas que llegan en ese plazo y las muestra en{" "}
              <Ui>Próximamente</Ui>, en el Inicio. Ver <DocLink to="calendario" section="avisos">Calendario y avisos de
              fechas</DocLink>.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "orden",
      title: "Orden y primera columna",
      body: (
        <>
          <p>
            Cambia el orden con los botones de subir y bajar de cada columna. El orden es el de la tabla, el del
            formulario y el de las exportaciones.
          </p>
          <p>
            La <strong>primera columna</strong> es el nombre de cada registro: es lo que se ve cuando otra tabla lo
            enlaza, en las etiquetas QR, en la actividad y en las respuestas del asistente. Conviene que sea de texto,
            como el nombre del producto.
          </p>
        </>
      ),
    },
    {
      id: "cambiar-tipo",
      title: "Cambiar el tipo de una columna",
      body: (
        <>
          <p>
            Al editar una columna puedes elegir otro tipo. Tablaria convierte los valores guardados: «12» pasa de texto a
            número sin problema, pero «doce» no, y se queda vacío. Al guardar te dice cuántos valores se han vaciado.
          </p>
          <Note>
            Si no quieres perder nada, exporta la tabla antes de cambiar el tipo. Ver{" "}
            <DocLink to="importar-exportar" section="exportar">
              Exportar
            </DocLink>
            .
          </Note>
        </>
      ),
    },
    {
      id: "limites",
      title: "Límites",
      body: (
        <ul>
          <li>Hasta 50 columnas por tabla, con nombres de hasta 60 caracteres.</li>
          <li>Hasta 10.000 registros por tabla y 100 tablas por espacio.</li>
          <li>
            Borrar una columna borra sus valores en todos los registros. No se puede deshacer.
          </li>
        </ul>
      ),
    },
  ],
};
