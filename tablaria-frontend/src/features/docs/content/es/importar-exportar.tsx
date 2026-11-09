import { DocLink, DocTable, Note, Ui } from "../../prose";
import type { DocArticle } from "../../types";

export const importarExportar: DocArticle = {
  slug: "importar-exportar",
  title: "Importar y exportar",
  description: "Trae tus hojas de Excel o CSV con vista previa y sin filas repetidas, y exporta cualquier vista.",
  keywords: ["excel", "xlsx", "csv", "hoja de cálculo", "subir", "descargar", "duplicados", "repetidas", "migrar"],
  intro: (
    <p>
      Tablaria lee y escribe archivos de Excel (.xlsx) y CSV. Importar no guarda nada hasta que todo encaja: antes ves
      qué va a pasar con cada fila.
    </p>
  ),
  sections: [
    {
      id: "importar",
      title: "Importar en una tabla",
      body: (
        <>
          <ol>
            <li>
              En la tabla, pulsa <Ui>Importar</Ui> (si no lo ves, está en <Ui>Más</Ui>).
            </li>
            <li>
              Elige el archivo. De un libro de Excel se lee la primera hoja con datos. Indica si{" "}
              <Ui>La primera fila tiene los nombres de las columnas</Ui>.
            </li>
            <li>
              Empareja cada columna del archivo con una de la tabla, o elige <Ui>No importar</Ui>. Las que se llaman
              igual ya vienen emparejadas.
            </li>
            <li>
              Pulsa <Ui>Comprobar</Ui>. Verás cuántos registros están listos, una vista previa de las primeras filas y
              cada celda que no encaja, con su fila y su motivo.
            </li>
            <li>
              Si todo está bien, pulsa <Ui>Importar</Ui>. Si no, corrige el archivo o vuelve a las columnas.
            </li>
          </ol>
          <p>Cada archivo puede tener hasta 5.000 filas. Para importar necesitas permiso de editor.</p>
        </>
      ),
    },
    {
      id: "nueva-tabla",
      title: "Crear una tabla desde un archivo",
      body: (
        <p>
          Al crear una tabla, elige <Ui>Crear desde un archivo</Ui>. Tablaria propone una columna nueva por cada una
          del archivo, con el tipo que mejor encaja con sus valores (número, fecha, precio…). Puedes cambiar el tipo o
          el nombre antes de crearla.
        </p>
      ),
    },
    {
      id: "valores",
      title: "Cómo se leen los valores",
      body: (
        <>
          <DocTable
            caption="Formatos que entiende la importación"
            head={["Columna", "Formatos válidos"]}
            rows={[
              ["Número y precio", "1234,56 · 1.234,56 · 1,234.56 · 12,5 €"],
              ["Fecha", "31/12/2026 · 2026-12-31"],
              ["Sí / No", "sí, si, x, 1, yes o true para sí; no, 0 o false para no"],
              ["Lista de opciones", "El texto de una opción, sin distinguir mayúsculas"],
              ["Relación", "El nombre del registro enlazado (su primera columna); si admite varios, separados por comas"],
            ]}
          />
          <p>
            Los CSV pueden ir separados por punto y coma, comas o tabuladores: se detecta solo. Si un valor no es una
            opción de la lista, puedes <Ui>Añadirlos como opciones nuevas</Ui> (si administras la tabla).
          </p>
        </>
      ),
    },
    {
      id: "repetidas",
      title: "Filas repetidas",
      body: (
        <>
          <p>
            Importar dos veces el mismo archivo es el error más común, así que Tablaria lo detecta. Una fila es repetida
            si es igual que un registro de la tabla, o que otra fila del archivo, en las columnas que trae el archivo
            (sin distinguir mayúsculas).
          </p>
          <p>
            <Ui>Omitir las filas repetidas</Ui> viene activado: la vista previa las marca como <Ui>Se omite</Ui> y no
            se importan. Desactívalo si de verdad quieres registros repetidos.
          </p>
        </>
      ),
    },
    {
      id: "actualizar",
      title: "Actualizar registros que ya existen",
      body: (
        <>
          <p>
            Si la tabla tiene una columna de valor único, como el SKU, puedes elegirla en{" "}
            <Ui>Actualizar los registros que coincidan en</Ui>. Cada fila cuyo SKU ya esté en la tabla actualiza ese
            registro en lugar de añadir otro. Así se cargan, por ejemplo, los precios nuevos de un proveedor.
          </p>
          <Note>
            En las columnas de stock, lo que cambia una importación queda en el historial como un movimiento de{" "}
            <Ui>Importación</Ui>. Ver <DocLink to="stock">Stock y avisos</DocLink>.
          </Note>
        </>
      ),
    },
    {
      id: "exportar",
      title: "Exportar",
      body: (
        <>
          <p>
            Con <Ui>Exportar</Ui> (o desde <Ui>Más</Ui>) descargas la tabla en <Ui>Excel (.xlsx)</Ui> o{" "}
            <Ui>CSV (.csv)</Ui>. Se exportan todos los registros que coinciden con la búsqueda y los filtros, en el orden
            que tengas, no solo la página que ves.
          </p>
          <ul>
            <li>En Excel, los números, los precios y las fechas son números y fechas de verdad, listos para calcular.</li>
            <li>
              El CSV usa punto y coma y coma decimal, para que Excel en español lo abra bien con doble clic.
            </li>
            <li>Las relaciones se exportan con el nombre del registro enlazado, así que el archivo se puede volver a importar.</li>
          </ul>
        </>
      ),
    },
  ],
};
