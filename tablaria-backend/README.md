# tablaria-backend

API de Tablaria (NestJS 11). Consulta el [README raíz](../README.md) para la puesta en marcha.

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

La imagen de producción ([Dockerfile](Dockerfile)) contiene la API compilada, solo con dependencias de producción. Al arrancar aplica las migraciones pendientes (`prisma migrate deploy`) y después inicia la API, así que no hace falta ningún paso de migración aparte al desplegar.
