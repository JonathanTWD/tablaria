# Decisiones de arquitectura

Registro breve de decisiones (formato ADR). Cada entrada indica contexto, decisión y consecuencias.

## ADR-001: pnpm workspace con paquete `shared`

- **Contexto**: frontend y backend deben compartir los tipos de la API, los esquemas de validación y los tipos de columna sin duplicarlos.
- **Decisión**: pnpm workspace en la raíz (`tablaria-frontend`, `tablaria-backend`, `packages/*`) con un único lockfile. `@tablaria/shared` se compila con `tsc` dos veces: a ESM (para Vite) y a CommonJS (para Nest y Jest), expuestos mediante `exports` condicionales.
- **Consecuencias**: `shared` debe compilarse antes que los demás paquetes (los scripts de la raíz lo hacen). Evitamos un bundler extra. Los imports relativos dentro de `shared` llevan extensión `.js`.

## ADR-002: TypeScript 6 en todo el repositorio

- **Contexto**: el frontend ya usaba TypeScript 6 y el backend TypeScript 5.7.
- **Decisión**: alinear todos los paquetes en `~6.0`. Se elimina `baseUrl` (obsoleto) y se declaran `rootDir` y `types` explícitamente, porque TypeScript 6 ya no los infiere.
- **Consecuencias**: un único comportamiento del compilador. Algunas herramientas (p. ej. `ts-jest`) pueden ir por detrás en soporte oficial; se verifica en CI.

## ADR-003: `cn` estándar con clsx + tailwind-merge

- **Contexto**: se usaba el paquete npm `cn`, que no resuelve conflictos entre clases de Tailwind.
- **Decisión**: usar la utilidad estándar de shadcn (`clsx` + `tailwind-merge`) en `src/lib/utils.ts`.
- **Consecuencias**: los componentes de shadcn se comportan como espera su documentación. El registro `base-nova` vuelve a importar `cn` desde el paquete `cn` (y a añadir `next-themes`) en cada `shadcn add`: después de añadir componentes hay que cambiar el import a `@/lib/utils` y quitar esas dependencias.

## ADR-004: Docker Compose solo para servicios en desarrollo

- **Contexto**: el prompt del MVP proponía front y back con hot reload dentro de Docker. En Windows, los bind mounts son lentos para el watch mode y los `node_modules` nativos chocan entre host y contenedor.
- **Decisión**: `docker-compose.yml` levanta solo PostgreSQL 16 y Mailpit; las apps corren en el host con `pnpm dev`. Postgres se expone en el puerto **5433** para no chocar con instalaciones locales. Los Dockerfiles multi-stage y el compose de producción llegan en la fase 6.
- **Consecuencias**: arranque y recarga rápidos. Hay que tener Node y pnpm instalados en el host.

## ADR-005: Prisma 7 con driver adapter y cliente generado en `src/`

- **Contexto**: Prisma 7 elimina el motor binario y requiere un driver adapter; el generador `prisma-client` escribe el cliente como código TypeScript del proyecto.
- **Decisión**: `@prisma/adapter-pg`, generador `prisma-client` con `moduleFormat = "cjs"` en `src/generated/prisma` (ignorado por Git y regenerado en `postinstall` y `build`). La URL de la base de datos se define en `prisma.config.ts`. Versiones fijadas sin `^` porque el cliente, el adapter y el CLI deben coincidir.
- **Consecuencias**: el cliente carga su compilador de consultas WASM con `import()` dinámico, así que todos los tests de Jest se ejecutan con `--experimental-vm-modules`. `prisma.config.ts` lee `DATABASE_URL` sin el helper `env()` para que `prisma generate` funcione sin base de datos (CI, builds de Docker). Un test unitario comprueba que el enum `ColumnType` de Prisma coincide con `COLUMN_TYPES` de `shared`.

## ADR-006: Formato único de error y filtro global

- **Contexto**: AGENTS.md exige errores consistentes y no exponer stack traces ni errores SQL.
- **Decisión**: un `AllExceptionsFilter` global convierte todo a `ApiErrorBody` (`statusCode`, `error`, `message`, `details?`), tipo definido en `@tablaria/shared`. Los errores de Prisma P2002 pasan a 409 y P2025 a 404; cualquier otro error pasa a un 500 genérico y se registra en el log.
- **Consecuencias**: el frontend puede tratar todos los errores con un único tipo. Los errores de validación del `ZodValidationPipe` llegan como 400 con `details` por campo.

## ADR-007: Configuración validada con zod y seguridad HTTP base

- **Decisión**: `@nestjs/config` (línea 4.x, CommonJS, compatible con Nest 11; la 12 es solo ESM y está pensada para Nest 12) con `validate` basado en un esquema zod. La app no arranca si falta o es inválida alguna variable. `helmet`, CORS con lista blanca (`CORS_ORIGINS`) y `credentials: true`, prefijo global `/api` y `@nestjs/throttler` global (100 peticiones/min; los límites estrictos de auth llegan en la fase 2). `/api/health` comprueba la base de datos y no está sujeto a throttling. `TRUST_PROXY_HOPS` configura `trust proxy` de Express para que el rate limiter use la IP real del cliente detrás del rewrite de producción; en local es 0.
- **Consecuencias**: la configuración HTTP vive en `configureApp()` (`src/app.setup.ts`) y la comparten `main.ts` y los tests e2e.

## ADR-008: Autenticación con cookies httpOnly y refresh tokens rotatorios

- **Contexto**: la autenticación es la parte más sensible del MVP y la sesión debe sobrevivir a XSS en el frontend.
- **Decisión**:
  - **Access token**: JWT HS256 de 15 min en la cookie `tb_access` (path `/api`).
  - **Refresh token**: token opaco aleatorio de 256 bits en la cookie `tb_refresh` (path `/api/auth`, 7 días). Solo se guarda su hash SHA-256.
  - **Rotación**: cada refresh rota el token y lo encadena en una familia por login. Reutilizar un token ya rotado revoca toda la familia (detección de robo). El "reclamo" de un token es una actualización condicional, así que dos peticiones concurrentes no pueden usarlo dos veces.
  - **Cookies**: `httpOnly`, `SameSite=Lax` y `Secure` en producción. Con una API solo JSON, SameSite=Lax cubre CSRF.
  - **Tokens de email**: verificación (24 h) y reseteo (1 h) son de un solo uso, solo se guarda su hash y emitir uno nuevo invalida los anteriores.
  - **Guard global**: `JwtAuthGuard` es global; las rutas públicas se marcan con `@Public()`, así una ruta nueva nace protegida.
- **Anti-enumeración**:
  - `register`, `resend-verification` y `forgot-password` responden siempre igual (202 y el mismo mensaje).
  - Si el email ya existe, el dueño recibe un correo ("ya tienes una cuenta" o una nueva verificación).
  - El login con email desconocido verifica contra un hash ficticio para igualar tiempos.
  - "Email no verificado" (403) solo se revela tras una contraseña correcta.
- **Verificación de email**:
  - `verify-email` recibe el token y la contraseña: quien controla el buzón fija la contraseña definitiva, así que una cuenta registrada antes por otra persona no se puede pre-secuestrar, sea cual sea el orden de los registros.
  - Al verificar se inicia sesión directamente.
  - Volver a registrar un email no verificado solo reenvía el enlace.
- **Varias pestañas**: si un refresh token se rotó hace menos de 30 s, reutilizarlo devuelve 409 sin tokens nuevos y no revoca la familia: es otra pestaña que refrescó a la vez y el navegador ya tiene las cookies nuevas, que esa respuesta tampoco borra. La rotación marca al sucesor de forma atómica, lo que distingue este caso de un logout o reseteo.
- **Correo**: los fallos de envío en `register`, `resend-verification` y `forgot-password` se registran en el log sin alterar la respuesta genérica; el usuario puede pedir el correo de nuevo.
- **Contraseñas**: argon2id con los parámetros mínimos de OWASP (19 MiB, t=2, p=1) mediante `@node-rs/argon2`. El paquete `argon2` (node-gyp) provoca un segfault al cargarse en Windows con Node 22. Al resetear la contraseña se cierran todas las sesiones y se marca el email como verificado, en una sola transacción.
- **Rate limiting**: 5 peticiones/min por IP en los endpoints que comprueban credenciales o envían correos, y 30/min en `refresh`.
- **Versiones**: `@nestjs/jwt` 11 y `nodemailer` 9, porque las mayores siguientes solo se distribuyen como ESM.

- **Gestión de la cuenta** (añadido en la v1.5):
  - `POST /account/password` pide la contraseña actual, revoca todos los refresh tokens y da una sesión nueva a este navegador;
  - `POST /account/logout-everywhere` revoca todos los refresh tokens;
  - en ambos casos, los access tokens ya emitidos siguen valiendo hasta que caducan (15 minutos), porque no se consultan en la base de datos en cada petición. Las conexiones de tiempo real del usuario se cierran al momento;
  - `POST /account/delete` (con la contraseña en el cuerpo) borra la cuenta, «Mi espacio», las organizaciones donde el usuario es el único miembro y las invitaciones enviadas a su email: así nada guarda su dirección. Las copias de Neon la conservan hasta que caduca su periodo de retención. Responde 409 con la lista de organizaciones si es el único propietario de alguna con más miembros, para no dejarlas sin dueño. Bloquea cada organización mientras decide;
  - `GET /account/export` devuelve los datos de la cuenta y las tablas de «Mi espacio» con los registros por nombre de columna (RGPD, portabilidad);
  - una contraseña incorrecta responde 422, no 401: la sesión es válida y el cliente no debe intentar refrescarla. Las cuentas demo reciben 403.

## ADR-009: Base de datos aislada para los tests e2e

- **Decisión**:
  - **Base propia**: los e2e usan `TEST_DATABASE_URL`. El setup se niega a arrancar si el nombre de la base no termina en `_test`, la crea y la migra con `prisma migrate deploy`, y la vacía (`TRUNCATE users CASCADE`) antes de cada test.
  - **Ejecución en serie**: los tests corren en un solo worker.
  - **Rate limiting**: cada cliente de test usa su propia IP vía `X-Forwarded-For` (`TRUST_PROXY_HOPS=1`), así los límites no se mezclan entre tests y se prueba la configuración de proxy.
- **Consecuencias**: ejecutar los e2e nunca toca los datos de desarrollo.

## ADR-010: Arquitectura del frontend

- **Rutas**:
  - React Router en modo declarativo, con páginas cargadas en diferido (la landing con WebGL no entra en el bundle de la app).
  - Layouts anidados (`AuthLayout` y `AppLayout`) y guards `RequireAuth` / `GuestOnly`, que son solo UX: la API autoriza.
  - La redirección tras el login solo acepta rutas internas (`safeRedirect`).
- **Estado del servidor**:
  - TanStack Query. La sesión es la query `["auth", "session"]` (usuario o `null`).
  - Al cambiar o cerrar la sesión se eliminan las demás queries, sin borrar la de sesión, a la que siguen suscritos los guards.
  - Un 401 que sobrevive al refresh automático marca la sesión como cerrada.
- **Cliente API**:
  - Siempre rutas relativas `/api`.
  - Ante un 401 hace un único refresh compartido por todas las peticiones concurrentes, y trata el 409 ("otra pestaña ya renovó") como éxito.
  - Los endpoints públicos de auth no disparan el refresh (`skipRefresh`).
- **Formularios**:
  - react-hook-form con los esquemas zod de `@tablaria/shared` y validación al salir del campo (`onTouched`).
  - Mensajes propios por campo en español; zod usa su locale `es` como respaldo.
- **i18n**: react-i18next con un JSON por namespace (`common`, `landing`, `auth`, `app`, `tables`, `records`) y claves tipadas. Para añadir inglés basta con una carpeta `en` con los mismos archivos.
- **Tema**:
  - `ThemeProvider` propio (claro, oscuro o sistema) guardado en `localStorage`, con un script inline en `index.html` que evita el parpadeo.
  - Sin `next-themes`.
  - Paleta: tinta marina, papel frío e índigo de marca, verificada para WCAG AA (bordes de inputs a 3:1).
- **Diseño**:
  - App limpia tipo SaaS. El panel de auth muestra `InventoryPreview`, una tabla de inventario estática y accesible.
  - **Landing (rediseño)**: el protagonista es el producto. El hero incluye `DemoInventoryTable`, una tabla de inventario que funciona sin cuenta (TanStack Table en cliente: búsqueda, filtro por categoría, orden y edición del stock, con teclado y anuncios accesibles).
  - La misma tabla se reutiliza en "Casos de uso" con cuatro inventarios definidos en `landing.json`, cada uno con columnas de tipos distintos. Será la base de la tabla real de la fase 5.
  - Se eliminó Lightfall (`ogl`): era un efecto genérico que no decía nada del producto. La landing usa la paleta de la app, con modo oscuro y una cuadrícula de hoja de cálculo muy tenue como único recurso decorativo.
