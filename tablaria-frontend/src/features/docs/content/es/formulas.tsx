import { DocTable, Note, Ui } from "../../prose";
import type { DocArticle } from "../../types";

export const formulas: DocArticle = {
  slug: "formulas",
  title: "Fórmulas",
  description: "Calcula columnas a partir de otras: operadores, todas las funciones y ejemplos listos para copiar.",
  keywords: ["calcular", "función", "SI", "REDONDEAR", "HOY", "DIAS", "operador", "expresión"],
  intro: (
    <p>
      Una columna de tipo <Ui>Fórmula</Ui> calcula su valor con otras columnas del mismo registro, como el valor del
      stock (precio × unidades) o un aviso de «Pedir». Se recalcula sola cada vez que cambian sus datos y no se edita a
      mano.
    </p>
  ),
  sections: [
    {
      id: "escribir",
      title: "Cómo se escribe",
      body: (
        <>
          <ul>
            <li>
              Las columnas van entre llaves: <code>{"{Precio}"}</code>. Con <Ui>Insertar columna</Ui> las añades sin
              escribir el nombre.
            </li>
            <li>
              Los textos van entre comillas: <code>"Pedir"</code>.
            </li>
            <li>
              Los datos de una función se separan con punto y coma: <code>{"REDONDEAR({Precio}; 2)"}</code>. Los
              decimales llevan coma: <code>1,21</code>.
            </li>
            <li>
              <code>VERDADERO</code> y <code>FALSO</code> son los valores de sí y no.
            </li>
          </ul>
          <p>
            Debajo de la fórmula verás de qué tipo es el resultado: número, texto, sí / no o fecha. Si es un número,
            puedes elegir <Ui>Mostrar como precio</Ui>.
          </p>
        </>
      ),
    },
    {
      id: "operadores",
      title: "Operadores",
      body: (
        <DocTable
          caption="Operadores de las fórmulas"
          head={["Operador", "Qué hace", "Ejemplo"]}
          rows={[
            [<code key="o">+ - * /</code>, "Sumar, restar, multiplicar y dividir.", <code key="e">{"{Precio} * {Stock}"}</code>],
            [<code key="o">&</code>, "Unir textos.", <code key="e">{'{Marca} & " " & {Modelo}'}</code>],
            [<code key="o">{"= <>"}</code>, "Igual y distinto.", <code key="e">{'{Estado} = "Agotado"'}</code>],
            [<code key="o">{"< > <= >="}</code>, "Comparar números, textos o fechas.", <code key="e">{"{Stock} < 5"}</code>],
          ]}
        />
      ),
    },
    {
      id: "funciones",
      title: "Funciones",
      body: (
        <>
          <DocTable
            caption="Funciones de las fórmulas"
            head={["Función", "Qué hace"]}
            rows={[
              [<code key="f">SI(condición; si sí; si no)</code>, "Elige un valor según la condición. El tercer dato es opcional."],
              [<code key="f">Y(a; b; …)</code>, "Verdadero si se cumplen todas las condiciones."],
              [<code key="f">O(a; b; …)</code>, "Verdadero si se cumple alguna."],
              [<code key="f">NO(a)</code>, "Lo contrario de la condición."],
              [<code key="f">ESVACIO(valor)</code>, "Verdadero si la celda está vacía."],
              [<code key="f">REDONDEAR(número; decimales)</code>, "Redondea. Sin decimales, a un número entero."],
              [<code key="f">ABS(número)</code>, "El número sin signo."],
              [<code key="f">MIN(a; b; …)</code>, "El menor de los valores."],
              [<code key="f">MAX(a; b; …)</code>, "El mayor de los valores."],
              [<code key="f">MAYUSC(texto)</code>, "El texto en mayúsculas."],
              [<code key="f">MINUSC(texto)</code>, "El texto en minúsculas."],
              [<code key="f">LARGO(texto)</code>, "Cuántos caracteres tiene."],
              [<code key="f">HOY()</code>, "La fecha de hoy."],
              [<code key="f">DIAS(fin; inicio)</code>, "Días que hay entre dos fechas."],
            ]}
          />
          <p>Los nombres en inglés (IF, AND, ROUND, TODAY, DAYS…) también funcionan.</p>
        </>
      ),
    },
    {
      id: "ejemplos",
      title: "Ejemplos",
      body: (
        <DocTable
          caption="Ejemplos de fórmulas"
          head={["Para", "Fórmula"]}
          rows={[
            ["Valor del stock", <code key="f">{"{Precio} * {Stock}"}</code>],
            ["Precio con IVA", <code key="f">{"REDONDEAR({Precio} * 1,21; 2)"}</code>],
            ["Aviso de reposición", <code key="f">{'SI({Stock} < {Mínimo}; "Pedir"; "OK")'}</code>],
            ["Días desde la última revisión", <code key="f">{"DIAS(HOY(); {Última revisión})"}</code>],
            ["Revisión pendiente", <code key="f">{"DIAS(HOY(); {Última revisión}) > 180"}</code>],
            ["Nombre completo", <code key="f">{'{Marca} & " " & {Modelo}'}</code>],
            ["Falta la ubicación", <code key="f">{"ESVACIO({Ubicación})"}</code>],
          ]}
        />
      ),
    },
    {
      id: "errores",
      title: "Errores y límites",
      body: (
        <>
          <p>
            Si la fórmula no es válida, el formulario dice qué falla: una columna que no existe, una función mal escrita,
            un paréntesis sin cerrar o tipos que no encajan, como sumar un texto.
          </p>
          <ul>
            <li>Dividir entre cero, o calcular con una celda vacía, da una celda vacía en lugar de un error.</li>
            <li>
              Se pueden citar columnas de texto, número, precio, fecha, sí / no, lista de opciones, consultas y
              resúmenes. Las relaciones y otras fórmulas no: para usar un dato del registro enlazado, crea antes una
              consulta.
            </li>
            <li>Todavía no se puede buscar, filtrar, ordenar ni agrupar por una fórmula.</li>
          </ul>
          <Note>Las fórmulas tienen hasta 1.000 caracteres.</Note>
        </>
      ),
    },
  ],
};
