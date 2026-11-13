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

- [x] **Fase 7 — Despliegue y demo**: publicado en https://tablaria.es (Render + Neon + Resend). Botón "Probar la demo" con cuentas temporales y datos de ejemplo, migraciones al arrancar la API, aviso mientras el servidor gratuito despierta y vista previa al compartir el enlace.
- [x] **Fase 8 — Exportar, alertas y gráficos** (v1.2.0): exportación CSV de la vista actual, alertas de stock bajo con tarjeta en el panel y resumen con gráfico de barras por columna. Falta la exportación a Excel.
- [x] **Fase 8.5 — Pantallas grandes**: la app aprovecha el ancho (tabla a ancho completo, inicio con columna lateral) la landing se adapta a monitores de 27" y más, y la barra lateral se pliega a iconos.
- [x] **Fase 9 — Trabajo en equipo** (v1.3.0): compartir tablas por email, organizaciones con roles, tiempo real y presencia.
- [x] **Fase 10 — Ayuda, legal y fechas** (v1.10.0): centro de ayuda (ADR-045), páginas legales y sitemap (ADR-046), calendario (ADR-047), avisos de fechas próximas (ADR-048), logo propio y landing renovada.
- [x] **Fase 11 — Móvil, buscadores y código abierto** (v1.11.0): escáner de códigos y app instalable (ADR-051), páginas públicas prerenderizadas para buscadores e IA (ADR-050), repositorio preparado para código abierto (MIT) y tests de accesibilidad con axe.

### v1.11 (publicada)

- [x] SEO y GEO: páginas públicas prerenderizadas con sus etiquetas y datos estructurados, `llms.txt` y favicons para Google (ADR-050).
- [x] Repositorio listo para código abierto: licencia MIT, guía de contribución, política de seguridad, código de conducta y plantillas.
- [x] Documentación al día: README con capturas nuevas, guía de traspaso y diagrama de arquitectura.
- [x] Escáner de códigos de barras y QR con la cámara, para abrir o buscar registros desde el móvil (ADR-051).
- [x] PWA instalable, con el logo nuevo (ADR-051).
- [x] Tests de accesibilidad con axe en Playwright (WCAG 2.2 A y AA, en claro y oscuro), y CodeQL en GitHub Actions cuando el repositorio sea público.
- [x] Parche de minimatch, glob y fast-uri en las herramientas de desarrollo.

### v1.11.1 (publicada)

- [x] Asistente más fiable: reintento cuando Groq rechaza una llamada a herramienta, contar por grupos, saludos sin herramientas y respuestas sin Markdown.
- [ ] Actualizar hono y @hono/node-server (CLI de shadcn) cuando sus versiones corregidas cumplan 14 días.

### Colaboración (en este orden)

1. **Compartir tablas y organizaciones** (hecho, fase 9, ADR-019): sirve tanto a particulares como a equipos. Se entregó en este orden:
   1. modelo de datos, migración y una puerta de acceso común;
   2. compartir tablas desde el espacio personal, con invitaciones y «Compartidas conmigo»;
   3. organizaciones con miembros y roles;
   4. interfaz de organizaciones y ejemplos en la demo.
2. **Tiempo real básico** (hecho, ADR-020): avisos por WebSocket de cada cambio en una tabla (registros, columnas, la propia tabla o sus permisos). El navegador vuelve a pedir lo afectado, y el último en guardar gana.
3. **Presencia** (hecho, ADR-020): quién está viendo la tabla y qué celda está editando cada usuario.
4. **Bloqueo o resolución de conflictos por celda**, solo si se demuestra necesario.

> Preparación durante el MVP: todas las escrituras de registros pasan por un único servicio del backend, para que emitir eventos más adelante sea un único punto de enganche.

### Prioridades tras el MVP

1. **Exportar**, respetando la vista actual (búsqueda, filtros y orden). Hechos el CSV y el Excel (`.xlsx`, ADR-043).
2. **Alertas de stock bajo** y **gráficos** (hecho: umbral por columna numérica; desde ADR-035, pestaña «Métricas» en cada tabla con resumen, bajo mínimo, grupos y evolución).
3. **Importar** con un asistente paso a paso (hecho para CSV, fase 10, ADR-021): elegir el archivo, emparejar columnas o crearlas con su tipo detectado, revisar errores y opciones nuevas, e importar todo o nada, también en una tabla vacía o como tabla nueva. También para Excel (`.xlsx`, ADR-043), leído en el navegador.
4. **Preguntas sobre los datos con IA**: el modelo consulta la API mediante herramientas (filtros validados y un endpoint de agregaciones), nunca con SQL libre. Las herramientas solo leen.

### Plan por dificultad