- **Logout**: lleva a `/login`. Navegar a la landing antes de vaciar la sesión no es fiable, porque React Router aplica la navegación como transición y el guard redirige antes.

## ADR-011: Tablas y columnas

- **Definición de columnas en un solo sitio**: `@tablaria/shared` define, para cada tipo, el esquema de su valor y de sus ajustes (`options`), y un `columnDefinitionSchema` con unión discriminada por `type`. La API y el formulario validan con el mismo esquema.
- **Propiedad**:
  - Todas las consultas filtran por `ownerId`, así que la tabla de otro usuario responde 404, igual que una que no existe.
  - Los cambios de columnas empiezan con un `UPDATE` de la tabla filtrado por dueño (`touchOwnedTable`). Ese update comprueba la propiedad, marca la tabla como editada y bloquea su fila hasta el final de la transacción, de modo que dos cambios de columnas de la misma tabla nunca se intercalan. En la fase 5, las escrituras de registros pasarán por el mismo paso: así actualizan la última edición y no se cruzan con una conversión de tipo.
- **Cambio de tipo**:
  - Dentro de la transacción se leen los valores de esa columna, se convierten en TypeScript (`convertCellValue`, con tests unitarios) y se escriben con un único `UPDATE … FROM jsonb_each($1)` parametrizado.
  - Lo que no se puede convertir se borra de `data` y la respuesta devuelve `clearedValues`.
  - Al cambiar de tipo, `options` y `defaultValue` se reinician salvo que se envíen.
- **Opciones de `select`**:
  - Las celdas guardan la etiqueta, que es lo que se busca y se filtra.
  - Cada opción tiene un `id` estable, así que renombrarla actualiza los registros y quitarla vacía sus celdas.
- **Valor por defecto**: al crear una columna con valor por defecto, ese valor se rellena en los registros existentes. `required` se aplicará al escribir registros (fase 5); marcar una columna como obligatoria no toca los datos que ya hay.
- **Límites**: 100 tablas por usuario y 50 columnas por tabla (422 al superarlos), para acotar el tamaño de los datos y de las consultas.
- **Borrado**: definitivo y en cascada. En la UI, borrar una tabla exige escribir su nombre y borrar una columna pide confirmación.
- **Dashboard**: no hay endpoint `/dashboard/summary`. `GET /tables` devuelve todas las tablas del usuario (como mucho 100) con número de columnas y registros, ordenadas por última edición. El dashboard y el sidebar comparten esa query: las métricas y las recientes se calculan a partir de ella.
- **Plantillas**: tres plantillas en `shared` (inventario básico, catálogo, equipos y activos). Los nombres de sus columnas están en español porque pasan a ser datos del usuario; el nombre y la descripción de cada plantilla se traducen en la UI.

## ADR-012: Registros y consultas sobre JSONB

- **Validación**: `recordDataSchema(columns)` en `@tablaria/shared` valida los datos de un registro contra las columnas de su tabla. Rechaza ids de columna desconocidos, valores que no encajan con el tipo y opciones que no existen, y exige las columnas obligatorias. Al crear, lo que falta toma el valor por defecto; al editar, solo se validan las celdas enviadas, y `null` vacía la celda. Las celdas vacías no se guardan: la clave desaparece de `data`.
- **Escrituras**: crear, editar y borrar empiezan con `touchOwnedTable`. Eso comprueba la propiedad, actualiza la última edición de la tabla y bloquea su fila, así que una escritura nunca se cruza con una conversión de tipo de columna.
- **Listado** (`GET /tables/:tableId/records`):
  - Paginación con `page` y `pageSize` (como mucho 100), y respuesta `{ data, meta }`.
  - `search` busca con `ILIKE` en las columnas de texto y de opciones. Los comodines `%` y `_` se escapan.
  - `sort` y `order` ordenan por el valor convertido a su tipo (`::numeric`, `::date`, `::boolean`; el texto con `lower`), con las celdas vacías al final. Sin `sort`, el orden es el de creación.
  - `filters` es un array JSON con un operador por tipo, definido en `FILTER_OPERATOR_BY_TYPE`: `contains` para texto, `between` para número, precio y fecha, `is` para sí/no, e `in` para opciones.
- **SQL seguro**: la consulta se compone con `Prisma.sql` y `Prisma.join`. Todos los valores, ids de columna incluidos, van como parámetros. Solo se usan ids que existen en la tabla (cualquier otro responde 400), y la dirección del orden sale de una lista cerrada. `record-query.spec.ts` comprueba que la entrada del usuario nunca aparece en el texto SQL.
- **Límite**: 10.000 registros por tabla (422).
- **Frontend**:
  - La vista (página, tamaño, búsqueda, orden y filtros) vive en la URL (`useRecordsView`), con valores por defecto si algo viene mal formado.
  - TanStack Table en modo manual: solo lleva el estado del orden; los datos ya llegan paginados, filtrados y ordenados.
  - Edición en la celda con un editor por tipo:
    - Texto, número, precio y fecha se abren con clic o Enter. Enter o salir de la celda guarda, y Escape cancela.
    - Sí/No y las opciones guardan al cambiar.
    - La actualización es optimista y vuelve atrás si la API la rechaza.
  - Para crear o editar un registro entero hay un diálogo validado con el mismo esquema que usa la API.
- **Pestañas**: la página de una tabla tiene dos rutas anidadas, `/app/tables/:id` (registros) y `/app/tables/:id/columns` (columnas), que comparten la cabecera.

## ADR-013: Despliegue y modo demo

- **Plataforma**:
  - **Web:** Render Static Site. Reescribe `/api/*` hacia la API, así que todo queda en el mismo origen y las cookies funcionan sin tocar CORS.
  - **API:** Render Web Service con el Dockerfile.
  - **Base de datos:** Neon. La PostgreSQL gratuita de Render caduca.
  - **Correo:** Resend, desde un subdominio de correo verificado (`mail.<dominio>`).
  - **Dominio:** `tablaria.es`, en Hostalia, con el correo de Resend en `mail.tablaria.es`. Ver ADR-027.
  - **Lo que hay que configurar a mano en Render:** las cabeceras de seguridad (CSP incluida) en el panel del Static Site y `TRUST_PROXY_HOPS` en la API.
- **Migraciones al arrancar**:
  - El plan gratuito de Render no tiene paso previo al despliegue. Por eso el contenedor ejecuta `prisma migrate deploy` antes de `node dist/main`, y la CLI de Prisma pasa a ser dependencia de producción.
  - Sin migraciones pendientes, este paso no hace nada.
  - Con una sola instancia no hay carreras. Con varias, habría que volver a un paso de migración aparte.
- **Modo demo** (`POST /api/auth/demo`, activado salvo `DEMO_ENABLED=false`):
  - **Cuenta:** cada visitante recibe su propia cuenta, ya verificada y con un email `@demo.invalid`. Es un dominio reservado, así que nunca coincide con un buzón real y no se envían correos a esa dirección.
  - **Datos de ejemplo:** tres tablas creadas desde las plantillas y validadas con las mismas reglas que la API.
  - **Caducidad:** a las 24 h (`demoExpiresAt`) la cuenta se borra en cascada con todos sus datos. La limpieza se hace al crear la siguiente demo, sin cron, que en un servidor que se duerme no serviría.
  - **Límites:** 300 cuentas demo activas a la vez (503 si se supera) y 3 demos por minuto por IP.
- **Servidor dormido**: si la carga inicial o "Probar la demo" tardan más de 3 s, la interfaz explica que el servidor está despertando, en lugar de mostrar solo un spinner.
- **Vista previa al compartir**: metaetiquetas Open Graph y de X/Twitter en `index.html` (los rastreadores no ejecutan JavaScript), con una imagen de 1200×630 generada desde `tablaria-frontend/og/og-image.html`. El favicon pasa a ser el icono de Tablaria.
- **Diagnóstico del proxy**: cada petición bloqueada por el límite de peticiones deja en el log la IP con la que se contó. Si no coincide con la IP pública del cliente, `TRUST_PROXY_HOPS` no está bien ajustado.

## ADR-014: Exportación de registros

- **En el servidor**: `GET /tables/:tableId/records/export` reutiliza la consulta parametrizada del listado (búsqueda, filtros y orden, con la misma lista blanca de columnas), pero sin paginar. Así se exportan todos los registros que coinciden, hasta el máximo de 10.000 por tabla, no solo la página visible. Tiene un límite propio de 10 exportaciones por minuto.
- **CSV para Excel en español**: separador `;` y coma decimal, porque es lo que Excel espera en España y en la mayoría de locales europeos al abrir un CSV con doble clic. Las comillas siguen RFC 4180, con CRLF y BOM UTF-8 para que se vean bien los acentos y el €. Las columnas de precio llevan la moneda en la cabecera («Precio (EUR)»), los booleanos van como Sí/No y las fechas en ISO.
- **Inyección de fórmulas**: cualquier celda o nombre de columna que empiece por `=`, `+`, `-`, `@`, tabulador o retorno lleva delante un `'`, así la hoja de cálculo lo muestra como texto. Los números negativos no se tocan, porque se escriben como números.
- **Descarga en el cliente**: `apiDownload` usa el mismo flujo que el resto de peticiones (renovación de la sesión ante un 401) y guarda el archivo con el nombre que sugiere la API, que es un nombre ASCII derivado de la tabla y la fecha.
- **Excel pendiente**: ExcelJS no se puede añadir hasta que las versiones que Dependabot fijó en el lockfile cumplan la antigüedad mínima de 14 días de pnpm (`minimumReleaseAge`). Para que no vuelva a pasar, Dependabot usa ahora un `cooldown` de 14 días, y `@rolldown/*` tiene una excepción porque publica builds nativos con mucha frecuencia.

## ADR-015: Alertas de stock bajo

- **Umbral en la columna**: el umbral vive en `options.alertBelow` de las columnas numéricas (nulo si no avisa), dentro del mismo esquema zod compartido. No hace falta migración, porque las opciones ya se guardan como JSON, y lo valida la API como cualquier otra opción. No se aplica a precios: un precio bajo no es una alerta.
- **Una sola regla**: `stockLevel()` en `@tablaria/shared` decide si un valor está bien, bajo (por debajo del umbral) o agotado (0 o menos). La tabla lo usa para marcar las celdas y la API aplica la misma comparación en SQL.
- **Endpoint agregado**: `GET /stock-alerts` resuelve todo en una sola consulta parametrizada: une las tablas del usuario con sus columnas numéricas con umbral y con sus registros, y compara cada valor con el umbral guardado en la propia columna (los ids de columna salen de la base de datos, nunca de la petición). Un `CASE` evita convertir a número celdas que no lo son. Devuelve los 8 más urgentes y el total, así el panel no carga todas las tablas.
- **Panel sin saltos**: el inicio espera a las tablas y a los avisos antes de pintarse, para que la tarjeta no empuje la lista de tablas cuando ya se ve.
- **Sin notificaciones**: los avisos se ven al abrir el panel. Emails o notificaciones push quedan fuera del MVP.

## ADR-016: Gráficos del panel

- **Agregación en el servidor**: `GET /tables/:tableId/records/stats?groupBy=&sum=` agrupa en PostgreSQL (`GROUP BY data -> columna`) y devuelve recuento y suma por grupo. El navegador no descarga los registros. Las columnas se validan contra las de la propia tabla: solo se agrupa por listas, Sí / No y texto, y solo se suman números y precios. Se devuelven los 8 grupos mayores y el resto sumado como «otros». El mismo endpoint servirá a la futura consulta con IA.
- **SVG propio, sin librería**: para barras horizontales basta un `<rect>` proporcional al valor. Una librería como Recharts añadiría unos 100 KB comprimidos y otra dependencia que mantener. El gráfico se dibuja como una tabla HTML (`caption`, cabeceras y filas) con las barras decorativas (`aria-hidden`), así los lectores de pantalla leen los datos tal cual. Si en el futuro hacen falta series temporales, tooltips o varios tipos de gráfico, se adoptarán los charts de shadcn/ui (Recharts).
- **Sin agrupar por la primera columna**: suele nombrar cada registro (producto, equipo), así que cada grupo tendría un único registro. Por defecto se agrupa por la primera lista de opciones, si no por Sí / No y, si no, por texto.

## ADR-017: Ancho de las páginas según su contenido

- **Sin límite global**: el `<main>` de la app ya no tiene `max-w-5xl`. Con un tope de 1024 px alineado a la izquierda, a 1707 px quedaba vacío el 26 % de la pantalla, y a 2560 px el 51 %, mientras la tabla seguía haciendo scroll horizontal.
- **Cada página elige su ancho**:
  - las páginas de datos (la tabla de registros) usan todo el ancho, como recomiendan Polaris y Fiori para listados con muchas columnas;
  - el inicio se centra hasta 1600 px;
  - los formularios y ajustes se quedan en un ancho de lectura (`max-w-4xl`).
