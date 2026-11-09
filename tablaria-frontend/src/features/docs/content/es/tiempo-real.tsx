import { Ui } from "../../prose";
import type { DocArticle } from "../../types";

export const tiempoReal: DocArticle = {
  slug: "tiempo-real",
  title: "Tiempo real y actividad",
  description: "Mira quién más tiene la tabla abierta, ve sus cambios al momento y consulta el historial de actividad.",
  keywords: ["en directo", "presencia", "colaborar", "historial", "cambios", "quién", "registro de cambios", "auditoría"],
  intro: (
    <p>
      Varias personas pueden trabajar en la misma tabla a la vez. No hace falta recargar la página ni enviarse versiones
      del archivo.
    </p>
  ),
  sections: [
    {
      id: "en-directo",
      title: "Cambios en directo",
      body: (
        <>
          <p>
            Lo que cambia otra persona (registros, columnas, vistas guardadas) aparece en tu pantalla al momento. El
            indicador <Ui>En directo</Ui> de la tabla lo confirma; si pierdes la conexión, dirá{" "}
            <Ui>Reconectando…</Ui> y se pondrá al día al volver.
          </p>
        </>
      ),
    },
    {
      id: "presencia",
      title: "Quién está en la tabla",
      body: (
        <>
          <p>
            Junto al nombre de la tabla ves las iniciales de las personas que la tienen abierta. Cuando alguien edita
            una celda, la verás marcada con su nombre.
          </p>
          <p>
            Si dos personas editan la misma celda, se guarda el último cambio. En el formulario de un registro, Tablaria
            avisa si otra persona lo está editando, y al guardar solo cambia los campos que hayas tocado.
          </p>
        </>
      ),
    },
    {
      id: "actividad",
      title: "Actividad",
      body: (
        <>
          <p>
            La pestaña <Ui>Actividad</Ui> de cada tabla muestra quién cambió qué, empezando por lo más reciente:
          </p>
          <ul>
            <li>registros creados, cambiados (con las columnas que cambiaron) y borrados;</li>
            <li>importaciones de archivos;</li>
            <li>columnas creadas, renombradas, modificadas y borradas;</li>
            <li>entradas, salidas y recuentos de stock;</li>
            <li>fotos y documentos adjuntados a un registro o quitados de él.</li>
          </ul>
          <p>
            Pulsa <Ui>Ver más</Ui> para ir más atrás. Cualquiera con acceso a la tabla puede consultarla.
          </p>
        </>
      ),
    },
  ],
};
