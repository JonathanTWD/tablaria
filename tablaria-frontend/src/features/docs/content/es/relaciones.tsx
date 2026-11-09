import { DocLink, DocTable, Note, Ui } from "../../prose";
import type { DocArticle } from "../../types";

export const relaciones: DocArticle = {
  slug: "relaciones",
  title: "Relaciones, consultas y resúmenes",
  description: "Enlaza tablas entre sí, muestra datos del registro enlazado y suma lo que enlaza con cada registro.",
  keywords: ["enlazar", "vincular", "proveedor", "pedido", "lookup", "rollup", "contar", "sumar", "tablas enlazadas"],
  intro: (
    <>
      <p>
        Un inventario rara vez cabe en una tabla: los productos tienen proveedor y los pedidos llevan productos. En lugar
        de copiar el nombre del proveedor en cada producto, enlázalos. Si el proveedor cambia de teléfono, se cambia en
        un solo sitio.
      </p>
      <p>
        El ejemplo de esta guía usa dos tablas: <strong>Proveedores</strong> y <strong>Productos</strong>.
      </p>
    </>
  ),
  sections: [
    {
      id: "relacion",
      title: "Relación con otra tabla",
      body: (
        <>
          <ol>
            <li>
              En Productos, añade una columna de tipo <Ui>Relación con otra tabla</Ui> llamada «Proveedor».
            </li>
            <li>
              En <Ui>Tabla enlazada</Ui>, elige Proveedores.
            </li>
            <li>En cada producto, haz clic en la celda y busca su proveedor.</li>
          </ol>
          <p>
            La celda muestra la <strong>primera columna</strong> del registro enlazado, así que en Proveedores conviene
            que sea el nombre. Solo se puede enlazar con tablas del mismo espacio.
          </p>
          <p>
            Activa <Ui>Varios registros</Ui> para que cada celda enlace con más de uno, como los productos de un pedido
            (hasta 100 por celda).
          </p>
        </>
      ),
    },
    {
      id: "consulta",
      title: "Consulta de otra tabla",
      body: (
        <>
          <p>
            Una consulta muestra un dato del registro enlazado. Por ejemplo, en Productos, «Teléfono del proveedor»:
          </p>
          <ol>
            <li>
              Añade una columna de tipo <Ui>Consulta de otra tabla</Ui>.
            </li>
            <li>
              En <Ui>A través de la relación</Ui>, elige «Proveedor».
            </li>
            <li>
              En <Ui>Dato que se muestra</Ui>, elige «Teléfono».
            </li>
          </ol>
          <p>
            El valor se lee del proveedor cada vez: si cambia allí, cambia aquí, y no se edita desde Productos. Las
            consultas solo leen a través de relaciones de un registro, no de las que admiten varios.
          </p>
        </>
      ),
    },
    {
      id: "resumen",
      title: "Resumen de otra tabla",
      body: (
        <>
          <p>
            Un resumen mira en la otra dirección: calcula con los registros que enlazan con este. En Proveedores,
            «Número de productos» cuenta cuántos productos tienen a cada proveedor.
          </p>
          <ol>
            <li>
              En Proveedores, añade una columna de tipo <Ui>Resumen de otra tabla</Ui>.
            </li>
            <li>
              En <Ui>Registros que enlazan aquí</Ui>, elige «Productos · Proveedor».
            </li>
            <li>
              Elige el <Ui>Cálculo</Ui> y, si hace falta, la columna.
            </li>
          </ol>
          <DocTable
            caption="Cálculos de un resumen"
            head={["Cálculo", "Columna", "Ejemplo"]}
            rows={[
              ["Contar los registros", "Ninguna", "Cuántos productos tiene el proveedor."],
              ["Sumar y media", "Número o precio", "Valor total del stock de sus productos."],
              ["Mínimo y máximo", "Número, precio o fecha", "La fecha del último pedido."],
            ]}
          />
          <p>
            Se puede ordenar y filtrar por un resumen, como «los proveedores con más de 10 productos».
          </p>
        </>
      ),
    },
    {
      id: "permisos",
      title: "Tablas a las que no tienes acceso",
      body: (
        <>
          <p>
            Si una relación apunta a una tabla que no puedes abrir, verás que hay un enlace pero no a qué registro: la
            celda dice <Ui>Registro de una tabla sin acceso</Ui>. Las consultas y los resúmenes de esa tabla tampoco
            muestran su valor.
          </p>
          <Note>
            Los enlaces públicos de solo lectura no muestran las columnas de relación. Ver{" "}
            <DocLink to="compartir" section="enlace-publico">
              Enlace público
            </DocLink>
            .
          </Note>
        </>
      ),
    },
  ],
};
