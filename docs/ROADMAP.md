# Roadmap

La especificación completa del MVP está en [MVP_PROMPT.md](MVP_PROMPT.md).

## MVP

- [x] **Fase 0 — Saneamiento**: build y lint en verde, `cn` estándar, pnpm workspace con `packages/shared`, TypeScript 6 en todos los paquetes, documentación base.
- [ ] **Fase 1 — Infraestructura**: Docker Compose de desarrollo (PostgreSQL + Mailpit), Prisma, configuración validada, seguridad base (helmet, CORS, throttler), filtro de errores y validación con zod.
- [ ] **Fase 2 — Autenticación (backend)**: registro, verificación de email, login, refresh con rotación, logout y recuperación de contraseña.
- [ ] **Fase 3 — Frontend base**: layouts y rutas, i18n, tema claro/oscuro, cliente API con TanStack Query, páginas de auth y landing completa.
- [ ] **Fase 4 — Tablas y columnas**: CRUD, plantillas, reordenar, cambio de tipo y dashboard.
- [ ] **Fase 5 — Registros**: CRUD, búsqueda, filtros, orden y paginación en servidor, edición inline y en diálogo.
- [ ] **Fase 6 — Calidad y entrega**: tests de frontend, Playwright, GitHub Actions, Docker de producción y documentación final.

## Después del MVP

- **Despliegue (fase 7)**: candidato gratuito con frontend en Render Static Site (rewrite `/api/*` hacia el backend), backend en Render Web Service, PostgreSQL en Neon y email con la API de Resend.
- Import/export CSV.
- Más tipos de columna.
- Historial de actividad.
- Colaboración en tiempo real y presencia.
- Permisos avanzados y tablas compartidas.
- Notificaciones.
- Gestión de inventario asistida por IA.
