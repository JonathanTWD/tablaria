import { DocLink, DocTable, Note, Ui } from "../../prose";
import type { DocArticle } from "../../types";

export const stock: DocArticle = {
  slug: "stock",
  title: "Stock y avisos",
  description: "Anota entradas, salidas y recuentos con su motivo, consulta el historial y recibe avisos de bajo mínimo.",
  keywords: ["inventario", "existencias", "entrada", "salida", "recuento", "movimiento", "historial", "mínimo", "agotado", "alerta"],
  intro: (
    <p>
      Cambiar un número en una celda no dice por qué cambió. Las columnas de stock guardan cada movimiento con quién lo
      hizo, cuándo y por qué, y avisan cuando algo se está acabando.
    </p>
  ),
  sections: [
    {
      id: "columna-de-stock",
      title: "Activar el stock en una columna",
      body: (
        <>
          <p>
            Edita una columna de número (o créala) y activa <Ui>Columna de stock</Ui>. Las plantillas de inventario y
            de catálogo ya la traen activada.
          </p>
          <p>
            Para que avise, rellena <Ui>Avisar cuando baje de</Ui> con el mínimo, por ejemplo 5. Funciona en cualquier
            columna de número, sea de stock o no.
          </p>
        </>
      ),
    },
    {
      id: "movimientos",
      title: "Anotar movimientos",
      body: (
        <>
          <p>
            En el menú de cada registro, elige <Ui>Movimientos de stock</Ui> y el tipo de movimiento:
          </p>
          <DocTable
            caption="Tipos de movimiento"
            head={["Movimiento", "Qué hace"]}
            rows={[
              ["Entrada", "Suma las unidades que entran, como un pedido recibido."],
              ["Salida", "Resta las unidades que salen, como una venta o una obra."],
              ["Recuento", "Sustituye el stock por la cifra contada, al hacer inventario."],
            ]}
          />
          <p>
            Antes de guardar ves cómo quedará el stock. Añade una nota con el pedido, el cliente o el motivo (hasta 200
            caracteres).
          </p>
          <Note>
            Editar el número directamente en la celda también queda anotado, como <Ui>Edición</Ui>, y lo que cambia una
            importación, como <Ui>Importación</Ui>.
          </Note>
        </>
      ),
    },
    {
      id: "historial",
      title: "Historial",
      body: (
        <p>
          En la misma ventana está el <Ui>Historial</Ui> del registro: cada movimiento con su cantidad, quién lo hizo,
          cuándo, su nota y el stock que quedó. Se muestran los 100 más recientes. Quien solo puede leer la tabla ve el
          historial, pero no anota movimientos.
        </p>
      ),
    },
    {
      id: "avisos",
      title: "Avisos de bajo mínimo",
      body: (
        <>
          <p>Cuando un valor baja del mínimo:</p>
          <ul>
            <li>
              la celda se marca en la tabla, y como <Ui>agotado</Ui> si llega a cero;
            </li>
            <li>
              aparece en el panel <Ui>Bajo mínimo</Ui> del inicio, con cuántos quedan y el mínimo;
            </li>
            <li>
              se cuenta en las <DocLink to="metricas">métricas</DocLink> de la tabla.
            </li>
          </ul>
          <p>
            Para ver todos los registros bajo mínimo de una tabla, filtra la columna con un máximo y guárdalo como{" "}
            <DocLink to="vistas-y-lote">vista</DocLink>. También puedes preguntárselo al{" "}
            <DocLink to="asistente">asistente</DocLink>.
          </p>
        </>
      ),
    },
  ],
};