- **Consultas de contenedor**: el inicio y el gráfico se adaptan al ancho de su propio contenedor (`@container`), no al de la ventana, porque la barra lateral y la columna lateral cambian el espacio disponible.
- **Landing fluida**: tres tokens en `@theme`:
  - `--container-landing`: `clamp(80rem, 72vw, 112rem)`;
  - `--text-landing-hero` y `--text-landing-title`: `clamp()` con tope.

  Hasta unos 1780 px la landing no cambia; a partir de ahí, el contenedor y los títulos crecen en proporción, mientras los párrafos conservan su ancho máximo de lectura.
- **Orden de lectura**: en pantallas anchas, «Bajo mínimo» y el gráfico pasan a una columna lateral colocada con grid. El orden del DOM (avisos, tablas, gráfico) no cambia, así que el foco y los lectores de pantalla siguen el mismo orden en todos los tamaños.

## ADR-018: Barra lateral plegable

- **Componente `Sidebar` de shadcn (Base UI)**, en modo `icon`: plegada, deja una tira de 3rem con iconos y tooltips en lugar de desaparecer. Así navegar sigue costando un clic.
- **Tablas agrupadas en un menú**: con la barra plegada, todas las tablas tendrían el mismo icono, así que se juntan en un solo botón «Tablas» que abre un menú con la lista.
- **Estado en `localStorage`** (`tablaria:sidebar-open`) en lugar de la cookie `sidebar_state` del componente original. Es una app de navegador sin renderizado en servidor, y la cookie solo viajaría a la API en cada petición.
- **Instalación manual**: `shadcn add sidebar` intentaba volver a resolver dependencias y chocaba con la antigüedad mínima de pnpm. Por eso `sidebar.tsx` se copió del registro, cambiando solo:
  - las rutas de importación;
  - la cookie, que se quita;
  - los textos para lectores de pantalla, que ahora llegan traducidos desde la app;
  - `useIsMobile`, que se reescribe con `useSyncExternalStore`.

  Las demás dependencias del componente (`Sheet`, `Tooltip`, `Button`…) ya estaban en el proyecto.
- **Atajo `Ctrl/⌘ + B`**: es el del componente. En Firefox ese atajo abre la barra de marcadores, y dentro de la app queda bloqueado. Como lleva tecla modificadora, no choca con WCAG 2.1.4.

## ADR-019: Compartir tablas y organizaciones

**Contexto**: hoy cada tabla tiene un `ownerId`, y unas 40 consultas en 6 servicios comprueban la propiedad. Tablaria tiene que servir tanto a particulares, que comparten alguna tabla suelta, como a equipos, que trabajan con todas.

**Decisión**:
- **Dos formas de dar acceso**:
  - **compartir una tabla** con personas concretas, como lector o editor;
  - **organizaciones**, con miembros y roles (`OWNER`, `ADMIN`, `EDITOR` o `VIEWER`) que ven todas sus tablas.
- **Espacio personal**: cada usuario tiene una organización `personal`, que se crea al registrarse y no admite miembros. Las tablas de ese espacio se comparten tabla a tabla. La migración crea una por usuario y mueve allí sus tablas.
- **Modelo**:
  - `organizations`: `id`, `name` y `personal`;
  - `memberships`: organización, usuario y rol;
  - `table_shares`: tabla, usuario y rol (`VIEWER` o `EDITOR`);
  - `invitations`: el destino (una tabla o una organización), email, rol, hash del token, caducidad, quién invita y cuándo se aceptó;
  - `inventory_tables.ownerId` se sustituye por `organizationId`, más `createdById` para saber quién la creó.
- **Una sola puerta de acceso**:
  - el rol de un usuario en una tabla es el mayor entre su rol en la organización de la tabla y el que le dieron al compartirla;
  - un único servicio lo resuelve y exige un rol mínimo;
  - a quien no tiene acceso se le responde 404, igual que si la tabla no existiera; a quien tiene acceso sin permiso suficiente, 403;
  - ningún servicio vuelve a filtrar por `ownerId` por su cuenta.
- **Permisos**:
  - `VIEWER` lee y exporta;
  - `EDITOR` además crea, edita y borra registros;
  - `ADMIN` (o el dueño en su espacio personal) además gestiona la tabla, sus columnas, los permisos compartidos y los miembros;
  - `OWNER` además puede borrar la organización.

  Compartir una tabla da como mucho rol de editor, y siempre queda al menos un `OWNER`.
- **Invitaciones**, el mismo flujo para tablas y organizaciones:
  - el token es aleatorio y en base de datos solo se guarda su hash; caduca a los 7 días y es de un solo uso;
  - solo puede aceptarla la cuenta cuyo email coincide con el invitado;
  - las respuestas no revelan si un email tiene cuenta;
  - límites: 25 personas por tabla compartida o por organización, 20 invitaciones pendientes por destino y 10 organizaciones por usuario.
- **Rutas**:
  - las de tablas, registros y columnas siguen siendo `/tables/:id/...`;
  - las tablas compartidas conmigo se listan en `/tables/shared`;
  - el listado y la creación de tablas de una organización van en `/organizations/:orgId/tables`;
  - los permisos compartidos van bajo `/tables/:id/shares`, y los miembros bajo `/organizations/:orgId/members`.
- **Antiabuso** (añadido en la parte 2):
  - las cuentas demo no pueden invitar, porque la demo es pública y no debe servir para enviar emails a terceros;
  - cada dirección recibe como mucho 5 invitaciones por hora, y cada usuario envía como mucho 30. Cuentan también las reenviadas y las revocadas, que se marcan en lugar de borrarse;
  - el nombre de la tabla y el remitente se escapan en el HTML del email;
  - el token viaja en el cuerpo de `POST /invitations/preview` y `POST /invitations/accept`, nunca en una URL que pueda quedar en los logs.
- **Organizaciones** (añadido en la parte 3):
  - cualquiera crea organizaciones y queda como `OWNER`; el espacio personal no se renombra, no se borra ni admite invitaciones;
  - `ADMIN` invita, cambia roles, quita miembros y crea tablas; solo un `OWNER` da, cambia o quita la propiedad, y quitar o rebajar al último `OWNER` responde 409;
  - cualquier miembro puede salir. Los cambios de miembros bloquean la fila de la organización, así que dos propietarios no pueden irse a la vez y dejarla sin dueño;
  - a una organización se invita como lector, editor o administrador; los propietarios salen de promocionar a un miembro;
  - aceptar una invitación nunca rebaja el rol que ya se tiene;
  - el límite de tablas pasa a ser de 100 por espacio, el personal o cada organización.
- **Espacio activo en la interfaz** (añadido en la parte 4):
  - un selector en la barra lateral elige qué espacio muestran la barra y el inicio;
  - la elección se guarda en el navegador, como el estado de la barra lateral, y no en la URL: así sobrevive a la navegación entre tablas;
  - si el espacio guardado ya no existe para el usuario, se vuelve al personal;
  - abrir una tabla de otra organización a la que perteneces cambia a ese espacio;
  - las tablas compartidas contigo siguen fuera de los espacios, en «Compartidas conmigo»;
  - el detalle de una tabla indica su organización y si accedes como miembro. Si es así, el menú lleva a la organización (desde donde se sale de ella) en vez de ofrecer «Salir de la tabla».
- **Invitaciones a personas sin cuenta**:
  - el inicio de sesión que viene de una invitación explica que hay que crear la cuenta con el email invitado;
  - al registrarse, la invitación se recuerda en el navegador y, al confirmar la cuenta, se abre directamente;
  - solo se recuerdan rutas `/invitations?…`, y siempre pasan por la misma validación de redirecciones internas.
- **Demo**: incluye la organización de ejemplo «Equipo de la tienda», con la tabla «Almacén central» y tres miembros ficticios.
  - Los miembros ficticios no pueden iniciar sesión: tienen una contraseña aleatoria y una dirección `.invalid`.
  - Caducan con la cuenta de demo y no cuentan para el límite de demos activas.

**Consecuencias**: el aislamiento pasa de ser «mis tablas» a «tablas a las que tengo acceso por organización o porque me las compartieron». Cada ruta lleva tests e2e por vía de acceso y por rol, y cada PR de la fase pasa la revisión de seguridad.

## ADR-020: Tiempo real

- **Avisos, no datos**: el servidor solo dice «la tabla X cambió en registros, columnas, tabla, permisos o se borró». El navegador vuelve a pedir lo afectado a la API, que comprueba el acceso en cada petición. Así ningún mensaje puede filtrar datos, y se reutiliza la caché de TanStack Query. Si dos personas editan la misma celda, el último en guardar gana.
- **`ws` sin capa de Nest**: `@nestjs/websockets` solo tiene versión estable para Nest 12, y aquí usamos Nest 11. `ws` es una única dependencia sin subdependencias, y el servidor se monta en el mismo servidor HTTP, en `/api/realtime`.
- **Conexión directa a la API con ticket**:
  - En producción la web sirve `/api` mediante una rewrite del Static Site de Render, que no garantiza transportar WebSockets (`REALTIME_URL` apunta directamente a la API). En el dominio de la API no existe la cookie de sesión.
  - Por eso el navegador pide por la API normal (`POST /realtime/ticket`, con cookie) un ticket aleatorio, de un solo uso y válido 30 s, y lo envía como primer mensaje. El ticket nunca va en la URL.
  - En desarrollo y en Docker, con `REALTIME_URL` sin definir, la conexión va por el propio origen gracias al proxy de Vite o de nginx.
- **Mismas reglas de acceso**:
  - suscribirse a una tabla usa la misma regla que la API;
  - al quitar un permiso, el servidor corta esa suscripción y avisa con `revoked`;
  - se comprueba el `Origin` de la conexión;
  - límites: 1 KB por mensaje, 20 tablas por conexión, 10 conexiones por usuario y 200 conexiones esperando ticket en todo el servidor;
  - un ping cada 30 s descarta las conexiones muertas.
- **Presencia**: sobre la misma conexión, cada pestaña avisa de qué celda tiene abierta.
  - **Qué recibe cada uno:** el servidor envía a cada sala la lista de personas, una vez por persona aunque tengan varias pestañas, con la celda que edita cada una.
  - **Qué se comparte:** solo el nombre visible (la parte del email antes de la @) y nunca el email, porque quienes comparten una tabla no tienen por qué conocer el email de los demás.
- **Sin bloqueos**:
  - **Por qué no bloquear:** bloquear el registro mientras alguien lo edita dejaría bloqueos colgados cuando se cae una conexión. Además impediría cambios que no chocan, como dos celdas distintas del mismo registro.
  - **Cambios de celdas distintas:** la API mezcla los cambios parciales dentro de una transacción con la tabla bloqueada, así que se conservan todos.
  - **Formulario:** el de registro envía solo los campos modificados.
  - **Misma celda:** solo hay aviso, y gana el último en guardar. Herramientas como Google Sheets, Airtable o Notion siguen el mismo criterio.
- **Una sola instancia**: los tickets y las suscripciones viven en memoria. Con varias instancias haría falta un bus (Redis pub/sub) para repartir los avisos; ahora no es necesario.

## ADR-021: Importar archivos

**Contexto**: quien llega desde una hoja de cálculo necesita traer sus datos sin escribirlos a mano. Subir archivos al servidor abre la puerta a problemas conocidos: tamaño, formatos maliciosos, parsers de XML en los `.xlsx` y la vulnerabilidad pendiente de multer.

**Decisión**:
- **El navegador lee el archivo, la API valida.** El servidor nunca recibe el archivo, solo sus celdas como texto: `{ columns, rows }`, más `addMissingChoices`. `columns` dice qué columna de la tabla llena cada columna del archivo, o `null` para saltarla.
- **La API no confía en el navegador**: convierte y valida cada celda con las mismas reglas que al crear un registro a mano (`recordDataSchema`).
- **Dos pasos**:
  - `POST /tables/:id/import/check` no cambia nada y devuelve las filas válidas, los primeros 50 errores (fila, columna, valor y motivo) y los valores que no coinciden con ninguna opción de las listas;
  - `POST /tables/:id/import` importa todas las filas o ninguna, dentro de una transacción que bloquea la tabla.
- **Conversión pensada para hojas en español**:
  - números con coma o punto decimal y separador de miles («1.234,56», «12,5 €»);
  - fechas ISO o día/mes/año;
  - «Sí» y «No»;
  - opciones de lista sin distinguir mayúsculas.
  
  Un texto que no encaja en el tipo es un error, nunca una celda vacía en silencio. Se deshace el apóstrofo con el que nuestra exportación protege las fórmulas, así que exportar e importar devuelve lo mismo.
