# WiseData

Gestión de inventario flexible: cada usuario crea sus propias tablas, define columnas con tipo y trabaja con sus registros como en una hoja de cálculo, pero con validación, búsqueda, filtros y orden en el servidor.

## Funcionalidades

- **Cuentas**: registro con verificación por email, inicio de sesión, recuperación de contraseña y sesiones con cookies httpOnly y refresh tokens rotatorios.
- **Tablas**: crear en blanco o desde plantilla (inventario básico, catálogo de productos, equipos y activos), renombrar y borrar.
- **Columnas** de seis tipos: texto, número, fecha, sí/no, lista de opciones con colores y precio en cualquier moneda. Se pueden marcar como obligatorias, tener valor por defecto, reordenarse y cambiar de tipo convirtiendo los valores guardados.
- **Registros**: edición directa en la celda (Enter guarda, Escape cancela), formulario completo, búsqueda, filtros por tipo, orden y paginación. La vista vive en la URL, así que se puede compartir.
- **Dashboard** con métricas y tablas recientes, tema claro u oscuro, interfaz en español preparada para más idiomas y diseño adaptado a móvil.

## Stack

| Paquete | Tecnologías |
|---|---|
| `wise-data-frontend/` | React 19, TypeScript, Vite, React Router, TanStack Query y Table, react-hook-form, Tailwind CSS 4, shadcn/ui (Base UI), react-i18next |
| `wise-data-backend/` | NestJS 11, TypeScript, Prisma 7, PostgreSQL 16, zod |
| `packages/shared/` | Esquemas zod, tipos y constantes compartidos por frontend y backend |
| `e2e/` | Playwright |

Los valores de los registros se guardan en JSONB, indexados por el id de la columna. Las consultas de búsqueda, filtro y orden son SQL parametrizado, construido solo con columnas que existen en la tabla. Las decisiones de diseño están explicadas en [docs/DECISIONS.md](docs/DECISIONS.md).

## Probarlo con Docker (todo incluido)

Solo necesitas Docker. Levanta la base de datos, aplica las migraciones y arranca la API y la web detrás de nginx:

```bash
cp .env.prod.example .env.prod
# Rellena POSTGRES_PASSWORD y JWT_ACCESS_SECRET (el archivo explica cómo generarlos)
docker compose -f docker-compose.prod.yml --env-file .env.prod --profile mailpit up -d --build
```

- **WiseData**: http://localhost:8080
- **Correos** (verificación de cuenta, recuperación de contraseña): http://localhost:8025, gracias a Mailpit (`--profile mailpit`). Para enviar correos de verdad, configura `MAIL_TRANSPORT=resend` y `RESEND_API_KEY`.

La web y la API comparten origen: nginx sirve la aplicación y redirige `/api` a la API, así las cookies de sesión funcionan sin configurar CORS.

Las cookies de sesión son `Secure`: funcionan con HTTPS y en `http://localhost`. Para servirlo por HTTP desde otro equipo de tu red, pon `COOKIE_SECURE=false` en `.env.prod`.

## Desarrollo

Requisitos: Node.js ≥ 22.12, pnpm 10 (`corepack enable`) y Docker.

```bash
cp .env.example .env
cp wise-data-backend/.env.example wise-data-backend/.env
# Rellena JWT_ACCESS_SECRET en wise-data-backend/.env
docker compose up -d                          # PostgreSQL y Mailpit
pnpm install
pnpm --filter wise-data-backend db:migrate
pnpm dev
```

| Servicio | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API (a través del proxy de Vite) | http://localhost:5173/api |
| API (directa) | http://localhost:3000/api |
| Mailpit | http://localhost:8025 |
| PostgreSQL | `127.0.0.1:5433` (usa la IP: el puerto solo escucha en IPv4) |

El frontend llama siempre a rutas relativas `/api/...`. En desarrollo Vite las redirige a la API (`API_PROXY_TARGET`) y en producción lo hace nginx.

### Scripts (raíz)

| Script | Descripción |
|---|---|
| `pnpm dev` | Compila `shared` y arranca todos los paquetes en modo desarrollo |
| `pnpm build` | Compila `shared`, backend y frontend |
| `pnpm lint` | ESLint en todos los paquetes |
| `pnpm typecheck` | Comprobación de tipos en todos los paquetes |
| `pnpm test` | Tests unitarios (Jest en el backend, Vitest en el frontend) |
| `pnpm test:e2e` | Tests e2e del backend y flujo completo con Playwright |

### Base de datos

| Comando | Descripción |
|---|---|
| `pnpm --filter wise-data-backend db:migrate` | Crea y aplica migraciones en desarrollo |
| `pnpm --filter wise-data-backend db:deploy` | Aplica migraciones pendientes (CI y producción) |
| `pnpm --filter wise-data-backend db:studio` | Abre Prisma Studio |

## Tests

- **Backend, unitarios (Jest)**: conversión de valores entre tipos, construcción segura de consultas, validación de entorno, filtro de errores.
- **Backend, e2e (Jest + supertest)**: autenticación completa (incluidos la reutilización de refresh tokens y el rate limiting), tablas, columnas y registros, y que ningún usuario pueda leer ni modificar los datos de otro en ningún endpoint. Usan su propia base de datos (`TEST_DATABASE_URL`, que debe terminar en `_test`) y leen los correos desde Mailpit.
- **Frontend (Vitest + Testing Library)**: formularios de acceso, edición en celda, vista de registros en la URL y tema.
- **Playwright (`e2e/`)**: registro, verificación por email, crear una tabla desde plantilla, añadir una columna, crear, editar, filtrar, ordenar y borrar registros, y cerrar sesión. Reutiliza `pnpm dev` si ya está en marcha; `E2E_BASE_URL` permite lanzarlo contra otra instancia, como el stack de Docker.

GitHub Actions ejecuta en cada pull request el lint, el typecheck, el build y los tests unitarios, los e2e del backend con PostgreSQL y Mailpit, y el flujo de Playwright.

## Documentación

- [docs/ROADMAP.md](docs/ROADMAP.md): fases del MVP y funcionalidad futura.
- [docs/DECISIONS.md](docs/DECISIONS.md): decisiones de arquitectura (ADR).
- [AGENTS.md](AGENTS.md): reglas y convenciones del proyecto.
