# Prompt: WiseData MVP

> Prompt para un agente de código (Claude Code / Codex) que debe llevar WiseData desde su estado actual hasta un Producto Mínimo Viable completo. Ejecutar fase por fase.

---

## Rol y meta

Eres un ingeniero full-stack senior trabajando en el repositorio **WiseData**. Tu meta es entregar un **MVP funcional, seguro y mantenible** de una aplicación web de gestión de inventario flexible: cada usuario se registra, crea sus propias tablas, define columnas tipadas y gestiona registros con búsqueda, filtros, orden y paginación en el servidor.

Antes de escribir código, lee y respeta **`AGENTS.md`** (reglas estables del proyecto). Este prompt concreta las decisiones tomadas para el MVP; si algo aquí contradice `AGENTS.md`, gana este prompt y debes registrar la decisión en `docs/DECISIONS.md`.

**Principios:** Simple > Clever · Explícito > Mágico · Validado > Asumido · MVP funcionando > features prematuras. Cambios pequeños, commits pequeños y enfocados, sin dependencias innecesarias.

---

## Estado actual del repositorio (punto de partida)

- `wise-data-frontend/`: React 19, TypeScript 6, Vite 8 (React Compiler vía Babel), React Router 8, TanStack Table 9 (instalado, sin usar), Tailwind 4, shadcn/ui estilo `base-nova` (Base UI), lucide-react, `ogl`. Solo existe la landing (`pages/Home.tsx`, `components/header/Header.tsx`, `components/home/Hero.tsx` con el fondo WebGL `components/react-bits/Lightfall.tsx`).
- `wise-data-backend/`: plantilla NestJS 11 sin modificar (`Hello World`), TypeScript 5.7, Jest.
- Sin PostgreSQL, ORM, auth, Docker, `.env.example`, `docs/ROADMAP.md` ni `docs/DECISIONS.md`. `README.MD` solo contiene una línea.
- Problemas conocidos:
  1. `pnpm build` del frontend falla: `tsconfig.app.json` usa `baseUrl` (TS5101, obsoleto en TS 6). Usa `paths` sin `baseUrl`.
  2. `pnpm lint` del frontend falla: `components/ui/button.tsx` exporta `buttonVariants` junto al componente (`react-refresh/only-export-components`).
  3. `src/lib/utils.ts` y `button.tsx` importan `cn` del paquete npm `cn`. Sustitúyelo por el `cn` estándar de shadcn (`clsx` + `tailwind-merge`) y elimina la dependencia `cn`.
  4. `Header` usa `<a href="/">` para rutas internas (debe usar `Link`), hay colores hardcodeados (`#08084d`, `#10106d`) y textos mezclados en inglés y español.
  5. Hay cambios sin commitear en la landing (rama `feat/create-home-page`): consérvalos en su propio commit antes de empezar otra cosa.

---

## Decisiones técnicas (obligatorias)