- **Columnas nuevas**: cada columna del archivo puede ir a una columna de la tabla, a una columna nueva (`{ create: definición }`) que se crea con la importación, o a ninguna. Así se puede importar en una tabla vacía.
  - **Desde cero:** con `POST /organizations/:id/tables/import` (y su `/check`), una tabla se crea entera desde un archivo con las mismas reglas que una tabla nueva: rol de administrador en el espacio y límite de 100 tablas.
  - **Identificación de errores:** los errores y las opciones que faltan se identifican por la posición de la columna en el archivo, porque una columna nueva todavía no tiene id para el cliente.
  - **Obligatorias sin emparejar:** las columnas obligatorias sin ninguna columna del archivo se informan una sola vez, en `missingRequired`.
- **Permisos**: importar filas exige ser editor. Añadir columnas u opciones nuevas cambia la estructura, y por eso exige ser administrador.
- **Límites**:
  - 5.000 filas y 50 columnas por importación;
  - 2.000 caracteres por celda;
  - 10.000 registros por tabla;
  - 2 MB de cuerpo, solo en estas rutas: el resto de la API mantiene los 100 KB de body-parser;
  - 10 peticiones por minuto.

**Consecuencias**: no hace falta almacenar ni subir archivos. Excel (`.xlsx`) se leerá también en el navegador cuando ExcelJS cumpla la antigüedad mínima de pnpm, sin tocar la API. El asistente lee el CSV con un parser propio (RFC 4180, con separador `;`, `,` o tabulador detectado en la primera línea) y decodifica en UTF-8 o, si no es válido, en Windows-1252, que es lo que usa Excel en español al guardar CSV.

## ADR-022: Relaciones entre tablas

**Contexto**: en un inventario las tablas se refieren unas a otras: cada producto tiene un proveedor, cada equipo una persona asignada. Copiar el nombre a mano en cada fila se desordena enseguida.

**Decisión**:
- **Tipo de columna `relation`.** Sus opciones dicen a qué tabla enlaza (`{ tableId }`), y cada celda guarda el id de un registro de esa tabla. Se queda en el JSONB de siempre, sin tablas físicas nuevas. Por ahora es un único registro por celda; la selección múltiple vendrá después.
- **Solo dentro del mismo espacio.** La tabla enlazada debe ser del mismo espacio (personal u organización), así que un enlace nunca cruza organizaciones.
- **Permisos:**
  - un listado incluye en `linked` la etiqueta (primera columna) de cada registro enlazado, pero solo si el usuario puede abrir la tabla enlazada; si no, ve que hay un enlace, nunca qué es;
  - para crear o cambiar un enlace hay que poder abrir la tabla enlazada (403 si no);
  - el registro debe existir en ella (422 si no).
- **Integridad:**
  - borrar un registro vacía las celdas que lo enlazaban, en la misma transacción, y avisa a sus tablas;
  - borrar una tabla borra las columnas de relación de otras tablas que apuntaban a ella;
  - cambiar a qué tabla enlaza una columna, o cambiar su tipo, vacía sus valores.
- **Exportar e importar:**
  - la exportación CSV escribe la etiqueta del registro enlazado;
  - una importación no crea columnas de relación ni rellena las existentes, porque el archivo no dice a qué registro se refiere. Se enlazan después en la tabla.
- **Fuera de esta primera versión:** buscar por la etiqueta, ordenar por ella, columnas de consulta y de resumen (lookup y rollup) e importar por etiqueta.

**Consecuencias**: el modelo de metadatos aguanta relaciones sin migraciones de esquema por tabla, solo un valor nuevo en el enum `ColumnType`.

## ADR-023: Columnas de valor único

**Contexto**: en un inventario hay columnas que identifican cada registro, como el SKU o el número de serie. Si se repiten, el inventario deja de cuadrar, y reimportar una hoja actualizada duplicaba todos sus registros.

**Decisión**:
- **Opción `unique` en la columna**, solo para texto y números y sin valor por defecto, que compartirían todos los registros que dejan la celda vacía. Las celdas vacías nunca chocan entre sí.
- **Qué cuenta como repetido:** el texto se compara sin mayúsculas ni espacios alrededor («SKU-1» y « sku-1 » son el mismo valor) y los números por su valor. En SQL, los dos lados de cada comparación pasan por `lower()` de PostgreSQL, para no depender de que coincida con el de JavaScript.
- **Dónde se comprueba:** en el backend, dentro de la transacción que bloquea la fila de la tabla (`touchTable`), así que dos escrituras a la vez no pueden colar el mismo valor. Sin índice en la base de datos: los valores viven en JSONB por id de columna (ADR-012) y un índice único por columna exigiría índices dinámicos. Si hiciera falta por volumen, se añadiría un índice de expresión parcial por columna.
- **Errores:**
  - crear o editar un registro con un valor que ya tiene otro devuelve 409 y nombra la columna y el valor;
  - marcar como única una columna que ya repite valores devuelve 409 con hasta cinco de ellos, para que se puedan corregir antes.
- **Importar actualizando:** la importación acepta `updateBy`, la posición de una columna del archivo emparejada con una columna única.
  - Una fila cuyo valor ya tiene un registro actualiza ese registro con las celdas que trae el archivo, en vez de crear otro; si no, crea uno nuevo.
  - La clave solo sirve para encontrar el registro: conserva cómo estaba escrita.
  - Las filas que actualizan no necesitan las columnas obligatorias que el archivo no trae, porque el registro ya las tiene.
  - Sin `updateBy`, un valor repetido en el archivo o que ya tiene otro registro es un error de la fila (`duplicate`), como cualquier otro.

**Consecuencias**: una comprobación más por cada columna única al escribir, acotada a la tabla. Cambiar el tipo de una columna a uno que no puede ser único le quita la opción.

## ADR-024: Movimientos de stock

**Contexto**: en un inventario el stock no se escribe, se mueve: entra un pedido, sale una venta, un recuento corrige la cifra. Hasta ahora la celda solo guardaba el número final, sin saber cuándo cambió ni quién lo cambió.

**Decisión**:
- **Columna de stock:** una columna de número puede marcarse `stock`. No puede ser a la vez de valor único (ADR-023), y si deja de ser de número pierde la marca. Las plantillas de inventario y la demo ya la traen.
- **Tabla `stock_movements`,** una fila por cambio, con:
  - el registro y la columna;
  - quién lo hizo y el tipo;
  - las unidades que suma o resta (`delta`) y el stock que deja (`balance`);
  - una nota opcional y la fecha.

  Es una tabla física y no JSONB, porque es un histórico que crece sin límite y se consulta por registro.
- **Tipos:**
  - **a mano:** entrada (`in`), salida (`out`) y recuento (`count`, que fija la cifra contada);
  - **registrados solos:** editar la celda (`edit`, también al crear el registro) e importar (`import`).

  Así el historial de un registro siempre cuadra con su stock, cambie como cambie.
- **Endpoints:**
  - `POST /tables/:tableId/records/:recordId/movements`: hace falta ser EDITOR. Aplica el movimiento en la misma transacción que bloquea la tabla y rechaza con 422 una salida que dejaría el stock por debajo de cero;
  - `GET` del mismo recurso: basta con poder ver la tabla. Devuelve los 100 movimientos más recientes y el total.
- **Autor:** como en la presencia en tiempo real (ADR-020), se muestra la parte del email antes de la @, nunca el email entero, y nada en la demo. Si la cuenta se borra, el movimiento se queda sin autor (`ON DELETE SET NULL`). Borrar el registro, la columna o la tabla borra sus movimientos.
- **Redondeo:** las cantidades se redondean a 6 decimales, para que 0,1 + 0,2 no deje restos de coma flotante.
- **Fuera de esta versión:** un historial de toda la tabla. Llegará con el historial de actividad, que reutilizará esta misma idea de eventos con autor y fecha.

**Consecuencias**:
- Rellenar con el valor por defecto los registros que ya existen al crear una columna, o activar la marca en una columna con datos, no crea movimientos. El primer movimiento parte del valor que hubiera, así que el saldo siempre es correcto.
- Cada escritura de una columna de stock añade una fila más en la misma transacción.

## ADR-025: Historial de actividad

**Contexto**: en una tabla compartida hace falta saber quién cambió qué y cuándo, sobre todo cuando algo desaparece o cambia sin avisar.

**Decisión**:
- **Tabla `activity_events`,** con una fila por evento: tabla, autor, acción, registro (sin clave foránea, porque el evento sobrevive al registro), etiqueta, detalles en JSON y fecha.
- **Acciones:**
  - registro creado, editado o borrado;
  - importación;
  - columna creada, editada (con el nombre anterior si se renombra) o borrada;
  - movimiento de stock anotado a mano (ADR-024).

  Se registran en la misma transacción que el cambio, después de `touchTable`.
- **Etiqueta guardada en el momento:** se guarda el nombre del registro (su primera columna) o de la columna tal como era entonces, para que el historial siga siendo legible aunque luego se borren o renombren.
- **Sin valores en las ediciones:** de una edición solo se guardan los nombres de las columnas que cambiaron, no los valores. Así el historial no duplica los datos de la tabla.
- **Una sola entrada por importación,** con cuántos registros creó y cuántos actualizó.
- **Ediciones agrupadas:** las ediciones seguidas de la misma persona en el mismo registro, a menos de 5 minutos, se juntan en un evento. Si no, cada celda editada en línea llenaría el historial.
- **Lectura:** `GET /tables/:tableId/activity?page=` para quien pueda ver la tabla, de 30 en 30 y lo más reciente primero.
  - El autor se muestra como en el resto de la app (parte del email antes de la @, nada en la demo), con `mine` para decir «Tú» sin tener que conjugar verbos.
  - Si la cuenta se borra, el evento se queda sin autor. Borrar la tabla borra su historial.
- **Fuera de esta versión:**
  - reordenar columnas;
  - renombrar la tabla;
  - los cambios de acceso, que ya quedan en el registro de permisos (ADR-019);
  - los efectos en otras tablas, como vaciar enlaces a un registro borrado;
  - un límite de antigüedad. Si crece demasiado, se podará por fecha con un trabajo programado.

**Consecuencias**: cada escritura añade una fila en la misma transacción. El índice `(tableId, createdAt)` mantiene rápida la lectura paginada.

## ADR-026: Enlaces públicos de solo lectura

**Contexto**: a veces hay que enseñar una tabla a alguien sin cuenta: un cliente que consulta existencias o un proveedor que revisa un pedido. Invitar exige registrarse.

**Decisión**:
- **Un enlace por tabla,** en la tabla `public_links`. Lo crean, regeneran o desactivan sus administradores. Crear uno nuevo invalida el anterior, y borrar la tabla borra el enlace.
- **Solo se guarda el hash** (SHA-256) de un token aleatorio de 256 bits, como en las invitaciones.
  - El enlace se muestra una vez, al crearlo. Si se pierde, se crea otro.
  - Así, una copia filtrada de la base de datos no da acceso a los datos actuales.
- **El token va tras el `#`** (`/p#token`). Los navegadores nunca envían el fragmento, así que no acaba en los registros del servidor, ni en el `Referer`, ni en el historial de un proxy.
  - La página lo lee y lo manda en la cabecera `X-Public-Token` a `GET /api/public/table`, la única ruta sin sesión aparte de las de autenticación.
  - Esa ruta tiene un límite de 30 peticiones por minuto, responde `Cache-Control: no-store` y `X-Robots-Tag: noindex`, y la página lleva `noindex`.
- **Qué se ve:** nombre, descripción, columnas y registros, con búsqueda y paginación, sin poder cambiar nada.
  - Las columnas de relación se quitan, tanto de las columnas como de los datos, porque apuntan a tablas que el enlace no abre.
  - Tampoco se pueden usar para ordenar ni filtrar (400).
- **Respuesta igual para todo enlace que no vale:** un token mal formado, inexistente o desactivado da siempre 404, así que no se sabe cuál de los tres es.
- **No disponible en la demo:** si no, cualquiera podría publicar texto bajo este dominio durante un día.
- **Registro:** crear y desactivar un enlace queda en el registro de permisos (ADR-019), con ids y sin datos personales.

**Consecuencias**: el enlace da acceso de lectura a quien lo tenga, sin saber quién es. Por eso se puede desactivar o cambiar en cualquier momento, y el diálogo lo explica.

## ADR-027: Nuevo nombre, Tablaria

**Contexto**: el nombre anterior compartía palabra con la empresa donde se hicieron las prácticas, y el producto se parecía a uno que desarrollaban allí. En un proyecto de portfolio, eso podía leerse como que la idea venía de allí.

