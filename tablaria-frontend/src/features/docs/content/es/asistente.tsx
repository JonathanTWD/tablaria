import { DocTable, Kbd, Note, Ui } from "../../prose";
import type { DocArticle } from "../../types";

export const asistente: DocArticle = {
  slug: "asistente",
  title: "Asistente de IA",
  description: "Pregunta por tus datos por escrito o con la voz, y comprueba de qué registros sale cada respuesta.",
  keywords: ["ia", "inteligencia artificial", "chat", "preguntar", "voz", "micrófono", "groq", "privacidad"],
  intro: (
    <p>
      El asistente responde preguntas sobre tus tablas: qué está bajo mínimo, cuánto vale el stock o qué proveedor tiene
      más productos. Consulta tus datos en el momento, con tus permisos, y enlaza los registros en los que se basa.
    </p>
  ),
  sections: [
    {
      id: "abrir",
      title: "Abrirlo",
      body: (
        <ul>
          <li>
            Con el botón <Ui>Asistente</Ui>, en cualquier pantalla de la aplicación.
          </li>
          <li>
            Con <Kbd>Ctrl</Kbd> + <Kbd>K</Kbd> (<Kbd>⌘</Kbd> + <Kbd>K</Kbd> en Mac).
          </li>
          <li>
            Desde el menú de una tabla, con <Ui>Preguntar al asistente por esta tabla</Ui>: empezará buscando en ella.
          </li>
        </ul>
      ),
    },
    {
      id: "que-preguntar",
      title: "Qué se le puede preguntar",
      body: (
        <>
          <DocTable
            caption="Ejemplos de preguntas al asistente"
            head={["Para", "Pregunta"]}
            rows={[
              ["Encontrar registros", "¿Dónde están los guantes de nitrilo?"],
              ["Avisos de stock", "¿Qué está bajo mínimo y a qué proveedor lo pido?"],
              ["Totales y medias", "¿Cuánto vale todo el stock por categoría?"],
              ["Historial", "¿Quién ha sacado taladros esta semana?"],
              ["Tus tablas", "¿Qué tablas tengo y cuántos registros hay en cada una?"],
            ]}
          />
          <p>
            Puedes seguir la conversación con otra pregunta («¿y de esos, cuáles son de Bricomarket?»). Cada respuesta
            termina con <Ui>Basado en:</Ui> y enlaces a los registros que ha consultado, para que lo compruebes.
          </p>
          <Note>
            El asistente solo lee: no crea, cambia ni borra nada. Si le pides un cambio, te explicará dónde hacerlo en
            la tabla.
          </Note>
        </>
      ),
    },
    {
      id: "voz",
      title: "Preguntar con la voz",
      body: (
        <p>
          Pulsa <Ui>Preguntar en voz alta</Ui> y habla; la onda muestra que te está escuchando. Activa{" "}
          <Ui>Leer las respuestas en voz alta</Ui> para escucharlas. La voz usa el reconocimiento del navegador: funciona
          en Chrome, Edge y Safari, y en otros navegadores el botón no aparece.
        </p>
      ),
    },
    {
      id: "privacidad",
      title: "Privacidad",
      body: (
        <>
          <p>
            Las respuestas las escribe un modelo de inteligencia artificial de Groq. Para responder, Tablaria le envía tu
            pregunta y los datos que consulta, solo de las tablas a las que tienes acceso. Tablaria no guarda las
            conversaciones: desaparecen al recargar la página.
          </p>
          <p>
            Como cualquier IA, puede equivocarse. Por eso enlaza siempre los registros en los que se basa.
          </p>
        </>
      ),
    },
    {
      id: "limites",
      title: "Límites",
      body: (
        <ul>
          <li>15 preguntas al día por cuenta; en la demo, 5. El asistente te dice cuántas te quedan.</li>
          <li>Cada pregunta puede tener hasta 1.000 caracteres.</li>
          <li>Si el servicio está saturado, te pedirá que lo intentes en un momento. Esa pregunta no cuenta.</li>
        </ul>
      ),
    },
  ],
};
