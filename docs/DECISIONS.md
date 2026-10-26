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
- **Consecuencias**: los componentes de shadcn se comportan como espera su documentación.

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
- **Contraseñas**: argon2id con los parámetros mínimos de OWASP (19 MiB, t=2, p=1) mediante `@node-rs/argon2`. El paquete `argon2` (node-gyp) provoca un segfault al cargarse en Windows con Node 22. Al resetear la contraseña se cierran todas las sesiones y se marca el email como verificado.
- **Rate limiting**: 5 peticiones/min por IP en los endpoints que comprueban credenciales o envían correos, y 30/min en `refresh`.
- **Versiones**: `@nestjs/jwt` 11 y `nodemailer` 9, porque las mayores siguientes solo se distribuyen como ESM.

## ADR-009: Base de datos aislada para los tests e2e

- **Decisión**:
  - **Base propia**: los e2e usan `TEST_DATABASE_URL`. El setup se niega a arrancar si el nombre de la base no termina en `_test`, la crea y la migra con `prisma migrate deploy`, y la vacía (`TRUNCATE users CASCADE`) antes de cada test.
  - **Ejecución en serie**: los tests corren en un solo worker.
  - **Rate limiting**: cada cliente de test usa su propia IP vía `X-Forwarded-For` (`TRUST_PROXY_HOPS=1`), así los límites no se mezclan entre tests y se prueba la configuración de proxy.
- **Consecuencias**: ejecutar los e2e nunca toca los datos de desarrollo.

## Decisiones aceptadas para el MVP (se detallarán al implementarse)

Todas están especificadas en [MVP_PROMPT.md](MVP_PROMPT.md):

- PostgreSQL + Prisma, con los valores de los registros en JSONB, indexados por el id de la columna (no EAV).
- Filtros y orden sobre JSONB con `$queryRaw` parametrizado y lista blanca de columnas.
- Validación con esquemas zod compartidos y un `ZodValidationPipe` en lugar de DTOs con class-validator.
- Mismo origen vía `/api` (proxy de Vite en desarrollo, rewrite en producción).
- Interfaz `Mailer`: Mailpit (SMTP) en desarrollo y API de Resend en producción (implementada en la fase 2 con `fetch`, sin SDK).
- TanStack Query para el estado del servidor, react-hook-form + zod para formularios y react-i18next para i18n.
- Estado de tabla (página, orden, filtros, búsqueda) en la URL.
