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
  - ordenar y filtrar por un resumen (400), porque hoy se calcula por página y no en el SQL de la lista;
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

## Decisiones aceptadas para el MVP (se detallarán al implementarse)

Todas están especificadas en [MVP_PROMPT.md](MVP_PROMPT.md):

- PostgreSQL + Prisma, con los valores de los registros en JSONB, indexados por el id de la columna (no EAV).
- Filtros y orden sobre JSONB con `$queryRaw` parametrizado y lista blanca de columnas.
- Validación con esquemas zod compartidos y un `ZodValidationPipe` en lugar de DTOs con class-validator.
- Mismo origen vía `/api` (proxy de Vite en desarrollo, rewrite en producción).
- Interfaz `Mailer`: Mailpit (SMTP) en desarrollo y API de Resend en producción (implementada en la fase 2 con `fetch`, sin SDK).
- TanStack Query para el estado del servidor, react-hook-form + zod para formularios y react-i18next para i18n.
- Estado de tabla (página, orden, filtros, búsqueda) en la URL.
