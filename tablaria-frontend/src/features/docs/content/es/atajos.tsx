import { DocTable, Kbd } from "../../prose";
import type { DocArticle } from "../../types";

export const atajos: DocArticle = {
  slug: "atajos",
  title: "Atajos de teclado",
  description: "Las teclas que ahorran clics, y cómo usar Tablaria sin ratón.",
  keywords: ["teclado", "atajo", "tecla", "shortcut", "accesibilidad", "ctrl"],
  intro: (
    <p>
      En Mac, usa <Kbd>⌘</Kbd> donde aquí dice <Kbd>Ctrl</Kbd>.
    </p>
  ),
  sections: [
    {
      id: "generales",
      title: "En toda la aplicación",
      body: (
        <DocTable
          caption="Atajos generales"
          head={["Teclas", "Qué hace"]}
          rows={[
            [
              <span key="k">
                <Kbd>Ctrl</Kbd> + <Kbd>K</Kbd>
              </span>,
              "Abre el asistente.",
            ],
            [
              <span key="k">
                <Kbd>Ctrl</Kbd> + <Kbd>B</Kbd>
              </span>,
              "Muestra u oculta la barra lateral.",
            ],
          ]}
        />
      ),
    },
    {
      id: "tabla",
      title: "En la tabla",
      body: (
        <DocTable
          caption="Atajos al editar celdas"
          head={["Teclas", "Qué hace"]}
          rows={[
            [<Kbd key="k">Enter</Kbd>, "Guarda el valor de la celda que editas."],
            [<Kbd key="k">Escape</Kbd>, "Cancela la edición y deja el valor como estaba."],
          ]}
        />
      ),
    },
    {
      id: "asistente",
      title: "En el asistente",
      body: (
        <DocTable
          caption="Atajos del asistente"
          head={["Teclas", "Qué hace"]}
          rows={[
            [<Kbd key="k">Enter</Kbd>, "Envía la pregunta."],
            [
              <span key="k">
                <Kbd>Mayús</Kbd> + <Kbd>Enter</Kbd>
              </span>,
              "Salta de línea sin enviar.",
            ],
          ]}
        />
      ),
    },
    {
      id: "sin-raton",
      title: "Sin ratón",
      body: (
        <p>
          Todo se puede hacer con el teclado: <Kbd>Tab</Kbd> recorre los botones, los campos y las celdas,{" "}
          <Kbd>Enter</Kbd> o <Kbd>Espacio</Kbd> los activa, y <Kbd>Escape</Kbd> cierra los menús y las ventanas. Al
          principio de cada página, el enlace <strong>Saltar al contenido</strong> lleva directo a lo importante.
        </p>
      ),
    },
  ],
};
