# Decisiones de arquitectura

Registro breve de decisiones (formato ADR). Cada entrada indica contexto, decisión y consecuencias.

## ADR-001: pnpm workspace con paquete `shared`

- **Contexto**: frontend y backend deben compartir los tipos de la API, los esquemas de validación y los tipos de columna sin duplicarlos.
- **Decisión**: pnpm workspace en la raíz (`wise-data-frontend`, `wise-data-backend`, `packages/*`) con un único lockfile. `@wisedata/shared` se compila con `tsc` dos veces: a ESM (para Vite) y a CommonJS (para Nest y Jest), expuestos mediante `exports` condicionales.
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
- **Decisión**: un `AllExceptionsFilter` global convierte todo a `ApiErrorBody` (`statusCode`, `error`, `message`, `details?`), tipo definido en `@wisedata/shared`. Los errores de Prisma P2002 pasan a 409 y P2025 a 404; cualquier otro error pasa a un 500 genérico y se registra en el log.
- **Consecuencias**: el frontend puede tratar todos los errores con un único tipo. Los errores de validación del `ZodValidationPipe` llegan como 400 con `details` por campo.

## ADR-007: Configuración validada con zod y seguridad HTTP base

- **Decisión**: `@nestjs/config` (línea 4.x, CommonJS, compatible con Nest 11; la 12 es solo ESM y está pensada para Nest 12) con `validate` basado en un esquema zod. La app no arranca si falta o es inválida alguna variable. `helmet`, CORS con lista blanca (`CORS_ORIGINS`) y `credentials: true`, prefijo global `/api` y `@nestjs/throttler` global (100 peticiones/min; los límites estrictos de auth llegan en la fase 2). `/api/health` comprueba la base de datos y no está sujeto a throttling. `TRUST_PROXY_HOPS` configura `trust proxy` de Express para que el rate limiter use la IP real del cliente detrás del rewrite de producción; en local es 0.
- **Consecuencias**: la configuración HTTP vive en `configureApp()` (`src/app.setup.ts`) y la comparten `main.ts` y los tests e2e.

## ADR-008: Autenticación con cookies httpOnly y refresh tokens rotatorios

- **Contexto**: la autenticación es la parte más sensible del MVP y la sesión debe sobrevivir a XSS en el frontend.
- **Decisión**:
  - **Access token**: JWT HS256 de 15 min en la cookie `wd_access` (path `/api`).
  - **Refresh token**: token opaco aleatorio de 256 bits en la cookie `wd_refresh` (path `/api/auth`, 7 días). Solo se guarda su hash SHA-256.
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
  - react-hook-form con los esquemas zod de `@wisedata/shared` y validación al salir del campo (`onTouched`).
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

- **Definición de columnas en un solo sitio**: `@wisedata/shared` define, para cada tipo, el esquema de su valor y de sus ajustes (`options`), y un `columnDefinitionSchema` con unión discriminada por `type`. La API y el formulario validan con el mismo esquema.
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

- **Validación**: `recordDataSchema(columns)` en `@wisedata/shared` valida los datos de un registro contra las columnas de su tabla. Rechaza ids de columna desconocidos, valores que no encajan con el tipo y opciones que no existen, y exige las columnas obligatorias. Al crear, lo que falta toma el valor por defecto; al editar, solo se validan las celdas enviadas, y `null` vacía la celda. Las celdas vacías no se guardan: la clave desaparece de `data`.
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
  - **Correo:** Resend, desde `mail.wise-data.es`.
  - **Dominio:** `wise-data.es`, en IONOS.
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
- **Vista previa al compartir**: metaetiquetas Open Graph y de X/Twitter en `index.html` (los rastreadores no ejecutan JavaScript), con una imagen de 1200×630 generada desde `wise-data-frontend/og/og-image.html`. El favicon pasa a ser el icono de WiseData.
- **Diagnóstico del proxy**: cada petición bloqueada por el límite de peticiones deja en el log la IP con la que se contó. Si no coincide con la IP pública del cliente, `TRUST_PROXY_HOPS` no está bien ajustado.

## ADR-014: Exportación de registros