| Área | Decisión |
|---|---|
| Repo | **pnpm workspace** en la raíz: `wise-data-frontend`, `wise-data-backend`, `packages/shared`. Mantén los nombres de carpeta actuales. |
| Tipos compartidos | `packages/shared`: tipos de la API, esquemas **zod**, definición de tipos de columna y plantillas de tabla. Compílalo para que lo consuman tanto Vite (ESM) como Nest (CommonJS); verifica ambos builds. |
| Base de datos | PostgreSQL 16 + **Prisma** (migraciones versionadas en el repo). |
| Modelo de datos | Basado en metadatos. Los valores de cada registro se guardan en **JSONB** (`records.data = { [columnId]: value }`) usando el **id** de la columna como clave, nunca su nombre. |
| Validación backend | Pipe zod pequeño (`ZodValidationPipe`) que reutiliza los esquemas de `shared` en el límite de la API. Valida también params y query. |
| Auth | JWT en **cookies httpOnly**: access token (~15 min) y refresh token (~7 días, `path=/auth/refresh`) con **rotación**, guardado **hasheado** en BD y detección de reutilización (si se reutiliza un token, se revoca toda la familia). Cookies `Secure` en prod y `SameSite=Lax`. |
| Contraseñas | **argon2id**. |
| Email | Interfaz `Mailer` con dos implementaciones seleccionadas por variable de entorno: **SMTP (Nodemailer) → Mailpit** en desarrollo (Docker) y **API HTTP de Resend** en producción (muchos hostings gratuitos bloquean SMTP saliente). |
| Mismo origen | El frontend llama siempre a rutas relativas **`/api/...`**; el backend usa el prefijo global `api`. En dev lo resuelve el **proxy de Vite**; en prod, un rewrite/reverse proxy. Así las cookies httpOnly `SameSite=Lax` funcionan igual en todos los entornos. |
| Server state | **TanStack Query**. Nada de copiar datos del servidor a `useState` o contextos. |
| Formularios | **react-hook-form + zod** (`@hookform/resolvers`) con los mismos esquemas de `shared`, usando componentes shadcn. |
| i18n | **react-i18next**: español por defecto, archivos JSON por namespace, ningún texto de UI hardcodeado. El inglés se añadirá después sin tocar componentes. |
| Tablas UI | **TanStack Table** en modo manual (`manualPagination`, `manualSorting`, `manualFiltering`). El estado de búsqueda, filtros, orden y página vive en la **URL** (search params). |
| Estilo | App autenticada **limpia tipo SaaS** (estilo Linear/Notion): neutra, densa, legible, con acentos azul-violeta de la marca. **Tema claro y oscuro** con toggle (preferencia del sistema por defecto, persistida), usando los tokens CSS de shadcn y no hex sueltos. La landing conserva su estética oscura con Lightfall. |
| Docker | `docker-compose.yml` para **dev** (Postgres + Mailpit, con front y back en hot reload) y **Dockerfiles multi-stage** + compose de **prod**. Nada hardcodeado: todo por `.env` y `.env.example`. |
| Seguridad base | `helmet`, CORS con lista blanca de orígenes y `credentials: true`, `@nestjs/throttler` (límites estrictos en login, registro, reset y reenvío de email), filtro global de excepciones sin stack traces ni errores SQL, comprobación de ownership en **cada** query. |

---

## Modelo de datos (orientativo, ajústalo con criterio)

- `User`: id (uuid), email (único, normalizado en minúsculas), passwordHash, emailVerifiedAt, createdAt, updatedAt.
- `RefreshToken`: id, userId, tokenHash, familyId, expiresAt, revokedAt, replacedById, createdAt.
- `EmailToken`: id, userId, type (`VERIFY_EMAIL` | `RESET_PASSWORD`), tokenHash, expiresAt, usedAt.
- `InventoryTable`: id, ownerId, name, description, createdAt, updatedAt.
- `Column`: id, tableId, name, type, position, required, defaultValue (JSONB), options (JSONB, para `select` y moneda), createdAt, updatedAt. Nombre único por tabla.
- `Record`: id, tableId, data (JSONB), createdAt, updatedAt. Índice GIN sobre `data`.

Todos los borrados de tabla, columna y registro son en cascada y requieren confirmación en la UI.

---

## Tipos de columna del MVP

`text`, `number`, `date`, `boolean`, `select` (opciones predefinidas con etiqueta y color), `currency` (número con código ISO 4217 en `options`, formateado con `Intl.NumberFormat`).

Define cada tipo **en un solo lugar de `shared`** (un mapa `tipo → esquema zod de valor + operadores de filtro permitidos`) para que añadir tipos nuevos más adelante sea trivial. No construyas un sistema de plugins.

---

## API REST (mínimo)

```text
POST   /auth/register            POST /auth/login           POST /auth/logout
POST   /auth/refresh             GET  /auth/me
POST   /auth/verify-email        POST /auth/resend-verification
POST   /auth/forgot-password     POST /auth/reset-password

GET    /dashboard/summary

GET    /tables                   POST   /tables            (opcional: templateId)
GET    /tables/:tableId          PATCH  /tables/:tableId   DELETE /tables/:tableId

GET    /tables/:tableId/columns  POST   /tables/:tableId/columns
PATCH  /tables/:tableId/columns/:columnId                  DELETE …/:columnId
PATCH  /tables/:tableId/columns/order                      (reordenar)

GET    /tables/:tableId/records  ?page&pageSize&search&sort&filters
POST   /tables/:tableId/records
PATCH  /tables/:tableId/records/:recordId                  DELETE …/:recordId
```

