# Roadmap

La especificación completa del MVP está en [MVP_PROMPT.md](MVP_PROMPT.md).

## MVP

- [x] **Fase 0 — Saneamiento**: build y lint en verde, `cn` estándar, pnpm workspace con `packages/shared`, TypeScript 6 en todos los paquetes, documentación base.
- [x] **Fase 1 — Infraestructura**: Docker Compose de desarrollo (PostgreSQL + Mailpit), Prisma, configuración validada, seguridad base (helmet, CORS, throttler), filtro de errores y validación con zod.
- [x] **Fase 2 — Autenticación (backend)**: registro, verificación de email, login, refresh con rotación, logout y recuperación de contraseña.
- [x] **Fase 3 — Frontend base**: layouts y rutas, i18n, tema claro/oscuro, cliente API con TanStack Query, páginas de auth y landing completa.
- [x] **Fase 4 — Tablas y columnas**: CRUD, plantillas, reordenar, cambio de tipo y dashboard.
- [x] **Fase 5 — Registros**: CRUD, búsqueda, filtros, orden y paginación en servidor, edición inline y en diálogo.
- [x] **Fase 6 — Calidad y entrega**: tests de frontend, Playwright, GitHub Actions, Docker de producción y documentación final.

## Después del MVP

- [x] **Fase 7 — Despliegue y demo**: publicado en https://wise-data.es (Render + Neon + Resend). Botón "Probar la demo" con cuentas temporales y datos de ejemplo, migraciones al arrancar la API, aviso mientras el servidor gratuito despierta y vista previa al compartir el enlace.
### Colaboración (en este orden)

1. **Tablas compartidas**: invitaciones, roles por tabla (lectura/edición) y ownership ampliado en el backend.
2. **Tiempo real básico**: gateway WebSocket que emite eventos de registro creado/editado/borrado por tabla; el frontend invalida o actualiza la caché de TanStack Query. Política "último en guardar gana".
3. **Presencia**: quién está viendo la tabla y qué celda está editando cada usuario.
4. **Bloqueo o resolución de conflictos por celda**, solo si se demuestra necesario.

> Preparación durante el MVP: todas las escrituras de registros pasan por un único servicio del backend, para que emitir eventos más adelante sea un único punto de enganche.

### Prioridades tras el MVP

1. **Exportar**, respetando la vista actual (búsqueda, filtros y orden). El CSV ya está hecho; falta Excel (`.xlsx` con ExcelJS), que se añadirá cuando las versiones recientes del lockfile cumplan la antigüedad mínima de pnpm.
2. **Alertas de stock bajo** (umbral por columna numérica) y **gráficos** en el dashboard.
3. **Importar** CSV o Excel con un asistente paso a paso: subir el archivo, indicar el formato, emparejar columnas, revisar las opciones nuevas y validar antes de importar. Usará la misma conversión y validación que la API. Se importan formatos neutros (CSV, Excel, JSON), no SQL de cada motor.
4. **Preguntas sobre los datos con IA**: el modelo consulta la API mediante herramientas (filtros validados y un endpoint de agregaciones), nunca con SQL libre. Las herramientas solo leen.

### Otras

- Integridad: columnas de valor único (SKU, nº de serie) y tablas bloqueadas o archivadas de solo lectura.
- Tipos de columna: selección múltiple, imágenes y adjuntos, columnas calculadas, relaciones entre tablas.
- Inventario: movimientos de stock (entradas y salidas con histórico), códigos de barras y QR.
- Productividad: vistas guardadas, edición en lote, navegación con teclado, deshacer, papelera recuperable.
- Cuenta: cambiar email y contraseña, borrar la cuenta, cerrar sesión en todos los dispositivos.
- Historial de actividad, notificaciones, enlaces públicos de solo lectura, API pública con webhooks, inglés y PWA.
