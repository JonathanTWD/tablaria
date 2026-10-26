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

## Decisiones aceptadas para el MVP (se detallarán al implementarse)

Todas están especificadas en [MVP_PROMPT.md](MVP_PROMPT.md):

- PostgreSQL + Prisma, con los valores de los registros en JSONB, indexados por el id de la columna (no EAV).
- Filtros y orden sobre JSONB con `$queryRaw` parametrizado y lista blanca de columnas.
- Validación con esquemas zod compartidos y un `ZodValidationPipe` en lugar de DTOs con class-validator.
- JWT en cookies httpOnly con rotación de refresh tokens y detección de reutilización. Contraseñas con argon2id.
- Mismo origen vía `/api` (proxy de Vite en desarrollo, rewrite en producción).
- Interfaz `Mailer`: Mailpit (SMTP) en desarrollo y API de Resend en producción.
- TanStack Query para el estado del servidor, react-hook-form + zod para formularios y react-i18next para i18n.
- Estado de tabla (página, orden, filtros, búsqueda) en la URL.
