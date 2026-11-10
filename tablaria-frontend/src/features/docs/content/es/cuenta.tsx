import { Note, Ui } from "../../prose";
import type { DocArticle } from "../../types";

export const cuenta: DocArticle = {
  slug: "cuenta",
  title: "Cuenta y seguridad",
  description: "Contraseña, sesiones abiertas, tema, descarga de tus datos y cómo borrar la cuenta.",
  keywords: ["contraseña", "sesión", "cerrar sesión", "tema oscuro", "exportar datos", "borrar cuenta", "privacidad", "ajustes"],
  intro: (
    <p>
      Todo esto está en <Ui>Ajustes</Ui>, en el menú de tu cuenta, abajo en la barra lateral.
    </p>
  ),
  sections: [
    {
      id: "contrasena",
      title: "Contraseña",
      body: (
        <>
          <p>
            En <Ui>Contraseña</Ui> escribe la actual y la nueva, de 8 caracteres como mínimo. Al cambiarla se cierra la
            sesión en el resto de dispositivos.
          </p>
          <p>
            Si la has olvidado, en la pantalla de entrada pulsa <Ui>¿Has olvidado tu contraseña?</Ui> y te llegará un
            email para crear otra.
          </p>
        </>
      ),
    },
    {
      id: "sesiones",
      title: "Sesiones",
      body: (
        <p>
          <Ui>Cerrar sesión</Ui> sale en este navegador. <Ui>Cerrar sesión en todos los dispositivos</Ui> sale en todos
          a la vez, por ejemplo si has entrado desde un ordenador ajeno.
        </p>
      ),
    },
    {
      id: "apariencia",
      title: "Apariencia",
      body: (
        <p>
          Elige el tema claro, el oscuro o el del sistema, que sigue la configuración de tu dispositivo. Se guarda en
          cada dispositivo.
        </p>
      ),
    },
    {
      id: "instalar",
      title: "Instalar la app",
      body: (
        <>
          <p>
            Tablaria se puede instalar como una app, con su icono y su propia ventana, para abrirla más rápido y escanear
            códigos en el almacén:
          </p>
          <ul>
            <li>
              <strong>Chrome o Edge</strong> (ordenador o Android): en el menú de tu cuenta, abajo en la barra lateral,
              pulsa <Ui>Instalar la app</Ui>. Si no aparece, ya está instalada o el navegador no lo permite.
            </li>
            <li>
              <strong>iPhone o iPad:</strong> en Safari, pulsa <Ui>Compartir</Ui> y después <Ui>Añadir a pantalla de
              inicio</Ui>.
            </li>
          </ul>
          <p>La app instalada es la misma web: necesita conexión y se actualiza sola.</p>
        </>
      ),
    },
    {
      id: "tus-datos",
      title: "Descargar tus datos",
      body: (
        <p>
          <Ui>Descargar mis datos</Ui> genera un archivo JSON con tu cuenta, tus espacios y las tablas de{" "}
          <Ui>Mi espacio</Ui> con todos sus registros. Para llevar una tabla a Excel, es más cómodo exportarla desde la
          propia tabla.
        </p>
      ),
    },
    {
      id: "borrar-cuenta",
      title: "Borrar la cuenta",
      body: (
        <>
          <p>
            <Ui>Borrar mi cuenta</Ui> borra tu cuenta, <Ui>Mi espacio</Ui> con todas sus tablas y las organizaciones en
            las que eres el único miembro. Te pedirá la contraseña para confirmarlo.
          </p>
          <Note>
            Si eres el único propietario de una organización con más personas, antes tendrás que nombrar a otra persona
            propietaria o borrar la organización.
          </Note>
        </>
      ),
    },
  ],
};
