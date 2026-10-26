# WiseData

Aplicación web de gestión de inventario flexible: cada usuario crea sus propias tablas, define columnas tipadas y gestiona registros con búsqueda, filtros y orden.

> Estado: en desarrollo hacia el MVP. Consulta [docs/ROADMAP.md](docs/ROADMAP.md).

## Stack

| Paquete | Tecnologías |
|---|---|
| `wise-data-frontend/` | React 19, TypeScript, Vite, React Router, TanStack Table, Tailwind CSS 4, shadcn/ui |
| `wise-data-backend/` | NestJS 11, TypeScript, Prisma 7, PostgreSQL 16, zod, Jest |
| `packages/shared/` | Tipos y constantes compartidos entre frontend y backend |

Docker Compose levanta los servicios de desarrollo: PostgreSQL y Mailpit (correo de pruebas).

## Requisitos

- Node.js >= 22.12
- pnpm 10 (`corepack enable`)
- Docker Desktop (o Docker Engine + Compose v2)

## Puesta en marcha

```bash
cp .env.example .env
cp wise-data-backend/.env.example wise-data-backend/.env
docker compose up -d
pnpm install
pnpm --filter wise-data-backend db:migrate
pnpm dev
```

| Servicio | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API (a través del proxy de Vite) | http://localhost:5173/api |
| API (directa) | http://localhost:3000/api |
| Health check | http://localhost:3000/api/health |
| Mailpit (bandeja de correo de pruebas) | http://localhost:8025 |
| PostgreSQL | `localhost:5433` |

El frontend llama siempre a rutas relativas `/api/...`; en desarrollo Vite las redirige al backend (`API_PROXY_TARGET`, ver `wise-data-frontend/.env.example`).

### Base de datos

| Comando | Descripción |
|---|---|
| `pnpm --filter wise-data-backend db:migrate` | Crea y aplica migraciones en desarrollo (`prisma migrate dev`) |
| `pnpm --filter wise-data-backend db:deploy` | Aplica migraciones pendientes (CI/producción) |
| `pnpm --filter wise-data-backend db:studio` | Abre Prisma Studio |

El cliente de Prisma se genera en `wise-data-backend/src/generated` al instalar dependencias y al compilar; no se versiona.

## Scripts (raíz)

| Script | Descripción |
|---|---|
| `pnpm dev` | Compila `shared` y arranca todos los paquetes en modo desarrollo |
| `pnpm build` | Compila `shared`, backend y frontend |
| `pnpm lint` | ESLint en todos los paquetes |
| `pnpm typecheck` | Comprobación de tipos en todos los paquetes |
| `pnpm test` | Tests unitarios de todos los paquetes |

Los tests e2e del backend necesitan la base de datos levantada: `pnpm --filter wise-data-backend test:e2e`.

## Documentación

- [AGENTS.md](AGENTS.md): reglas y convenciones del proyecto.
- [docs/ROADMAP.md](docs/ROADMAP.md): funcionalidad planificada.
- [docs/DECISIONS.md](docs/DECISIONS.md): decisiones de arquitectura.
- [docs/MVP_PROMPT.md](docs/MVP_PROMPT.md): especificación del MVP.
