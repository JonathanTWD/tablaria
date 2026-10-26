# WiseData

Aplicación web de gestión de inventario flexible: cada usuario crea sus propias tablas, define columnas tipadas y gestiona registros con búsqueda, filtros y orden.

> Estado: en desarrollo hacia el MVP. Consulta [docs/ROADMAP.md](docs/ROADMAP.md).

## Stack

| Paquete | Tecnologías |
|---|---|
| `wise-data-frontend/` | React 19, TypeScript, Vite, React Router, TanStack Table, Tailwind CSS 4, shadcn/ui |
| `wise-data-backend/` | NestJS 11, TypeScript, Jest |
| `packages/shared/` | Tipos y constantes compartidos entre frontend y backend |

PostgreSQL, Prisma y Docker se incorporan en la fase 1 (ver roadmap).

## Requisitos

- Node.js >= 22.12
- pnpm 10 (`corepack enable`)

## Puesta en marcha

```bash
pnpm install
pnpm dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

Copia `wise-data-backend/.env.example` a `wise-data-backend/.env` si necesitas cambiar la configuración.

## Scripts (raíz)

| Script | Descripción |
|---|---|
| `pnpm dev` | Compila `shared` y arranca todos los paquetes en modo desarrollo |
| `pnpm build` | Compila `shared`, backend y frontend |
| `pnpm lint` | ESLint en todos los paquetes |
| `pnpm typecheck` | Comprobación de tipos en todos los paquetes |
| `pnpm test` | Tests de todos los paquetes |

## Documentación

- [AGENTS.md](AGENTS.md): reglas y convenciones del proyecto.
- [docs/ROADMAP.md](docs/ROADMAP.md): funcionalidad planificada.
- [docs/DECISIONS.md](docs/DECISIONS.md): decisiones de arquitectura.
- [docs/MVP_PROMPT.md](docs/MVP_PROMPT.md): especificación del MVP.