- **En el servidor**: `GET /tables/:tableId/records/export` reutiliza la consulta parametrizada del listado (búsqueda, filtros y orden, con la misma lista blanca de columnas), pero sin paginar. Así se exportan todos los registros que coinciden, hasta el máximo de 10.000 por tabla, no solo la página visible. Tiene un límite propio de 10 exportaciones por minuto.
- **CSV para Excel en español**: separador `;` y coma decimal, porque es lo que Excel espera en España y en la mayoría de locales europeos al abrir un CSV con doble clic. Las comillas siguen RFC 4180, con CRLF y BOM UTF-8 para que se vean bien los acentos y el €. Las columnas de precio llevan la moneda en la cabecera («Precio (EUR)»), los booleanos van como Sí/No y las fechas en ISO.
- **Inyección de fórmulas**: cualquier celda o nombre de columna que empiece por `=`, `+`, `-`, `@`, tabulador o retorno lleva delante un `'`, así la hoja de cálculo lo muestra como texto. Los números negativos no se tocan, porque se escriben como números.
- **Descarga en el cliente**: `apiDownload` usa el mismo flujo que el resto de peticiones (renovación de la sesión ante un 401) y guarda el archivo con el nombre que sugiere la API, que es un nombre ASCII derivado de la tabla y la fecha.
- **Excel pendiente**: ExcelJS no se puede añadir hasta que las versiones que Dependabot fijó en el lockfile cumplan la antigüedad mínima de 14 días de pnpm (`minimumReleaseAge`). Para que no vuelva a pasar, Dependabot usa ahora un `cooldown` de 14 días, y `@rolldown/*` tiene una excepción porque publica builds nativos con mucha frecuencia.

## ADR-015: Alertas de stock bajo

- **Umbral en la columna**: el umbral vive en `options.alertBelow` de las columnas numéricas (nulo si no avisa), dentro del mismo esquema zod compartido. No hace falta migración, porque las opciones ya se guardan como JSON, y lo valida la API como cualquier otra opción. No se aplica a precios: un precio bajo no es una alerta.
- **Una sola regla**: `stockLevel()` en `@wisedata/shared` decide si un valor está bien, bajo (por debajo del umbral) o agotado (0 o menos). La tabla lo usa para marcar las celdas y la API aplica la misma comparación en SQL.
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
- **Estado en `localStorage`** (`wisedata:sidebar-open`) en lugar de la cookie `sidebar_state` del componente original. Es una app de navegador sin renderizado en servidor, y la cookie solo viajaría a la API en cada petición.
- **Instalación manual**: `shadcn add sidebar` intentaba volver a resolver dependencias y chocaba con la antigüedad mínima de pnpm. Por eso `sidebar.tsx` se copió del registro, cambiando solo:
  - las rutas de importación;
  - la cookie, que se quita;
  - los textos para lectores de pantalla, que ahora llegan traducidos desde la app;
  - `useIsMobile`, que se reescribe con `useSyncExternalStore`.

  Las demás dependencias del componente (`Sheet`, `Tooltip`, `Button`…) ya estaban en el proyecto.
- **Atajo `Ctrl/⌘ + B`**: es el del componente. En Firefox ese atajo abre la barra de marcadores, y dentro de la app queda bloqueado. Como lleva tecla modificadora, no choca con WCAG 2.1.4.

## Decisiones aceptadas para el MVP (se detallarán al implementarse)

Todas están especificadas en [MVP_PROMPT.md](MVP_PROMPT.md):

- PostgreSQL + Prisma, con los valores de los registros en JSONB, indexados por el id de la columna (no EAV).
- Filtros y orden sobre JSONB con `$queryRaw` parametrizado y lista blanca de columnas.
- Validación con esquemas zod compartidos y un `ZodValidationPipe` en lugar de DTOs con class-validator.
- Mismo origen vía `/api` (proxy de Vite en desarrollo, rewrite en producción).
- Interfaz `Mailer`: Mailpit (SMTP) en desarrollo y API de Resend en producción (implementada en la fase 2 con `fetch`, sin SDK).
- TanStack Query para el estado del servidor, react-hook-form + zod para formularios y react-i18next para i18n.
- Estado de tabla (página, orden, filtros, búsqueda) en la URL.
