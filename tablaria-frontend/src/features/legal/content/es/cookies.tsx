import { Link } from "react-router";
import { DocTable } from "@/features/docs/prose";
import type { DocArticle } from "@/features/docs/types";

export const cookies: DocArticle = {
  slug: "cookies",
  title: "Política de cookies",
  description: "Las cookies y el almacenamiento del navegador que usa Tablaria, y por qué no hay banner de cookies.",
  intro: (
    <p>
      Tablaria no usa cookies de publicidad, de análisis ni de terceros. Solo guarda en tu navegador lo imprescindible
      para que la aplicación funcione y recuerde tus preferencias. Por eso no te pide consentimiento con un banner: la
      ley exime a las cookies técnicas.
    </p>
  ),
  sections: [
    {
      id: "cookies",
      title: "Cookies",
      body: (
        <>
          <DocTable
            caption="Cookies que usa Tablaria"
            head={["Nombre", "Para qué", "Duración"]}
            rows={[
              [<code key="n">tb_access</code>, "Mantener tu sesión iniciada.", "15 minutos"],
              [<code key="n">tb_refresh</code>, "Renovar la sesión sin pedirte la contraseña.", "7 días"],
            ]}
          />
          <p>
            Las dos son propias, solo se envían a la API de Tablaria y el código de la página no puede leerlas
            (httpOnly). Al cerrar sesión se borran.
          </p>
        </>
      ),
    },
    {
      id: "almacenamiento",
      title: "Almacenamiento del navegador",
      body: (
        <>
          <p>
            Además, Tablaria guarda algunas preferencias en el almacenamiento local de tu navegador. No salen de tu
            dispositivo:
          </p>
          <DocTable
            caption="Preferencias guardadas en el navegador"
            head={["Clave", "Para qué"]}
            rows={[
              [<code key="n">tablaria-theme</code>, "El tema claro, oscuro o del sistema."],
              [<code key="n">tablaria:space</code>, "El último espacio que abriste."],
              [<code key="n">tablaria:sidebar-open</code>, "Si la barra lateral está abierta o cerrada."],
              [<code key="n">tablaria:after-signup</code>, "A dónde volver después de verificar tu email."],
              [<code key="n">tablaria:assistant-*</code>, "Si ya viste el aviso del asistente y si quieres oír sus respuestas."],
            ]}
          />
        </>
      ),
    },
    {
      id: "gestionar",
      title: "Cómo borrarlas",
      body: (
        <p>
          Puedes borrar las cookies y el almacenamiento local desde la configuración de tu navegador. Si borras las
          cookies, tendrás que volver a iniciar sesión. Más información en la{" "}
          <Link to="/privacidad">política de privacidad</Link>.
        </p>
      ),
    },
  ],
};
