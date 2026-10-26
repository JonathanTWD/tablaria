# Roadmap

La especificación completa del MVP está en [MVP_PROMPT.md](MVP_PROMPT.md).

## MVP

- [x] **Fase 0 — Saneamiento**: build y lint en verde, `cn` estándar, pnpm workspace con `packages/shared`, TypeScript 6 en todos los paquetes, documentación base.
- [x] **Fase 1 — Infraestructura**: Docker Compose de desarrollo (PostgreSQL + Mailpit), Prisma, configuración validada, seguridad base (helmet, CORS, throttler), filtro de errores y validación con zod.
- [x] **Fase 2 — Autenticación (backend)**: registro, verificación de email, login, refresh con rotación, logout y recuperación de contraseña.
- [x] **Fase 3 — Frontend base**: layouts y rutas, i18n, tema claro/oscuro, cliente API con TanStack Query, páginas de auth y landing completa.
- [ ] **Fase 4 — Tablas y columnas**: CRUD, plantillas, reordenar, cambio de tipo y dashboard.
- [ ] **Fase 5 — Registros**: CRUD, búsqueda, filtros, orden y paginación en servidor, edición inline y en diálogo.
- [ ] **Fase 6 — Calidad y entrega**: tests de frontend, Playwright, GitHub Actions, Docker de producción y documentación final.

## Después del MVP

- **Despliegue (fase 7)**: candidato gratuito con frontend en Render Static Site (rewrite `/api/*` hacia el backend), backend en Render Web Service, PostgreSQL en Neon y email con la API de Resend.
### Colaboración (en este orden)

1. **Tablas compartidas**: invitaciones, roles por tabla (lectura/edición) y ownership ampliado en el backend.
2. **Tiempo real básico**: gateway WebSocket que emite eventos de registro creado/editado/borrado por tabla; el frontend invalida o actualiza la caché de TanStack Query. Política "último en guardar gana".
3. **Presencia**: quién está viendo la tabla y qué celda está editando cada usuario.
4. **Bloqueo o resolución de conflictos por celda**, solo si se demuestra necesario.

> Preparación durante el MVP: todas las escrituras de registros pasan por un único servicio del backend, para que emitir eventos más adelante sea un único punto de enganche.

### Otras

- Import/export CSV.
- Más tipos de columna.
- Historial de actividad.
- Notificaciones.
- Gestión de inventario asistida por IA.
