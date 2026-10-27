# wise-data-backend

API de WiseData (NestJS 11). Consulta el [README raíz](../README.md) para la puesta en marcha.

## Scripts

| Script | Descripción |
|---|---|
| `pnpm dev` | API en modo watch (puerto `PORT`, por defecto 3000) |
| `pnpm build` | Compila a `dist/` |
| `pnpm lint` | ESLint con autofix |
| `pnpm typecheck` | Comprobación de tipos |
| `pnpm test` | Tests unitarios (Jest) |
| `pnpm test:e2e` | Tests e2e (Jest + supertest) |

Variables de entorno: ver [.env.example](.env.example).

La imagen de producción ([Dockerfile](Dockerfile)) tiene dos destinos: `runtime` (la API compilada, solo con dependencias de producción) y `migrate` (aplica las migraciones y termina).