Requisitos:
- Respuestas y errores con forma consistente (`{ data, meta }` en listados paginados y un formato único de error). Códigos HTTP correctos (400/401/403/404/409/422/429).
- Un recurso de otro usuario responde **404** (no filtrar su existencia).
- Los mensajes de forgot-password y resend nunca revelan si el email existe.
- **Consultas JSONB**: Prisma no ordena ni filtra bien por rutas JSON, así que usa `$queryRaw` con `Prisma.sql` **parametrizado**. Los ids de columna usados en `sort` y `filters` se validan contra las columnas reales de la tabla (lista blanca) antes de construir SQL. Nunca concatenes input del usuario. Usa cast por tipo (numérico, fecha, booleano) para ordenar y comparar correctamente.
- `pageSize` máximo 100. La búsqueda de texto aplica `ILIKE` sobre columnas `text` y `select`.
- Al crear o editar registros, valida `data` contra las columnas de la tabla: solo ids existentes, valor válido según el tipo, `required` respetado y `defaultValue` aplicado.
- **Cambio de tipo de columna**: dentro de una transacción, convierte los valores existentes; los que no se puedan convertir pasan a `null` y la respuesta indica cuántos se vieron afectados. La UI avisa antes de confirmar.
- Borrar una columna elimina su clave de `data` en todos los registros (en una transacción).

---

## Frontend (rutas y pantallas)

```text
/                      Landing (pública)
/login  /register      Auth (públicas; redirigen a /app si ya hay sesión)
/verify-email          Confirmación con token
/forgot-password  /reset-password
/app                   AppLayout (protegido): sidebar + topbar + toggle de tema + menú de usuario
  /app                 Dashboard
  /app/tables/:tableId Vista de tabla
  /app/settings        Perfil básico y cerrar sesión
*                      404
```

- **Landing**: conserva Header y Hero (Lightfall) y complétala en español con las secciones Features, About y un CTA final. Los botones llevan a `/register` y `/login` con `Link`. Responsive y accesible. Respeta `prefers-reduced-motion` (pausar Lightfall).
- **Auth**: formularios con validación, estados de carga y error, aviso de "verifica tu email" con reenvío. El login no se permite hasta verificar el email.
- **Sesión**: cliente `fetch` con `credentials: 'include'` que, ante un 401, intenta `/auth/refresh` **una sola vez** (deduplicando peticiones concurrentes) y, si falla, redirige a `/login`. Rutas protegidas con un layout guard basado en `/auth/me`. Recuerda que esto es solo UX: el backend es quien autoriza.
- **Dashboard**:
  - Métricas simples: nº de tablas, nº total de registros y tablas editadas recientemente (por `updatedAt`, sin sistema de auditoría).
  - Lista o tarjetas de tablas con nº de registros y última edición.
  - Accesos rápidos: crear tabla y abrir recientes.
  - **Crear tabla desde plantilla**: 3 plantillas definidas en `shared` (Inventario básico, Catálogo de productos, Equipos/activos) más la opción "tabla vacía".
- **Vista de tabla**:
  - TanStack Table con paginación, orden por columna, búsqueda global con debounce, filtros por columna según el tipo (texto contiene; número y moneda con rango; fecha con rango; booleano; select con una o varias opciones). Todo sincronizado con la URL.
  - **Edición inline** de celdas con un editor adecuado a cada tipo (guardar con Enter o al perder el foco, cancelar con Esc, actualización optimista con rollback si falla) y **diálogo** para crear o editar un registro completo.
  - Gestión de columnas: crear, renombrar, cambiar tipo (con aviso), marcar como obligatoria o con valor por defecto, editar opciones de `select` y moneda, reordenar (drag & drop o botones subir/bajar, sin librerías pesadas) y borrar con confirmación.
  - Renombrar y borrar la tabla con confirmación.
  - Estados vacíos, de carga (skeletons) y de error en todas las pantallas. Toasts para el feedback (shadcn `sonner`).
- **Responsive**: sidebar colapsable en móvil y tabla con scroll horizontal.
- **Estructura**: `src/{components,features/{auth,dashboard,tables,records,columns},layouts,pages,routes,hooks,lib,i18n,types}`.

---

## Testing y CI

- **Backend (Jest)**:
  - Tests unitarios de la validación de valores por tipo, la conversión al cambiar el tipo de columna y la construcción segura de filtros y orden.
  - **e2e con supertest** sobre una Postgres de test: registro, verificación, login, refresh con rotación y reuse detection, logout, reset de contraseña, rate limiting, y **acceso entre usuarios** (el usuario B no puede leer ni modificar tablas, columnas o registros de A) para cada endpoint.
