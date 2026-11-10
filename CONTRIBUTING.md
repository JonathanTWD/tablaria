# Contribuir a Tablaria

Gracias por querer mejorar Tablaria. Esta guía explica cómo arrancar el proyecto, cómo está organizado y qué se espera de un cambio.

## Antes de empezar

- **Para un error,** abre un issue con los pasos para reproducirlo. Si es una vulnerabilidad, no la publiques: sigue [SECURITY.md](SECURITY.md).
- **Para una función nueva,** abre primero un issue y comentamos el enfoque antes de escribir código. Tablaria prioriza un núcleo sencillo y mantenible: mira [docs/ROADMAP.md](docs/ROADMAP.md) para saber qué está planeado.
- **Normas del proyecto:** están en [AGENTS.md](AGENTS.md). Explican la arquitectura, las convenciones de código, la seguridad y qué se considera terminado. Las decisiones importantes, con su porqué, están en [docs/DECISIONS.md](docs/DECISIONS.md).

## Arrancar el proyecto

Necesitas Node.js ≥ 22.22, pnpm 10 (`corepack enable`) y Docker.

```bash
cp .env.example .env
cp tablaria-backend/.env.example tablaria-backend/.env
cp tablaria-frontend/.env.example tablaria-frontend/.env
# Rellena JWT_ACCESS_SECRET en tablaria-backend/.env (el archivo explica cómo generarlo)
docker compose up -d                          # PostgreSQL y Mailpit
pnpm install
pnpm --filter tablaria-backend db:migrate
pnpm dev
```

- **La web** queda en http://localhost:5173, y **los correos de desarrollo**, en Mailpit: http://localhost:8025.
- **Servicios externos opcionales:** el proyecto no necesita cuentas en ninguno para funcionar. Sin bucket, los adjuntos se guardan en la carpeta local `.storage`. Sin clave de Groq, el asistente no aparece. Sin Resend, los correos van a Mailpit.

## Cómo está organizado

| Carpeta | Qué contiene |
|---|---|
| `tablaria-frontend/` | React 19 + TypeScript, Vite, React Router, TanStack Query y Table, Tailwind CSS y shadcn/ui |
| `tablaria-backend/` | NestJS + Prisma sobre PostgreSQL |
| `packages/shared/` | Esquemas zod, tipos y constantes que usan los dos |
| `e2e/` | Pruebas de extremo a extremo con Playwright |
| `docs/` | Roadmap, decisiones (ADR) y diagrama de arquitectura |

## Hacer un cambio

1. **Crea una rama desde `develop`:** `feat/...`, `fix/...` o `chore/...`. `main` es solo para las releases.
2. **Haz cambios pequeños y centrados.** Reutiliza lo que ya existe antes de añadir una dependencia o una abstracción nueva.
3. **Escribe el código, los comentarios y los mensajes de commit en inglés.** La interfaz está en español, con los textos en `tablaria-frontend/src/i18n/locales/es`.
4. **Añade tests** cuando den confianza de verdad: lógica de negocio, permisos y operaciones con datos ante todo.
5. **Comprueba que todo pasa:**

   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   pnpm test:e2e        # necesita docker compose up -d
   ```

6. **Abre la pull request contra `develop`** con la plantilla rellena: qué cambia, por qué y cómo lo has probado.

### Si tu cambio toca…

- **El backend, la autenticación o el acceso a datos:** cada operación con datos de un usuario comprueba sus permisos en el backend. Valida toda entrada con los esquemas de `packages/shared` y no construyas SQL con texto del usuario.
- **La interfaz:** debe funcionar con teclado, tener etiquetas accesibles y verse bien en móvil y en tema oscuro.
- **Una página pública** (portada, ayuda o legales): se prerenderiza en el build ([ADR-050](docs/DECISIONS.md)), así que no puede leer `window` ni `localStorage` al renderizar.
- **Una función visible:** añade su guía en `/ayuda` y, si encaja, datos de ejemplo en la demo.
- **Una decisión de arquitectura:** añade un ADR en [docs/DECISIONS.md](docs/DECISIONS.md).

## Licencia

Al contribuir, aceptas que tu aportación se publique con la [licencia MIT](LICENSE) del proyecto.
