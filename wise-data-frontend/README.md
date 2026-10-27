# wise-data-frontend

Cliente web de WiseData (React 19, Vite, Tailwind CSS 4, shadcn/ui). Consulta el [README raíz](../README.md) para la puesta en marcha.

## Scripts

| Script | Descripción |
|---|---|
| `pnpm dev` | Servidor de desarrollo de Vite |
| `pnpm build` | Typecheck y build de producción |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Comprobación de tipos |
| `pnpm test` | Tests con Vitest y Testing Library |
| `pnpm preview` | Sirve el build localmente |

Los componentes de shadcn/ui se añaden con `pnpm dlx shadcn@latest add <componente>` y viven en `src/components/ui`.

La imagen de producción ([Dockerfile](Dockerfile)) sirve el build con nginx y redirige `/api` a la API ([nginx.conf.template](nginx.conf.template)).