Cada tarea indica qué modelo conviene: **Opus** para lo que toca seguridad, permisos, migraciones o diseño nuevo; **básico** para tareas acotadas que siguen patrones ya existentes en el código (un modelo más ligero puede hacerlas si se le pasan los archivos indicados). Las marcadas con **tú** necesitan una cuenta o un ajuste fuera del código.

**Difíciles (Opus)**
- Cuenta: cambiar email verificando el nuevo. (Hecho: cambiar contraseña, cerrar sesión en todos los dispositivos, borrar la cuenta y exportar tus datos.)
- Columnas de valor único (SKU, nº de serie) e importar actualizando por esa columna en vez de duplicar (hecho, ADR-023).
- Deshacer la última importación.
- Movimientos de stock: entradas y salidas con histórico y quién las hizo (hecho, ADR-024).
- Historial de actividad de cada tabla (hecho, ADR-025). Pendiente: reordenar columnas, renombrar la tabla y podar los eventos antiguos.
- Enlaces públicos de solo lectura (hecho, ADR-026). Pendiente: caducidad opcional y elegir qué columnas se ven.
- Adjuntos en cada registro (hecho, ADR-039; en el historial y con el límite de subidas antes de leer el archivo, ADR-049). Pendiente: una columna con la foto principal en la tabla y subidas directas al bucket.
- API pública con tokens y webhooks.
- Relaciones entre tablas (hechas las básicas, ADR-022; buscar, filtrar y ordenar por nombre, ADR-028; columnas de consulta, ADR-030; columnas de resumen, ADR-031; relaciones con varios registros, ADR-032; columnas de fórmula, ADR-033; ordenar y filtrar por resumen, ADR-034): ordenar y filtrar por fórmula, resúmenes con condición y consultas a través de relaciones múltiples.
- Preguntas sobre los datos con IA (hecho, ADR-042, con el plan gratuito de Groq). Pendiente: acciones con confirmación, buscar en los PDF adjuntos y voz con ElevenLabs.
- Tiempo real con varias instancias (Redis), solo si hace falta escalar.

**Medias (básico, con cuidado; Opus si hay tiempo)**
- Excel `.xlsx` para exportar e importar (hecho, ADR-043).
- Parche de dependencias: body-parser, multer, qs y nodemailer (hecho, v1.7.0). Hechos también minimatch, glob y fast-uri (v1.11.0).
- Calendario por columnas de fecha (hecho, ADR-047) y avisos de fechas próximas (hecho, ADR-048). Pendiente: resumen por email cuando haya tareas programadas.
- Selección múltiple como tipo de columna.
- Vistas guardadas (búsqueda, filtros y orden con nombre) (hecho, ADR-041).
- Edición en lote (hecho, ADR-040) y papelera recuperable.
- Tablas bloqueadas o archivadas de solo lectura.
- Escáner de códigos de barras y QR con la cámara (hecho, ADR-051).
- Notificaciones (por ejemplo, resumen semanal de stock bajo por email).
- Inglés: traducir los JSON de `src/i18n/locales/es` y añadir un selector de idioma.
- PWA instalable (hecho, ADR-051).

**Fáciles (básico)**
- Pegar celdas copiadas de Excel en el asistente de importación. (Hecho: vista previa y filas repetidas, ADR-044.)
- Descargar una plantilla CSV con las columnas de la tabla.
- Páginas legales: privacidad, aviso legal y cookies (hecho, ADR-046).
- Centro de ayuda con una guía por función (hecho, ADR-045).
- `pnpm audit --prod --audit-level=high` en el CI.
- CodeQL en GitHub Actions (hecho, con su badge). Pendiente: Codecov y Lighthouse CI.
- Tests de accesibilidad con axe en Playwright (hecho).
- Navegación con teclado por la tabla.

**Fuera del código (tú)**
- Activar las alertas de seguridad de Dependabot en GitHub.
- Sentry (errores), UptimeRobot (caídas y mantener despierta la API) y Plausible o Umami (analítica sin cookies).
- Cloudflare delante del dominio.
- Procedimiento de copias de seguridad en Neon, probado al menos una vez.

### Otras

- Integridad: tablas bloqueadas o archivadas de solo lectura.
- Tipos de columna: selección múltiple, una columna de imagen con la foto principal, columnas calculadas, relaciones entre tablas.
- Inventario: códigos de barras y QR (hecho, ADR-038 y ADR-051).
- Productividad: vistas guardadas, edición en lote, navegación con teclado, deshacer, papelera recuperable. (Hecho: agrupar registros por una columna, ADR-029.)
- Cuenta: cambiar email y contraseña, borrar la cuenta, cerrar sesión en todos los dispositivos.
- Notificaciones, API pública con webhooks, inglés y PWA.
