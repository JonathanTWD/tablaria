import { Ui } from "../../prose";
import type { DocArticle } from "../../types";

export const metricas: DocArticle = {
  slug: "metricas",
  title: "Métricas",
  description: "Totales, medias, gráficos por grupos y la evolución en el tiempo de cada tabla.",
  keywords: ["gráfico", "estadísticas", "total", "media", "suma", "barras", "dona", "evolución", "informe"],
  intro: (
    <p>
      La pestaña <Ui>Métricas</Ui> de cada tabla resume sus datos sin montar una tabla dinámica. Los cálculos usan todos
      los registros de la tabla.
    </p>
  ),
  sections: [
    {
      id: "resumen",
      title: "Resumen",
      body: (
        <ul>
          <li>
            <Ui>Registros</Ui>: cuántos tiene la tabla.
          </li>
          <li>
            <Ui>Bajo mínimo</Ui>: cuántos están por debajo del aviso de alguna columna, si la tabla tiene avisos.
          </li>
          <li>
            Un <Ui>Total</Ui> por cada columna de número o precio, con su media, su mínimo y su máximo.
          </li>
        </ul>
      ),
    },
    {
      id: "por-grupos",
      title: "Por grupos",
      body: (
        <>
          <p>
            Compara grupos de registros, como el valor del stock por categoría. Elige:
          </p>
          <ul>
            <li>
              <Ui>Agrupar por</Ui>: una lista de opciones, una columna sí / no, una relación simple o una de texto.
            </li>
            <li>
              <Ui>Medir</Ui>: el número de registros, o la suma, la media, el mínimo o el máximo de una columna de
              número o precio.
            </li>
            <li>
              <Ui>Tipo de gráfico</Ui>: barras o dona.
            </li>
          </ul>
          <p>Se muestran los 8 grupos más grandes; el resto se reúne en «Otros».</p>
        </>
      ),
    },
    {
      id: "evolucion",
      title: "Evolución",
      body: (
        <p>
          Muestra cómo cambia una medida con el tiempo. En <Ui>Según</Ui>, elige una columna de fecha o la{" "}
          <Ui>Fecha de creación</Ui> de los registros, y en <Ui>Periodo</Ui>, día, semana o mes. Se ven hasta 36
          periodos, los más recientes.
        </p>
      ),
    },
  ],
};