**Decisión**:
- **El proyecto pasa a llamarse Tablaria:**
  - la marca de la interfaz, los correos y los documentos;
  - las carpetas `tablaria-frontend` y `tablaria-backend`, el paquete `@tablaria/shared` y la base de datos local;
  - las claves de `localStorage` y las cookies de sesión (`tb_access` y `tb_refresh`).
- **Se publica en servicios nuevos de Render** con el dominio `tablaria.es` (Hostalia). El dominio anterior deja de usarse.
- **La URL pública de la web es configurable** (`SITE_URL`, al compilar): la canónica y la vista previa al compartir no dependen de ningún dominio fijo.
- **El historial de git no se reescribe.**

**Consecuencias**:
- Al cambiar las cookies y el origen, todo el mundo tiene que volver a iniciar sesión una vez.
- Las preferencias guardadas en el navegador (tema, barra lateral y espacio elegido) vuelven a sus valores iniciales.
- Los datos no cambian: la base de datos de Neon es la misma.
- Los correos salen desde `mail.tablaria.es` una vez verificado en Resend. Hasta entonces, desde el subdominio anterior.

## ADR-028: Buscar, filtrar y ordenar relaciones por su nombre

**Contexto**: una columna de relación guarda el id del registro enlazado (ADR-022). Hasta ahora no se podía filtrar ni ordenar por ella, y la búsqueda la ignoraba, así que «productos de Bosch» no tenía respuesta.

**Decisión**:
- **El nombre de un registro** es su primera columna (por posición), el mismo que ya muestra la tabla (`linked`). Si esa primera columna es otra relación, no hay nombre.
- **Buscar:** la búsqueda general incluye el nombre del registro enlazado. **Filtrar:** el filtro de las relaciones pasa a ser «contiene», sobre ese nombre. Antes era por ids, y la interfaz no lo ofrecía. **Ordenar:** por ese nombre, sin distinguir mayúsculas; los registros sin enlace siempre van al final.
- **Cómo se consulta:** una subconsulta correlacionada por la clave primaria del registro enlazado, dentro del mismo SQL parametrizado. Los ids de columna y de tabla salen de la base de datos, nunca del usuario.
- **Permisos:** solo cuenta el nombre de las relaciones cuya tabla el usuario puede abrir (`labelSources`). Si no puede abrirla:
  - la búsqueda no mira ese nombre;
  - filtrar u ordenar por esa columna da 403. Así nadie puede averiguar nombres que no ve a base de probar filtros.
- **`labelledRelations`:** la respuesta de la lista de registros dice qué relaciones admiten búsqueda, filtro y orden. La interfaz solo ofrece esas, y en las demás la cabecera deja de ser un botón.
- **Exportar:** sigue las mismas reglas que la lista. Los enlaces públicos siguen sin mostrar relaciones (ADR-026).

**Consecuencias**: ordenar por una relación hace una búsqueda por clave primaria por fila. Va bien hasta el límite de 10.000 registros por tabla; más allá convendría desnormalizar el nombre.

## ADR-029: Agrupar los registros por una columna

**Contexto**: en un inventario es habitual querer ver los registros por estado, categoría o proveedor, con cuántos hay en cada grupo. Los filtros solo enseñan un grupo cada vez.

**Decisión**:
- **Parámetro `group`** en la lista de registros (y en la URL, para compartir la vista). Se agrupa por listas de opciones, Sí/No, texto y relaciones; en las relaciones, por el nombre del registro enlazado y solo si se puede abrir su tabla (ADR-028).
- **El servidor ordena por grupo antes que por el orden pedido,** así la paginación sigue funcionando y un grupo puede continuar en la página siguiente:
  - las listas, en el orden de sus opciones;
  - Sí/No, con No primero;
  - el texto, alfabéticamente, y el valor exacto como desempate, para que dos formas de escribir lo mismo no se mezclen;
  - los vacíos, al final.
- **Recuento por grupo:** la respuesta trae en `groups` cuántos registros tiene cada grupo en toda la lista (con la búsqueda y los filtros), no solo en la página, para que la cabecera de un grupo partido diga su tamaño real.
- **En la interfaz:** un selector «Agrupar por…» en la barra y una fila de cabecera (`th scope="colgroup"`) donde empieza cada grupo y al principio de cada página.
- **Exportar y enlaces públicos:** respetan el orden por grupo. Sin plegar grupos ni subtotales por ahora.

**Consecuencias**: una consulta más (`GROUP BY`) cuando se agrupa, sobre las mismas condiciones de la lista.

## ADR-030: Columnas de consulta (lookup)

**Contexto**: con una relación (ADR-022), cada producto enlaza con su proveedor, pero para ver el teléfono del proveedor había que copiarlo en Productos, y la copia se quedaba desfasada al cambiar el original.

**Decisión**:
- **Tipo de columna `lookup`,** con dos opciones: `relationColumnId` (una relación de la misma tabla) y `targetColumnId` (una columna de la tabla enlazada). El valor de la celda es el de esa columna en el registro enlazado.
- **No se guarda nunca:** se lee al listar o exportar (`fillLookups`, una consulta por relación). Así siempre está al día. Escribirlo da 400, porque la clave no existe en el esquema de datos del registro. Una importación no puede rellenarlo ni crearlo.
- **Qué puede mostrar:** texto, número, fecha, Sí/No, lista y precio. Ni relaciones ni otras consultas, para que no haya cadenas.
- **Tipo fijo:** una consulta se crea como tal y no cambia de tipo, y ninguna otra columna se convierte en consulta. No puede ser obligatoria ni tener valor por defecto.
- **Permisos:**
  - para crearla hay que poder abrir la tabla enlazada (403 si no);
  - para ver sus valores también: quien no puede abrirla ve la columna vacía, y `TableDetail.lookupTargets` no la incluye;
  - buscar, filtrar u ordenar por ella sigue las mismas reglas que las relaciones (ADR-028): 403 si no hay acceso.
- **Búsqueda, filtro y orden:** reutilizan la subconsulta de los nombres enlazados (ADR-028), generalizada para leer cualquier columna:
  - el orden respeta el tipo de la columna mostrada (números por valor, fechas por fecha);
  - el filtro es «contiene» sobre su texto;
  - la búsqueda general incluye las que muestran texto o listas.
- **Formato:** `lookupTargets` da a la interfaz la definición de la columna mostrada, para formatear igual que en su tabla (precio con su moneda, chips de lista…). El CSV hace lo mismo.
- **Limpieza** (`dropLookups`): una consulta se borra con su relación, con la columna que muestra, cuando la relación pasa a enlazar otra tabla o deja de ser relación, cuando la columna mostrada pasa a un tipo que no se puede mostrar y cuando se borra la tabla enlazada.
- **Enlaces públicos:** no muestran consultas, igual que no muestran relaciones (ADR-026).
- **Fuera de esta versión:** agrupar por una consulta y mostrar en una lista desplegable los valores posibles de su filtro.

**Consecuencias**: leer una página con consultas añade una consulta por relación usada. Ordenar o filtrar por una consulta hace una búsqueda por clave primaria por fila, como con los nombres enlazados.

## ADR-031: Columnas de resumen (rollup)

**Contexto**: una relación (ADR-022) une, por ejemplo, cada empleado con su equipo, y una consulta (ADR-030) lee datos en esa dirección. Faltaba la contraria: desde el equipo, cuántos empleados tiene o cuánto suman sus salarios.

**Decisión**:
- **Tipo de columna `rollup`,** con las opciones `relationColumnId`, `function` y `targetColumnId`:
  - la relación es una columna, de cualquier tabla del espacio o de esta misma, que apunta a esta tabla, como «Jefe» en Empleados para contar las personas a cargo;
  - las funciones son contar, sumar, media, mínimo y máximo;
  - contar no lleva columna. Sumar y media necesitan un número o un precio; mínimo y máximo, además, admiten fechas.
- **Genérico:** no hay nada específico de ningún caso (productos y proveedores, equipos y empleados, clientes y pedidos). Lo decide quien crea la columna.
- **Calculado al leer, nunca guardado** (`fillRollups`): una consulta `GROUP BY` por resumen y página sobre los registros que enlazan con los de la página.
  - Sin registros que enlacen, contar y sumar dan 0, y media, mínimo y máximo quedan vacíos.
  - La media se redondea a 6 decimales.
  - Solo cuentan las celdas del tipo JSON correcto, así que un valor raro no rompe la conversión.
- **Validación:** la relación tiene que apuntar a esta tabla; la columna, estar en la tabla de esa relación y encajar con la función; hay que poder abrir esa tabla (403). No puede ser obligatoria, y el tipo no cambia, ni a resumen ni desde resumen.
- **Permisos:** quien no puede abrir la tabla de la relación ve la columna vacía. `TableDetail.rollupTargets` y `incomingRelations` (las relaciones que apuntan aquí, para el formulario) solo incluyen tablas que puede abrir.
- **Limpieza** (`dropComputedColumns`, compartida con las consultas):
  - el resumen se borra con su relación (al borrarla, o si deja de apuntar aquí) o con la columna que suma, y al borrar la tabla que enlaza;
  - si la columna sumada cambia a un tipo que no encaja con su función, se borra (`dropRollupsNotFitting`).
- **Formato:** contar se muestra como número; sumar y media, como la columna sumada (precio con moneda), pero sin el aviso de stock bajo, que tiene sentido por registro y no para un total; mínimo y máximo, como su columna (fechas).
- **Fuera de esta versión:**
  - ordenar y filtrar por un resumen (400), porque hoy se calcula por página y no en el SQL de la lista (hecho en ADR-034);
  - resúmenes con condición («tareas pendientes»);
  - la selección múltiple, que cambiará qué cuenta como «enlaza aquí» (hecha en ADR-032).

**Consecuencias**: cada página con resúmenes hace una consulta agrupada por resumen sobre la tabla que enlaza, acotada por `tableId`. Va bien con 10.000 registros por tabla. Si hiciera falta ordenar por resumen, la vía es un índice sobre la celda de la relación.

## ADR-032: Relaciones con varios registros

**Contexto**: una relación (ADR-022) enlaza cada registro con uno solo de otra tabla. Muchos casos reales son de muchos a muchos: los miembros de un proyecto, los proveedores de un producto, las etiquetas de una tarea.

**Decisión**:
- **Opción `multiple` de la relación** (por defecto `false`), no un tipo nuevo: es la misma relación, con los mismos permisos, la misma tabla enlazada y la misma etiqueta (primera columna).
  - La migración `multiple_relations` añade `multiple: false` a las relaciones que ya existían.
  - Sin tabla intermedia: la celda guarda una lista JSON de ids, coherente con el resto de valores en JSONB.
- **Valor:** `CellValue` admite `string[]` solo para esto. La lista tiene entre 1 y 100 ids, sin repetidos; una lista vacía es una celda vacía. Cada id tiene que existir en la tabla enlazada y hay que poder abrirla (`requireLinkedRecords`, igual que antes).
- **Buscar, filtrar y ordenar** por las etiquetas, unidas por comas en orden alfabético en el SQL (`labelText`). Ordenar compara ese texto. **No se agrupa** por una relación múltiple (400): un registro estaría en varios grupos.
- **Resúmenes (ADR-031):** funcionan a través de una relación múltiple. Cada registro cuenta en todos los que lista (`jsonb_array_elements_text`), así que «Proyectos» en Empleados cuenta los proyectos en los que está cada persona.
- **Consultas (ADR-030):** solo a través de relaciones de un registro (422). Una consulta muestra un valor con el formato de su columna, y una lista de valores necesitaría otro formato. Al pasar una relación a múltiple se borran las consultas que leen a través de ella; el formulario lo avisa antes de guardar.
- **Cambiar la opción:** al activarla, cada enlace pasa a ser una lista de uno; al desactivarla, cada lista conserva su primer registro. El formulario avisa de ambas cosas.
- **Borrar un registro enlazado** lo quita de las listas que lo tenían (`unlinkRecord`); si era el último, la celda queda vacía.
- **Otros:** el CSV exporta las etiquetas separadas por comas; el historial compara las listas por contenido; la importación no rellena relaciones, como antes.
- **Interfaz:** el selector deja abierta la lista y cada elección añade o quita un registro (`aria-pressed`). Encima muestra los enlazados, cada uno con su botón para quitarlo. En una relación obligatoria no se puede quitar el último.

**Consecuencias**: buscar y ordenar por una relación múltiple hace una subconsulta por fila sobre la tabla enlazada, acotada por `tableId` y por clave primaria. Va bien con 10.000 registros por tabla. Las consultas a través de listas y agrupar por cada registro enlazado quedan para más adelante.

## ADR-033: Columnas de fórmula

**Contexto**: con consultas (ADR-030) y resúmenes (ADR-031) una fila ya tiene el precio, el stock o el total de pedidos, pero no se podía combinar: el valor del inventario (precio × stock), los días hasta caducar o un aviso «Pedir» cuando el stock baja.