- **Frontend (Vitest + Testing Library)**: formularios de auth, edición inline de celda, filtros y orden reflejados en la URL, y el toggle de tema.
- **E2E (Playwright)**: registro → verificación (leyendo el correo vía la API de Mailpit) → login → crear tabla desde plantilla → añadir columna → crear, editar inline, filtrar, ordenar y borrar un registro → logout.
- **GitHub Actions**: en cada PR ejecutar install, lint, typecheck, build de los tres paquetes, tests unitarios y e2e del backend (con un service de Postgres) y Playwright (puede ir en un job aparte).
- No escribas tests para inflar la cobertura: prueba comportamiento.

---

## Documentación

- `README.md` raíz: qué es WiseData, stack, requisitos, cómo arrancar con Docker y sin Docker, variables de entorno, scripts y cómo ejecutar los tests. Sustituye los README de plantilla de Vite y Nest por versiones breves y propias.
- `docs/DECISIONS.md` (formato ADR corto): workspace + shared, Prisma, JSONB vs EAV, consultas raw parametrizadas, cookies httpOnly + rotación, validación con zod en lugar de class-validator, interfaz Mailer (Mailpit/Resend API), mismo origen vía `/api`, TanStack Query, estado de tabla en la URL y react-i18next.
- `docs/ROADMAP.md`: MVP (marcado por fases) y futuro (colaboración en tiempo real, permisos avanzados, historial de actividad, import/export CSV, más tipos de columna, IA).
- `.env.example` en la raíz y por paquete donde haga falta. **Nunca** commitear `.env` ni secretos.

---

## Plan por fases (un PR por fase, cada fase deja el proyecto compilando y con tests en verde)

0. **Saneamiento**: commitear el trabajo pendiente de la landing, arreglar el build (`baseUrl`) y el lint (`buttonVariants`), cambiar `cn` por clsx + tailwind-merge, alinear la versión de TypeScript, crear el pnpm workspace y `packages/shared`, y añadir `docs/`, `.env.example` y el README.
1. **Infra**: docker-compose de dev (Postgres + Mailpit), Prisma con el schema y la migración inicial, configuración validada por env (`@nestjs/config` + zod), helmet, CORS, throttler, filtro de errores global y `ZodValidationPipe`.
2. **Auth backend** completo y sus tests e2e.
3. **Frontend base**: router con layouts, i18n, tema claro/oscuro, cliente API + TanStack Query, páginas de auth, guard y landing completada.
4. **Tablas y columnas** (backend + UI): CRUD, plantillas, reordenar, cambio de tipo y dashboard.
5. **Registros**: CRUD, consultas JSONB paginadas con búsqueda, filtros y orden, TanStack Table con edición inline y diálogo.
6. **Calidad y entrega**: tests frontend, Playwright, GitHub Actions, Dockerfiles y compose de prod, pulido responsive y de accesibilidad, y documentación final.
7. **Despliegue (opcional, después del MVP local)**: no lo implementes salvo que se pida. Opción candidata gratuita: frontend en Render Static Site con rewrite `/api/*` → backend, backend en Render Web Service (free, con cold starts), PostgreSQL en Neon y email con la API de Resend. Recógelo en `docs/ROADMAP.md`.

Al terminar cada fase informa: qué se hizo, qué decisiones se tomaron (y si quedaron en `DECISIONS.md`), qué comandos verificaste y qué queda pendiente o es un riesgo.

---

## Fuera de alcance (no implementar)

Colaboración en tiempo real, presencia, permisos o compartición entre usuarios, historial o auditoría, notificaciones, import/export, analítica avanzada, IA, modo offline, OAuth/social login y pagos.

---

## Definición de "MVP terminado"

- [ ] `docker compose up` levanta un entorno de desarrollo funcional desde cero siguiendo el README.
- [ ] Un usuario nuevo puede registrarse, verificar su email, iniciar sesión, recuperar la contraseña y cerrar sesión.
- [ ] Puede crear tablas (vacías o desde plantilla), gestionar columnas de los 6 tipos y hacer CRUD de registros con edición inline y en diálogo.
- [ ] Búsqueda, filtros por tipo, orden y paginación funcionan en el servidor y se reflejan en la URL.
- [ ] El dashboard muestra métricas, tablas, recientes y accesos rápidos.
- [ ] Ningún usuario puede acceder a datos de otro (cubierto por tests e2e).
- [ ] UI en español vía i18n, tema claro/oscuro, responsive, con estados de carga, vacío y error.
- [ ] Lint, typecheck, build y todos los tests pasan en CI. No hay `any` injustificados, `console.log` ni secretos.
- [ ] `README.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md` y `.env.example` están al día.
