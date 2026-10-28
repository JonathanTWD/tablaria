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
- [x] **Fase 8 — Exportar, alertas y gráficos** (v1.2.0): exportación CSV de la vista actual, alertas de stock bajo con tarjeta en el panel y resumen con gráfico de barras por columna. Falta la exportación a Excel.
- [x] **Fase 8.5 — Pantallas grandes**: la app aprovecha el ancho (tabla a ancho completo, inicio con columna lateral) la landing se adapta a monitores de 27" y más, y la barra lateral se pliega a iconos.
### Colaboración (en este orden)

1. **Compartir tablas y organizaciones** (fase 9, ADR-019): sirve tanto a particulares como a equipos. Se entrega en este orden:
   1. modelo de datos, migración y una puerta de acceso común;
   2. compartir tablas desde el espacio personal, con invitaciones y «Compartidas conmigo»;
   3. organizaciones con miembros y roles;
   4. interfaz de organizaciones y ejemplos en la demo.
2. **Tiempo real básico** (hecho, ADR-020): avisos por WebSocket de cada cambio en una tabla (registros, columnas, la propia tabla o sus permisos). El navegador vuelve a pedir lo afectado, y el último en guardar gana.
3. **Presencia** (hecho, ADR-020): quién está viendo la tabla y qué celda está editando cada usuario.
4. **Bloqueo o resolución de conflictos por celda**, solo si se demuestra necesario.

> Preparación durante el MVP: todas las escrituras de registros pasan por un único servicio del backend, para que emitir eventos más adelante sea un único punto de enganche.

### Prioridades tras el MVP

1. **Exportar**, respetando la vista actual (búsqueda, filtros y orden). El CSV ya está hecho; falta Excel (`.xlsx` con ExcelJS), que se añadirá cuando las versiones recientes del lockfile cumplan la antigüedad mínima de pnpm.
2. **Alertas de stock bajo** y **gráficos** en el dashboard (hecho: umbral por columna numérica, tarjeta «Bajo mínimo» y resumen con gráfico de barras por columna).
3. **Importar** CSV o Excel con un asistente paso a paso: subir el archivo, indicar el formato, emparejar columnas, revisar las opciones nuevas y validar antes de importar. Usará la misma conversión y validación que la API. Se importan formatos neutros (CSV, Excel, JSON), no SQL de cada motor.
4. **Preguntas sobre los datos con IA**: el modelo consulta la API mediante herramientas (filtros validados y un endpoint de agregaciones), nunca con SQL libre. Las herramientas solo leen.

### Otras

- Integridad: columnas de valor único (SKU, nº de serie) y tablas bloqueadas o archivadas de solo lectura.
- Tipos de columna: selección múltiple, imágenes y adjuntos, columnas calculadas, relaciones entre tablas.
- Inventario: movimientos de stock (entradas y salidas con histórico), códigos de barras y QR.
- Productividad: vistas guardadas, edición en lote, navegación con teclado, deshacer, papelera recuperable.
- Cuenta: cambiar email y contraseña, borrar la cuenta, cerrar sesión en todos los dispositivos.
- Historial de actividad, notificaciones, enlaces públicos de solo lectura, API pública con webhooks, inglés y PWA.