**Decisión**:
- **Tipo de columna `formula`,** con las opciones `expression`, `currency` y `resultType`. Las columnas se citan entre llaves, `{Precio} * {Stock}`.
- **Lenguaje propio, sin `eval` ni SQL:** un analizador escrito a mano en `@tablaria/shared` (`parseFormula`, `checkFormula`, `evaluateFormula`). Lo usan la API, que es la que valida y calcula, y el formulario, que muestra los errores mientras se escribe.
  - Números con coma decimal (`2,5`; el punto también vale), textos entre comillas, `VERDADERO` y `FALSO`.
  - Los datos de una función se separan con `;`, como en una hoja de cálculo en español. La coma también separa cuando no puede ser decimal (`MAX(2, 5)`).
  - Las columnas se citan entre llaves; una llave dentro del nombre se escribe doble (`{Talla {EU}}}`).
  - Operadores `+ - * /`, `&` para unir textos y las comparaciones `= <> < > <= >=`.
  - Funciones: `SI`, `Y`, `O`, `NO`, `ESVACIO`, `REDONDEAR`, `ABS`, `MIN`, `MAX`, `MAYUSC`, `MINUSC`, `LARGO`, `HOY` y `DIAS`. Los nombres van en español, como el resto de la aplicación; sus equivalentes en inglés (`IF`, `AND`…) también valen, para no rehacerlo al traducir la interfaz.
  - Como máximo 1.000 caracteres y 100 nodos, para que nadie haga trabajar al servidor con una expresión enorme.
- **Tipos comprobados al guardar:** cada expresión da un número, un texto, un Sí/No o una fecha (`resultType`), calculado por la API y no por el cliente. Lo que no encaja da 422 con el motivo (`SI` con ramas de tipos distintos, sumar un texto…).
  - Puede citar texto, número, precio (como número), fecha, Sí/No, lista (como texto), consultas y resúmenes, con el tipo de lo que muestran.
  - No puede citar relaciones ni otras fórmulas, para que no haya cadenas.
- **`HOY`** es la fecha en España (Europe/Madrid), no la de UTC, para que no cambie de día a medianoche.
- **Celdas vacías:** una cuenta con una celda vacía queda vacía; dividir por cero, también. `&` toma lo vacío como texto vacío. `ESVACIO` lo comprueba de forma explícita.
- **Moneda opcional** (`currency`): una fórmula numérica puede mostrarse como precio (precio × stock en euros).
- **En la base de datos, por id:** la expresión se guarda como `{id}` y la interfaz la muestra con los nombres. Renombrar una columna no rompe nada.
- **Calculada al leer, nunca guardada** (`fillFormulas`): después de las consultas y los resúmenes, en la lista y en el CSV. Escribirla da 400, igual que con las demás columnas calculadas.
- **Tipo fijo:** se crea como fórmula y no cambia de tipo. No puede ser obligatoria, única ni tener valor por defecto.
- **Limpieza** (`syncFormulas`): al borrar o cambiar una columna, se vuelven a comprobar las fórmulas de las tablas afectadas, que son la propia y las que tienen consultas o resúmenes que leen de ella. Si una fórmula ya no encaja se borra, como las consultas; si cambia su tipo de resultado, se actualiza, y si deja de dar un número pierde la moneda en vez de borrarse.
- **Permisos:** una consulta o un resumen que el usuario no puede ver llega vacío, así que la fórmula se calcula con ese hueco y no revela nada.
- **Enlaces públicos:** no muestran fórmulas, igual que no muestran consultas ni resúmenes (ADR-026).
- **Fuera de esta versión:** ordenar, filtrar, buscar y agrupar por una fórmula (400), porque se calcula en la página y no en el SQL; fórmulas que citen otras fórmulas; más funciones.

**Consecuencias**: calcular una fórmula cuesta muy poco frente a leer la página, y no añade consultas a la base de datos. Para ordenar por ella habría que traducir la expresión a SQL o guardar el resultado.

## ADR-034: Ordenar y filtrar por resumen

**Contexto**: los resúmenes (ADR-031) se calculaban solo para la página que se muestra, así que no se podía ordenar ni filtrar por ellos. Es lo primero que se intenta con un resumen: «los clientes que más facturan», «los proveedores con más de 10 productos».

**Decisión**:
- **En el SQL de la lista:** solo cuando la consulta ordena o filtra por un resumen, se une a `records r` con un `LEFT JOIN` contra la tabla que enlaza, agrupada una vez (`rollupValuesSql`: `link`, `value`).
  - Se usa una unión por resumen, aunque se use varias veces.
  - El alias es una constante (`ru0`, `ru1`…) y todos los valores van como parámetros.
  - La misma unión sirve para el total, la cuenta por grupos y la exportación.
- **Mismo resultado que la tabla:** sin registros que enlacen, contar y sumar valen 0 (`COALESCE`, igual que `fillRollups` vía `emptyRollupValue`). Media, mínimo y máximo quedan vacíos y van al final.
- **Comparación:** por número o, si es el mínimo o máximo de una fecha, por fecha (`rollupValueType`). El filtro es un rango (`between`), y los límites deben ser del tipo que corresponde (400).
- **Relaciones múltiples (ADR-032):** cada registro cuenta en todos los que lista, igual que al mostrarlo.
- **Permisos:** sin acceso a la tabla que enlaza, ordenar o filtrar por el resumen da 403, porque revelaría lo que suma.
- **Sigue fuera:** agrupar por un resumen (cada registro tiene su propio valor), y ordenar o filtrar por fórmula (ADR-033).

**Consecuencias**: ordenar por un resumen agrupa toda la tabla que enlaza en cada consulta, con un máximo de 10.000 registros, en lugar de una subconsulta por fila, y PostgreSQL lo resuelve con un hash join. Si las tablas crecieran mucho, la vía sería un índice sobre la celda de la relación o guardar el valor.

## ADR-035: Métricas de cada tabla

**Contexto**: Inicio mezclaba la lista «Bajo mínimo» de todas las tablas con un gráfico «Resumen» en el que primero había que elegir la tabla. Las dos cosas se entienden mejor dentro de la tabla a la que pertenecen, y con las relaciones, consultas y resúmenes había mucho más que medir.

**Decisión**:
- **Una pestaña «Métricas» por tabla** (`/app/tables/:tableId/metrics`), con:
  - tarjetas de resumen;
  - la lista de bajo mínimo de la tabla;
  - un gráfico por grupos (barras o dona);
  - un gráfico de evolución.
  Las métricas cuentan todos los registros de la tabla, sin la búsqueda ni los filtros de la vista de registros.
- **Inicio** se queda con las cifras generales y la lista de tablas. Se probó un aviso breve de stock bajo con enlaces a cada tabla, pero chocaba con el resto de la página y se quitó: los avisos se ven en las métricas de cada tabla.
- **API de solo lectura en un módulo propio** (`metrics`), bajo `/tables/:tableId/metrics`. Sustituye a `GET /records/stats`, que solo usaba el gráfico de Inicio.
  - `summary`: total, media, mínimo y máximo de cada columna numérica o de precio, en una sola consulta (`unnest` de las columnas).
  - `groups`: agrupa por lista de opciones, Sí/No, texto o relación simple, y mide contando o con suma, media, mínimo o máximo de una columna.
    - Devuelve los 8 grupos mayores y junta el resto. La media de ese resto se pondera por cuántos valores tenía cada grupo.
    - Por relación, los nombres salen de `linkedLabels`. Si no se puede abrir la tabla enlazada, devuelve 403, como al ordenar por ella (ADR-028).
    - Una relación múltiple no agrupa (ADR-032).
  - `timeline`: registros por día, semana (empieza en lunes) o mes, según la fecha de creación o una columna de fecha, con la misma medida.
    - Devuelve los 36 periodos más recientes con registros. El navegador rellena los vacíos, para que se vean los huecos.
  - **Seguridad:**
    - los ids de columna se comprueban contra la tabla y cada valor va como parámetro;
    - la función de la medida sale de una lista cerrada (`METRIC_FUNCTIONS`);
    - una celda que no es un número o una fecha ISO no rompe la conversión.
- **Avisos de stock:** `GET /stock-alerts` admite `tableId` para la lista de una tabla, con las mismas reglas de acceso.
- **Gráficos con los charts de shadcn/ui (Recharts):**
  - un `ChartContainer` y un tooltip propios en `components/ui/chart.tsx`;
  - los colores salen de los tokens del tema y de los de cada opción de lista;
  - Recharts solo se carga con la página de métricas (`lazy`), así que el paquete inicial no crece.
- **Accesibilidad:** el dibujo se oculta a los lectores de pantalla y cada gráfico lleva sus datos en una tabla (`ChartData`), con título y leyenda visibles. El cambio barras/dona usa `aria-pressed`.
- **Fuera por ahora:**
  - medir resúmenes y fórmulas, que se calculan al leer;
  - métricas que sigan los filtros de la vista;
  - guardar la configuración de los gráficos;
  - un dashboard con varias tablas.

**Consecuencias**:
- Cada gráfico es una consulta agrupada sobre la tabla, con un máximo de 10.000 registros.
- Las métricas se invalidan con cada cambio de registros o columnas (tiempo real incluido), igual que hacía el gráfico de Inicio.
- Se añade una dependencia: Recharts 3, con más de 14 días, como exige pnpm. Para instalarla se excluye `rolldown` de `minimumReleaseAge`, igual que `@rolldown/*`, porque la versión del lockfile ya pasa el CI.
## ADR-036: Importar relaciones por nombre

**Contexto**: una relación guarda el id del registro enlazado (ADR-022), y un CSV trae su nombre («Bosch»). Hasta ahora toda celda de relación salía como valor no válido, así que había que importar y luego enlazar a mano, aunque el propio CSV exportado ya escribe las relaciones por nombre (ADR-032).

**Decisión**:
- **Por nombre, el que se ve en la tabla:** la primera columna de la tabla enlazada, como en las etiquetas (ADR-028). Antes de analizar el archivo se cargan, por cada relación que rellena, los registros de su tabla por nombre (`recordsByName`).
  - Los nombres se comparan como los valores únicos (`uniqueKey`), sin distinguir mayúsculas ni espacios de más.
  - Si la primera columna de la tabla enlazada es otra relación, no hay nombres con los que emparejar.
- **Relación múltiple:** nombres separados por comas, lo mismo que escribe la exportación. Un nombre repetido enlaza una vez.
- **Errores por celda**, en el informe del asistente: `unknownRecord` si ningún registro se llama así y `ambiguousRecord` si se llaman así varios. Nunca se elige uno al azar. Como siempre, con un error no se importa nada.
- **Permisos:** quien importa tiene que poder abrir la tabla enlazada (403 si no), porque emparejar nombres revelaría lo que contiene. Es la misma regla que al enlazar a mano.
- **Sigue sin poder hacerse:**
  - crear una columna de relación desde el archivo, que no dice a qué tabla enlaza;
  - enlazar con registros que llegan en el mismo archivo: solo se encuentran los que ya existen;
  - rellenar consultas, resúmenes y fórmulas, que se calculan solos.

**Consecuencias**: cada importación lee una vez los registros de cada tabla enlazada, con un máximo de 10.000. El CSV exportado se puede volver a importar con sus relaciones. Para nombres repetidos, la vía es renombrar uno o darle a la primera columna valores únicos (ADR-023).

## ADR-037: Una demo que enseña todas las funciones

**Contexto**: la demo (ADR-013) creaba tres tablas a partir de las plantillas: un catálogo, un almacén y unos equipos de oficina. No tenía relaciones, consultas, resúmenes, fórmulas ni historial, así que quien entraba no veía nada de lo añadido desde la v1.5.0, y las métricas por fecha salían en un solo punto.

**Decisión**:
- **Una historia, una ferretería.** En Mi espacio están Productos, Pedidos, Proveedores y Equipos de la oficina. En la organización «Equipo de la tienda», con sus compañeros ficticios, está Almacén central. Productos va primero en las listas, porque es lo que se abre.
  - **Productos:** lista de opciones, relación y consulta, precio y coste, dos fórmulas, stock con aviso, booleano y un resumen que cuenta los pedidos.
  - **Proveedores:** resúmenes que cuentan y suman a través de la relación de Productos.
  - **Pedidos:** relación múltiple, fechas, estado y booleano.
- **Datos declarativos** (`demoTables` en `demo-data.ts`):
  - las relaciones nombran tablas por clave y registros por su primera celda, como al importar (ADR-036);
  - consultas, resúmenes y fórmulas nombran columnas.

  Las fechas cuentan hacia atrás desde el día en que se crea la cuenta, así que la evolución siempre parece reciente.
