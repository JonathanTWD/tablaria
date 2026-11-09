import { DocLink, DocTable, Note, Ui } from "../../prose";
import type { DocArticle } from "../../types";

export const primerosPasos: DocArticle = {
  slug: "primeros-pasos",
  title: "Primeros pasos",
  description: "Prueba la demo o crea tu cuenta, entiende qué es un espacio y crea tu primera tabla.",
  keywords: ["empezar", "registro", "cuenta", "demo", "plantilla", "espacio", "inicio"],
  intro: (
    <p>
      Tablaria guarda tu inventario en tablas, como una hoja de cálculo, pero cada columna tiene un tipo y rechaza lo
      que no encaja. Esta guía te lleva de cero a tu primera tabla en unos minutos.
    </p>
  ),
  sections: [
    {
      id: "demo-o-cuenta",
      title: "Probar la demo o crear una cuenta",
      body: (
        <>
          <p>
            Con <Ui>Probar la demo</Ui>, en la página de inicio, entras al momento sin registrarte. Es una cuenta
            temporal con una ferretería de ejemplo: productos, proveedores y pedidos enlazados, con fórmulas, historial
            de stock y una organización con compañeros ficticios. Se borra a las 24 horas con todo lo que hayas
            cambiado.
          </p>
          <p>
            Para guardar tus propios datos, pulsa <Ui>Crear cuenta</Ui>. Te llegará un email para verificar la
            dirección; después ya puedes entrar con tu email y tu contraseña.
          </p>
          <Note>
            En la demo no se pueden subir adjuntos ni crear enlaces públicos, y el asistente tiene 5 preguntas en lugar
            de 15.
          </Note>
        </>
      ),
    },
    {
      id: "espacios",
      title: "Espacios: Mi espacio y organizaciones",
      body: (
        <>
          <p>
            Tus tablas viven en un <strong>espacio</strong>. Todas las cuentas tienen el suyo, <Ui>Mi espacio</Ui>,
            que solo ves tú y las personas a las que invites a cada tabla.
          </p>
          <p>
            Si trabajas en equipo, crea una <strong>organización</strong>: un espacio compartido en el que cada miembro
            ve todas sus tablas con el permiso de su rol. Cambias de espacio con el selector de la parte superior de la
            barra lateral. Lo explica <DocLink to="organizaciones">Organizaciones y roles</DocLink>.
          </p>
        </>
      ),
    },
    {
      id: "primera-tabla",
      title: "Crear tu primera tabla",
      body: (
        <>
          <ol>
            <li>
              Pulsa <Ui>Nueva tabla</Ui>, en el inicio o en la barra lateral.
            </li>
            <li>Elige un punto de partida y escribe el nombre de la tabla.</li>
            <li>
              Pulsa <Ui>Crear tabla</Ui>. Las columnas de la plantilla se pueden cambiar cuando quieras.
            </li>
          </ol>
          <DocTable
            caption="Puntos de partida al crear una tabla"
            head={["Punto de partida", "Columnas que trae"]}
            rows={[
              ["Tabla vacía", "Ninguna: añades las tuyas."],
              ["Inventario básico", "Producto, SKU, cantidad con aviso de stock, ubicación y última revisión."],
              ["Catálogo de productos", "Referencia, categoría, precio, stock, estado y destacado."],
              ["Equipos y activos", "Nº de serie, estado, a quién está asignado y su valor."],
            ]}
          />
          <p>
            ¿Ya tienes los datos en una hoja de Excel? Usa <Ui>Crear desde un archivo</Ui> y Tablaria creará la tabla
            con sus columnas. Lo explica <DocLink to="importar-exportar">Importar y exportar</DocLink>.
          </p>
        </>
      ),
    },
    {
      id: "partes-de-una-tabla",
      title: "Las partes de una tabla",
      body: (
        <>
          <p>Cada tabla tiene estas pestañas:</p>
          <ul>
            <li>
              <Ui>Registros</Ui>: los datos, para buscarlos, filtrarlos y editarlos. Ver{" "}
              <DocLink to="registros">Registros</DocLink>.
            </li>
            <li>
              <Ui>Columnas</Ui>: qué datos guarda cada registro y de qué tipo. Ver{" "}
              <DocLink to="columnas">Columnas y tipos</DocLink>.
            </li>
            <li>
              <Ui>Calendario</Ui>: los registros en el día de sus fechas, si la tabla tiene columnas de fecha. Ver{" "}
              <DocLink to="calendario">Calendario</DocLink>.
            </li>
            <li>
              <Ui>Métricas</Ui>: totales y gráficos. Ver <DocLink to="metricas">Métricas</DocLink>.
            </li>
            <li>
              <Ui>Actividad</Ui>: quién cambió qué. Ver <DocLink to="tiempo-real">Tiempo real y actividad</DocLink>.
            </li>
          </ul>
          <p>
            El <Ui>Inicio</Ui> resume todos los espacios: cuántas tablas y registros tienes, qué está{" "}
            <Ui>Bajo mínimo</Ui> y las tablas que otras personas han compartido contigo.
          </p>
        </>
      ),
    },
  ],
};