- **Construcción como la haría una persona** (`createDemoTables`):
  1. Primero las columnas guardadas.
  2. Después los registros, tabla enlazada antes que la que enlaza, validados con `recordDataSchema` como en la API.
  3. Al final las columnas calculadas. Las fórmulas pasan por `prepareFormula`, así que su expresión y su tipo de resultado son los mismos que daría la API.
- **Historial con fechas:**
  - cada registro se añade en un día distinto dentro de un plazo por tabla;
  - cada celda de stock tiene un recuento inicial y los movimientos de la tabla, con sus fechas y autores, y su saldo coincide con el valor de la celda;
  - cada alta y cada movimiento dejan su evento de actividad (ADR-025).
- **Sin enlace público:** el token solo se muestra al crearlo, así que uno creado por la demo no serviría. El visitante puede crear el suyo.

**Consecuencias**:
- Crear una cuenta de demo cuesta unas cien escrituras en una transacción, que siguen siendo pocas para el límite de 300 cuentas activas.
- El test de la demo comprueba que cada tipo de columna da su valor (fórmula, consulta, resumen por relación simple y múltiple), que el historial de stock cuadra y que la evolución tiene varios meses.
- Si se añade una función nueva, la demo debería enseñarla también.

## ADR-038: Etiquetas QR y ficha de cada registro

**Contexto**: en un almacén o una oficina, lo útil es pegar una etiqueta en la estantería o en el equipo y, al escanearla, ver al momento su registro: stock, ubicación, quién lo tiene. No había forma de abrir un registro suelto, ni en la API ni en la interfaz.

**Decisión**:
- **Un registro suelto en la API:** `GET /tables/:tableId/records/:recordId` devuelve `RecordDetail`, con el registro y las etiquetas de lo que enlaza.
  - Las consultas, los resúmenes y las fórmulas se rellenan igual que en una página de registros, con los mismos permisos.
  - Responde 404 si la tabla no se puede abrir, si el registro es de otra tabla o si no existe, sin distinguir entre esos casos.
- **La ficha vive en la URL** (`/app/tables/:tableId?record=:recordId`).
  - Muestra todas las celdas, las calculadas incluidas, con su formato.
  - Desde ella se puede editar el registro (EDITOR o más), ver su stock o imprimir su etiqueta.
  - Cualquiera que pueda abrir la tabla la ve: la opción «Ver ficha» está en el menú de cada fila, también para quien solo puede ver.
- **El QR solo lleva ese enlace**, sin datos. Escanearlo pide iniciar sesión y tener acceso a la tabla, así que una etiqueta perdida no revela nada.
  - Se genera en el navegador con la librería `qrcode`, madura y sin dependencias de servidor.
  - Se dibuja como un SVG de cuadrados, para que se imprima nítido a cualquier tamaño, con corrección de errores media para aguantar etiquetas rozadas.
  - En PNG solo se genera para descargarlo.
- **Etiqueta:**
  - el nombre (la primera columna);
  - la referencia: la primera columna de valor único (ADR-023), como el SKU o el número de serie, el código que la gente lee en voz alta;
  - el nombre de la tabla.
- **Hoja para imprimir** (`/app/tables/:tableId/labels`), fuera del marco de la app para que solo se impriman las etiquetas.
  - Imprime la vista actual (búsqueda, filtros y orden), con un máximo de una página de 100 registros, o un solo registro con `?record=`.
  - Tres etiquetas por fila, sin cortarse entre páginas.
- **Sin almacenamiento:** los QR se generan al vuelo, así que no hace falta guardar imágenes. Los adjuntos (fotos y documentos) quedan para una decisión aparte, con Filebase como opción sin cobros por exceso.

**Consecuencias**:
- Un QR pegado sigue sirviendo mientras exista el registro, aunque cambien sus datos.
- Si el registro se borra, la ficha dice que ya no existe.
- Las etiquetas dependen del dominio (`window.location.origin`): si cambia el dominio de la app, hay que volver a imprimirlas.

## ADR-039: Adjuntos en cada registro

**Contexto**: al escanear la etiqueta de un producto o de un equipo (ADR-038), lo útil es ver también su foto, su factura o su manual. Los archivos no caben en la base de datos (el plan gratuito de Neon tiene 0,5 GB), y el proyecto es gratuito: el almacenamiento no puede cobrar por pasarse de un límite.

**Decisión**:
- **Adjuntos del registro, no un tipo de columna.** Se ven y se gestionan en la ficha del registro.
  - Una columna habría tenido que encajar en la conversión de tipos, los filtros, el orden, la exportación, la importación, las fórmulas y los valores únicos, sin que nada de eso tenga sentido para un archivo.
  - Queda pendiente una columna de imagen que muestre la foto principal en la tabla.
- **Almacenamiento:** un bucket privado compatible con S3. En producción, Filebase: 5 GB gratis, sin coste de descarga y sin cobros por exceso en el plan gratuito.
  - Las peticiones se firman con `aws4fetch`, una librería pequeña y sin dependencias, en vez del SDK de AWS.
  - **En desarrollo y en los tests,** sin bucket configurado, los archivos van a una carpeta del disco (`STORAGE_DIR`). **En producción sin bucket,** la app funciona igual pero no deja subir archivos (503).
- **Subida a través de la API**, con el archivo como cuerpo de la petición (`POST …/records/:recordId/attachments?name=`).
  - Así la API ve los bytes antes de guardarlos y el bucket no necesita CORS.
  - El coste es que el archivo pasa por la API: con 5 MB como máximo, es asumible.
- **Lo que se comprueba al subir:**
  - **Permisos:** hay que ser EDITOR de la tabla, y el registro tiene que ser de esa tabla.
  - **Tamaño:** como máximo 5 MB. El parser solo acepta un cuerpo así de grande con una sesión válida, como en las importaciones.
  - **Tipo real:** se lee de los primeros bytes (JPG, PNG, WebP o PDF), sin fiarse del nombre ni del `Content-Type`. Un SVG o un HTML nunca entran.
  - **Nombre:** se limpia, sin carpetas ni caracteres de control.
  - **Límites:** 10 archivos por registro y 50 MB entre todos los registros de un espacio. Se cuentan con la fila del espacio bloqueada, así que dos subidas a la vez, aunque sean a tablas distintas, no se los saltan.
  - **Demo:** no puede subir archivos, igual que no puede crear enlaces públicos.
- **Descarga:** `GET …/attachments/:attachmentId` comprueba que el usuario puede ver la tabla y redirige a una URL firmada que caduca a los 5 minutos.
  - La URL fija el tipo y el nombre con que responde el bucket.
  - El archivo se sirve desde el dominio del bucket, no desde el nuestro, así que no puede ejecutar nada en la app. La CSP de la web permite imágenes de ese dominio.
  - En desarrollo la API sirve los bytes ella misma, y a las imágenes les añade una CSP con `sandbox`.
- **Borrado:**
  - **El registro** al que pertenece un adjunto se pone a `NULL` cuando desaparece (`ON DELETE SET NULL`), lo borre quien lo borre: el registro, su tabla, su espacio o la cuenta de su dueño, también la de una demo caducada.
  - **Una limpieza periódica** (cada 15 minutos, y al momento al borrar un adjunto) quita del bucket los archivos sin registro y después sus filas.
    - Deja en paz las filas de menos de 5 minutos: una subida guarda su fila antes de que el archivo llegue al bucket, y borrarla entremedias dejaría ese archivo sin rastro. Si el bucket falla, la fila se queda y la siguiente limpieza lo reintenta, así que nunca queda un archivo sin rastro en la base de datos.
- **Fuera de alcance:** los enlaces públicos no muestran adjuntos.

**Consecuencias**:
- Los archivos de un registro borrado siguen en el bucket hasta la siguiente limpieza, como mucho unos 20 minutos mientras la API esté despierta.
- Las miniaturas son las propias imágenes reducidas en el navegador. Con 5 MB por archivo y 10 por registro, no compensa generar versiones pequeñas.
- Si cambia el proveedor de almacenamiento, basta con cambiar las variables `STORAGE_*` y la CSP, pero los archivos ya subidos hay que copiarlos a mano.

## ADR-040: Edición en lote

**Contexto**: en un inventario es habitual cambiar lo mismo en muchos registros a la vez: marcar como agotados los productos de un proveedor, mover equipos a otra oficina o borrar una tanda de pruebas. Hasta ahora había que hacerlo registro a registro.

**Decisión**:
- **Dos rutas nuevas:** `PATCH /tables/:tableId/records/batch` (`{ ids, data }`) y `POST /tables/:tableId/records/batch-delete` (`{ ids }`).
  - El borrado es un POST y no un DELETE con cuerpo: los proxies, como la rewrite `/api` del Static Site, no están obligados a reenviar el cuerpo de un DELETE.
  - Como mucho 100 ids distintos, el tamaño máximo de una página.
  - Tienen un límite de peticiones propio, más estricto que el general.
- **Todo o nada:** una transacción con la tabla bloqueada.
  - Si un id no existe o es de otra tabla, responde 404 sin cambiar nada.
  - Los valores pasan por la misma validación que una edición normal: tipos, obligatorios, relaciones con acceso y valores únicos.
- **Valores únicos:** con varios registros, un valor no vacío en una columna única daría un duplicado seguro, así que responde 409. La interfaz no ofrece esas columnas al seleccionar más de uno.
- **Historial:** cada registro cambiado o borrado deja su evento en la actividad (ADR-025), y los cambios de stock su movimiento (ADR-024), igual que si se hubiera editado a mano.
  - Al borrar, los registros se quitan de las relaciones de otras tablas.
  - Se emite un aviso en tiempo real por cada tabla afectada, no uno por registro.
- **Interfaz:**
  - Casillas en la primera columna fija, solo para quien puede editar, y otra en la cabecera para toda la página.
  - La selección solo cuenta los registros de la página visible: cambiar de página, filtro u orden nunca actúa sobre filas que no se ven.
  - Una barra flotante abajo, para que marcar una fila no mueva la tabla, con «Cambiar un valor», «Eliminar» y «Quitar la selección».
  - El diálogo de cambio reutiliza el campo de cada tipo del formulario de registro (`ColumnValueInput`).

**Consecuencias**:
- Seleccionar más de una página a la vez queda fuera. Si hiciera falta, el siguiente paso sería «aplicar a todos los que cumplen el filtro», con su propio límite.
- Un lote de 100 registros escribe hasta 100 eventos de actividad: la historia es completa, aunque más larga.

## ADR-041: Vistas guardadas

**Contexto**: la vista de una tabla (búsqueda, filtros, orden y agrupación) ya vivía en la URL, así que se podía compartir un enlace. Pero quien vuelve cada día a «lo que está bajo mínimo» o «los equipos de la oficina de Madrid» tenía que montarla otra vez o guardar enlaces aparte.

**Decisión**:
- **Las vistas son de la tabla, no de cada persona.** En un inventario compartido, «Bajo stock» le sirve a todo el equipo.
  - Las ve y las abre cualquiera que pueda abrir la tabla.
  - Las guarda, renombra, actualiza o borra quien la edita (EDITOR), igual que los registros.
  - Las vistas personales quedan para más adelante, si hacen falta.
- **Qué se guarda:** búsqueda, filtros, orden, agrupación y tamaño de página. No la página: una vista se abre siempre por la primera.
  - El esquema es `savedViewQuerySchema`, con los mismos filtros que la URL, y se guarda como JSON en `saved_views.view`.
  - La API rechaza (400) columnas que no son de la tabla. Si una columna desaparece después, la vista sigue abriéndose y la parte que ya no encaja se descarta, como pasa con un enlace antiguo (`applicableView`).
- **API:** `GET/POST /tables/:tableId/views` y `PATCH/DELETE /tables/:tableId/views/:viewId`.
  - Nombres de 1 a 60 caracteres, sin repetirse en la tabla (409, por un índice único).
  - Como mucho 20 por tabla (422).
  - Guardar una vista no cuenta como editar la tabla: no cambia su «Editada hace…».
- **Tiempo real:** un nuevo ámbito `views` hace que los demás vuelvan a pedir la lista al momento.
- **Interfaz:** un botón «Vistas» al principio de la barra de la tabla.
  - Muestra el nombre de la vista guardada que coincide con lo que se ve; si no coincide ninguna, pone «Vistas».
  - Abrir una vista es un clic.
  - «Guardar la vista actual…» pide un nombre, y «Gestionar vistas…» permite renombrar, actualizar con lo que se ve o eliminar (con confirmación).

**Consecuencias**:
- Una vista guardada sigue siendo una URL normal al abrirla, así que se puede compartir el enlace como antes.
- Quien solo puede ver la tabla no ve el botón si no hay vistas, para no ofrecer algo que no puede usar.

## ADR-042: Asistente de IA para preguntar por los datos

**Estado**: aceptada e implementada.

**Contexto**: en un almacén o una oficina, la pregunta suele ser concreta y urgente: «¿qué está bajo mínimo en el pasillo A?», «¿cuántos taladros quedan?», «¿qué proveedor nos sirve más productos?». Hoy se responde combinando búsqueda, filtros y métricas. Un asistente que entienda la pregunta y consulte los datos ahorra esos pasos y, con voz, deja las manos libres. El proyecto es gratuito: el proveedor de IA no puede cobrar sin avisar.

**Decisión**:
- **Proveedor: Groq, plan gratuito.** Sin tarjeta, así que al pasar el límite responde 429 en vez de cobrar. No usa los datos para entrenar. Todos sus modelos admiten herramientas.
  - **Modelo por defecto:** `openai/gpt-oss-120b`, el más capaz de los gratuitos. `qwen/qwen3.8-27b` como alternativa.
  - **Configurable** con `AI_BASE_URL`, `AI_API_KEY` y `AI_MODEL`: cualquier API compatible con la de OpenAI (Gemini, por ejemplo) sirve cambiando las variables. Sin `AI_API_KEY`, el asistente no aparece.
- **El límite real son los tokens:** unos 8.000 por minuto y 200.000 al día. Una pregunta con herramientas gasta entre 3.000 y 6.000. Por eso:
  - **Respuestas de herramientas compactas:** como mucho 20 registros, solo las columnas que pide el modelo y los valores ya formateados como texto corto.
  - **Instrucciones de sistema breves** y como mucho 4 pasos de herramientas por pregunta.
  - **Conversaciones cortas:** se envían como mucho los 6 últimos mensajes.
  - **Cupo por cuenta:** 15 preguntas al día; en la demo, 5 por sesión. Se guarda en la base de datos (`assistant_usage`, por usuario y día).
    - Se cuenta con una sola sentencia (`INSERT … ON CONFLICT … WHERE count < límite`), así que dos preguntas a la vez no se saltan el límite.
    - Una pregunta que el proveedor no llegó a responder (429, caída o tiempo agotado) se devuelve al cupo.
    - **Tope común de la demo:** como mucho 30 preguntas al día entre todas las sesiones de demo (`ASSISTANT_DEMO_DAILY_TOTAL`). Las demos son gratis y anónimas: sin este tope, abrir muchas seguidas agotaría el presupuesto diario del proveedor, compartido con las cuentas registradas (auditoría de la v1.9.0).
  - **Sin cupo, o con Groq en 429:** el asistente lo dice con claridad («vuelve mañana» o «inténtalo en un minuto»), sin errores genéricos.
- **Herramientas, solo de lectura**, ejecutadas por la API **como el usuario**, con los mismos servicios y permisos de siempre:
  - `listar_tablas`: las tablas que puede abrir, con sus columnas (nombre y tipo).
  - `buscar_registros`: búsqueda, filtros y orden validados con los esquemas de siempre (`recordFilterSchema`); nunca SQL libre.
  - `resumir`: totales, medias y recuentos por grupos, con el servicio de métricas (ADR-035).
  - `bajo_minimo`: los avisos de stock (ADR-024), con todas las celdas de cada registro: así una sola llamada responde también «¿y a qué proveedor lo pido?».
  - `historial_stock`: los movimientos de un registro.
  - Cada herramienta valida sus argumentos con zod: un argumento inventado por el modelo se devuelve como error al propio modelo, no llega a la base de datos.
  - Las columnas se nombran por su nombre, no por su id, y los enlaces llegan con el nombre del registro enlazado: menos tokens y menos errores del modelo.
  - **Última vuelta sin herramientas:** si se acaban los 4 pasos, se le pide responder con lo que tiene y no se le ofrece ninguna herramienta. Con `tool_choice: "none"`, algunos modelos intentaban usar una igualmente y el proveedor rechazaba la petición.
- **Inyección de instrucciones:** los datos de las tablas los escriben usuarios, y un registro puede contener «ignora las instrucciones anteriores». Por eso:
  - Los resultados de las herramientas van marcados como datos, y las instrucciones de sistema dicen que nunca son órdenes.
  - Las instrucciones de sistema no llevan nada escrito por usuarios: de la tabla abierta solo va su id, y el nombre llega por las herramientas, como dato.
  - Aunque el modelo se dejara engañar, solo puede llamar a herramientas de lectura con los permisos del usuario: lo peor que puede pasar es una respuesta equivocada, nunca leer datos ajenos ni cambiar nada.
  - La respuesta se muestra como texto plano con enlaces a registros generados por la app, sin HTML del modelo.
- **Privacidad:**
  - Lo que se envía a Groq es la pregunta y lo que devuelven las herramientas: nombres de columnas y valores de los registros que el usuario puede ver. Nunca emails, contraseñas ni datos de otras cuentas.
  - El panel lo avisa antes de la primera pregunta, y la política de privacidad lo explicará cuando exista.
  - No se guardan las conversaciones: solo el contador de uso del día.
- **API:** `POST /assistant/chat` con `{ messages, tableId? }`.
  - Responde de una vez (sin streaming) con el texto y los registros o tablas citados, para enlazarlos.
  - Con `tableId`, el asistente empieza por esa tabla, la que el usuario tiene abierta.
  - Límite de peticiones propio, además del cupo diario.
- **Interfaz:** un panel lateral de chat desde la barra superior, con sugerencias («¿Qué está bajo mínimo?», «¿Qué proveedor tiene más productos?») y enlaces a lo que cita.
  - **Voz:** un botón de micrófono con la API de voz del navegador (gratis), y la opción de escuchar la respuesta. Solo aparece donde el navegador la ofrece. ElevenLabs queda como mejora posterior.
    - Mientras escucha, una barra muestra la onda de la voz en directo (`LiveWaveform` de ElevenLabs UI, un registro de shadcn con licencia MIT que solo usa el micrófono y un canvas) y el tiempo. Con `prefers-reduced-motion`, un texto en su lugar.
  - **Acceso:** el botón de la barra superior en el color de la marca, `Ctrl/⌘ + K` desde cualquier página y «Preguntar al asistente por esta tabla» en el menú de cada tabla. Se descartó un botón flotante: chocaría con la barra de la edición en lote y con los avisos, y en el móvil taparía la tabla.
- **Pruebas:** un modelo falso que pide herramientas según el guion de cada test, sin llamar a Groq. Así se prueban los permisos, la validación de argumentos, el cupo y la inyección de instrucciones.

**Fuera de alcance (por ahora)**:
- Herramientas que escriben, como «registra una salida de 3 taladros»: necesitarán confirmación explícita del usuario y llegarán después.
- Buscar dentro de los PDF adjuntos (RAG con `pgvector`).
- Voz con ElevenLabs.

**Consecuencias**:
- **Con el plan gratuito caben pocas preguntas al día** (unas 40-60 en total). Para un portfolio basta; si hiciera falta más, se cambia de modelo o de proveedor con las variables.
- **Las respuestas pueden equivocarse,** como cualquier modelo de lenguaje. El panel enlaza los registros en los que se basa, para comprobarlas.
- **Groq recibe datos de inventario** de quien usa el asistente. Es opcional y se avisa antes; sin la clave configurada, no existe.

## ADR-043: Exportar e importar Excel (.xlsx)

**Contexto**: el CSV que exporta Tablaria abre en Excel, pero pierde los tipos: los precios y las fechas son texto, y cada versión de Excel decide cómo leer el separador y los decimales. Al revés pasa lo mismo: la mayoría de la gente tiene su inventario en un libro de Excel, no en un CSV, y tenía que guardarlo como CSV antes de importarlo.

**Decisión**:
- **Librería: ExcelJS** (MIT), en el backend para escribir y en el frontend para leer. Es la más usada que hace las dos cosas.
  - Su última versión es de 2023, pero es estable.
  - Arrastra `uuid@8`, con un aviso (GHSA-w5hq-g745-h8pq) que solo afecta a `v3/v5/v6` cuando se les pasa un buffer. ExcelJS solo llama a `v4()` sin argumentos, así que no es alcanzable.
- **Exportar en el servidor:** `GET /records/export?format=xlsx`, con la misma vista, los mismos permisos y el mismo límite que el CSV.
  - Los números y precios se guardan como números, con la moneda en el formato de celda (`#,##0.00 "€"`).
  - Las fechas se guardan como fechas, a medianoche UTC para que se vea el mismo día en cualquier zona horaria; Sí/No y las relaciones, como texto.
  - Las consultas y los resúmenes van con el formato de la columna que muestran.
  - El texto siempre se escribe como texto: un valor que empieza por `=` nunca se convierte en una fórmula (en el CSV hacía falta neutralizarlo, ADR-021).
  - Una hoja con el nombre de la tabla (sin los caracteres que Excel no admite), cabecera fija y con filtros, y anchos ajustados al contenido.
- **Importar en el navegador:** el libro se convierte en filas de texto con el mismo formato que un CSV (números con coma decimal, fechas ISO, Sí/No), y sigue el asistente de siempre (ADR-021, ADR-036).
  - **Por qué en el navegador:** un `.xlsx` es un zip, y uno pequeño puede descomprimirse en cientos de megas («bomba zip»). Leerlo en el servidor expondría la API, que tiene poca memoria en el plan gratuito. En el navegador, como mucho se cuelga la pestaña de quien sube su propio archivo.
  - **Qué se lee:** la primera hoja con datos. De las fórmulas, su valor calculado; del texto con formato, solo el texto; los errores (`#N/A`) quedan vacíos.
  - ExcelJS se carga solo al elegir un libro: son ~250 KB comprimidos que el resto de la app no descarga.

**Consecuencias**:
- Lo exportado se vuelve a importar tal cual, en los dos formatos.
- Los libros con varias hojas solo aportan la primera con datos. Elegir la hoja queda para más adelante, si hace falta.

## ADR-044: Vista previa y filas repetidas al importar

**Contexto**: el asistente de importación (ADR-021) ya validaba cada celda y detectaba duplicados en las columnas de valor único (ADR-023). Faltaban dos cosas: ver cómo iban a quedar las filas antes de confirmar, y frenar el error más típico, importar dos veces el mismo archivo en una tabla sin columnas únicas, que duplicaba todo sin avisar.

**Decisión**:
- **Una fila es repetida** si, en todas las columnas que trae el archivo, tiene los mismos valores que un registro de la tabla o que una fila anterior del archivo.
  - Se compara la «firma» de la fila (`rowSignature`): sus valores ya convertidos (la opción con su nombre canónico, las relaciones por id, sin el orden de los enlaces), sin distinguir mayúsculas ni espacios alrededor.
  - Las columnas que el archivo no trae no cuentan, y las columnas nuevas están vacías en los registros existentes.
  - Solo cuentan las filas que añadirían un registro; las que actualizan uno por su clave (`updateBy`) no son repetidas.
- **La comprobación lo cuenta siempre** (`duplicates: { existing, inFile, rows }`, con las primeras filas). Con `skipDuplicates`, las repetidas no se importan, y el resultado dice cuántas se omitieron (`skipped`).
  - En la API, `skipDuplicates` es `false` por defecto, para no cambiar lo que ya hacía. En la interfaz viene activado, porque repetir es casi siempre un error, y se puede desactivar.
- **Vista previa en el último paso:** las 5 primeras filas bajo el nombre de la columna que llenarán, con las celdas con error marcadas (en rojo y en texto para lectores de pantalla) y las filas repetidas con «Se omite» o «Repetida».
  - Muestra el texto del archivo tal cual, sin pedir más al servidor: lo que importa es ver si cada columna va a su sitio.

**Consecuencias**:
- Comprobar e importar leen los datos de la tabla una vez más (como mucho 10.000 registros), un coste pequeño para el tamaño de las tablas.
- Dos registros legítimamente iguales (por ejemplo, dos sillas idénticas sin número de serie) necesitan desactivar la opción. Se explica junto al interruptor.

## Decisiones aceptadas para el MVP (se detallarán al implementarse)

Todas están especificadas en [MVP_PROMPT.md](MVP_PROMPT.md):

- PostgreSQL + Prisma, con los valores de los registros en JSONB, indexados por el id de la columna (no EAV).
- Filtros y orden sobre JSONB con `$queryRaw` parametrizado y lista blanca de columnas.
- Validación con esquemas zod compartidos y un `ZodValidationPipe` en lugar de DTOs con class-validator.
- Mismo origen vía `/api` (proxy de Vite en desarrollo, rewrite en producción).
- Interfaz `Mailer`: Mailpit (SMTP) en desarrollo y API de Resend en producción (implementada en la fase 2 con `fetch`, sin SDK).
- TanStack Query para el estado del servidor, react-hook-form + zod para formularios y react-i18next para i18n.
- Estado de tabla (página, orden, filtros, búsqueda) en la URL.
