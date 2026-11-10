# Guía de traspaso

Todo lo necesario para seguir con Tablaria sin el contexto de quien lo construyó: cómo trabajar en local, cómo publicar, cómo está montado en producción, qué queda pendiente y qué tareas son buenas para empezar.

Complementa al [README](../README.md) (instalación y scripts), a [CONTRIBUTING.md](../CONTRIBUTING.md) (cómo proponer cambios), a [DECISIONS.md](DECISIONS.md) (por qué está hecho así, ADR-001 a ADR-050) y a [ROADMAP.md](ROADMAP.md) (lo que falta). Las normas de código y de trabajo están en [AGENTS.md](../AGENTS.md); léelas antes de tocar nada.

Estado a 10 de noviembre de 2026: **v1.10.0**, publicada en https://tablaria.es. El repositorio tiene licencia MIT.

---

## 1. Trabajar en local

### Primera vez

```bash
corepack enable
pnpm install
cp .env.example .env                                   # Docker Compose
cp tablaria-backend/.env.example tablaria-backend/.env # API: rellena JWT_ACCESS_SECRET
cp tablaria-frontend/.env.example tablaria-frontend/.env
docker compose up -d                                   # PostgreSQL (puerto 5433) y Mailpit
pnpm --filter tablaria-backend db:deploy               # aplica las migraciones
pnpm dev                                               # API en :3000, web en :5173
```

- **Correos en local:** Mailpit, en http://localhost:8025. Ahí llegan todos (verificación, invitaciones…).
- **Base de datos de tests:** los e2e usan `TEST_DATABASE_URL` (`tablaria_test`), que el propio test migra y vacía. No hace falta crearla a mano.
- **Si vienes de antes del cambio de nombre:** el proyecto de Docker se llamaba `wisedata`. `docker compose -p wisedata down` apaga el contenedor antiguo sin borrar su volumen.

### Comprobaciones antes de un PR

| Qué | Comando | Dónde |
|---|---|---|
| Tipos | `pnpm typecheck` | raíz |
| Lint | `pnpm lint` | raíz (en el backend aplica `--fix`: revisa el diff después) |
| Tests unitarios | `pnpm test` | raíz (backend con Jest, frontend con Vitest) |
| E2E del backend | `pnpm --filter tablaria-backend test:e2e` | necesita Docker levantado; tarda ~1–2 min |
| Un solo e2e | `pnpm --filter tablaria-backend test:e2e nombre` | por ejemplo `stock-movements` |
| E2E del navegador | `pnpm --filter tablaria-e2e test` | Playwright; la CI lo ejecuta siempre |
| Build | `pnpm build` | raíz |

No lances Jest directamente en el backend (`jest …`): usa los scripts, que añaden `--experimental-vm-modules`. Sin eso se queda colgado.

### Cosas que conviene saber

- **pnpm tiene `minimumReleaseAge` de 14 días.** `pnpm add` de una versión recién publicada falla a propósito, como protección contra paquetes comprometidos. Solo `@rolldown/*` está exceptuado. Para una dependencia nueva, edita `package.json` y `pnpm-lock.yaml` con una versión que tenga más de 14 días, y comprueba con `pnpm install --frozen-lockfile`.
- **Migraciones:** se escriben en `tablaria-backend/prisma/migrations/<fecha>_<nombre>/migration.sql`. El SQL se genera desde el esquema con:
  ```bash
  pnpm --filter tablaria-backend exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
  ```
  Añade un comentario de una línea arriba, aplica con `db:deploy` y regenera el cliente con `prisma generate`. En producción se aplican solas al arrancar el contenedor.
- **Paquete compartido:** si cambias `packages/shared`, ejecuta `pnpm --filter @tablaria/shared build` antes de compilar o testear el backend; el backend usa su `dist`.
- **Páginas públicas prerenderizadas (ADR-050):** la portada, la ayuda y las legales se renderizan en el build (`src/entry-prerender.tsx` y `scripts/prerender.mjs`). Sus componentes no pueden leer `window`, `localStorage` ni la hora al renderizar; lo que dependa del navegador va en un efecto. Si no, el build falla o la consola muestra un error de hidratación (#418). Una guía nueva necesita su slug en `src/public-paths.ts`: un test avisa si falta.
- **Campos de formulario:** el `Input` de Base UI guarda su propio valor. Si un formulario necesita vaciarse con `form.reset(valores)`, usa `Controller` en vez de `register`; si no, el campo no se vacía (ver `StockDialog.tsx`). `form.reset()` sin argumentos sí funciona.
- **Finales de línea en Windows:** Prettier y git pueden marcar archivos como cambiados solo por los finales de línea. Antes de hacer commit, `git diff --ignore-all-space --ignore-cr-at-eol` muestra si hay cambios reales.

---

## 2. Flujo de trabajo y revisiones

- **Ramas:** todo sale de `develop` (`feat/…`, `fix/…`, `chore/…`, `docs/…`) y vuelve a `develop` por PR. `main` es solo para releases.
- **Revisiones antes de abrir un PR** (y mencionarlas en la descripción):
  - siempre: `/code-review`, arreglando lo que se confirme;
  - si toca backend, autenticación, permisos o datos: `/security-review`;
  - si toca interfaz: comprobación de accesibilidad (WCAG 2.2);
  - antes de fusionar `develop` → `main`: auditoría OWASP Top 10 completa.
- **Commits:** pequeños, en inglés, describiendo el cambio. Sin líneas de atribución a herramientas.
- **Documentación:** las decisiones importantes van a `docs/DECISIONS.md` como un ADR nuevo; lo publicado, al `CHANGELOG.md` en «Sin publicar».

### Cómo publicar una release

1. **Auditoría:** OWASP completa sobre `develop` (incluye `pnpm audit --prod`, revisando aviso por aviso si es alcanzable). Si hay arreglos, en un PR a `develop`.
2. **CHANGELOG:** un PR a `develop` que cambia «Sin publicar» por `vX.Y.Z — Título`.
3. **Release:** un PR `develop` → `main` titulado «Release vX.Y.Z — Título», con las novedades, las migraciones y las variables nuevas.
4. **Al fusionar,** Render despliega solo la API y la web. Comprueba:
   - `https://tablaria.es/api/health` → `{"status":"ok"}`;
   - «Probar la demo» entra y la tabla dice «En directo».
5. **Publicar en GitHub:** `gh release create vX.Y.Z --target main --title "vX.Y.Z — Título" --notes-file notas.md`, con la sección del CHANGELOG como notas.

Las versiones son semánticas: funcionalidades nuevas suben la menor (1.6.0), arreglos y cambios internos la de parche (1.5.2).

---

## 3. Producción

| Pieza | Dónde | Notas |
|---|---|---|
| Web | Render, Static Site, en **https://tablaria.es** | `www` redirige a la raíz |
| API | Render, Web Service (Docker) llamado `tablaria` → **https://tablaria.onrender.com** | plan gratuito: se duerme y tarda ~1 min en despertar |
| Base de datos | Neon (Frankfurt) | migraciones automáticas al arrancar la API |
| Correo | Resend, dominio verificado `tablaria.es` | envía desde `no-reply@tablaria.es` |
| Dominio y DNS | Hostalia | también tiene los buzones de `@tablaria.es` |

### Web (Static Site)

- **Build:** `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @tablaria/shared build && pnpm --filter tablaria-frontend build`
- **Publicación:** `tablaria-frontend/dist`
- **Variables:** `NODE_VERSION=22` y `SITE_URL=https://tablaria.es`. `SITE_URL` se escribe al compilar en los `canonical`, la vista previa al compartir, los datos estructurados, el sitemap y `llms.txt`; si cambia, hay que volver a desplegar.
- **Páginas prerenderizadas:** el build escribe `ayuda/<guía>/index.html` y `ayuda/<guía>.html` para cada página pública. Render sirve un archivo que existe antes de aplicar la regla `/*`, así que no hace falta otra rewrite. Para comprobarlo: `curl -s https://tablaria.es/ayuda/calendario | grep canonical`.
- **Rewrites,** en este orden:
  1. `/api/*` → `https://tablaria.onrender.com/api/*`, de tipo Rewrite;
  2. `/*` → `/index.html`, de tipo Rewrite.
- **Cabeceras** (todas con path `/*`):
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://s3.filebase.io; font-src 'self' data:; connect-src 'self' wss://tablaria.onrender.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`

  `img-src` incluye el origen del bucket (Filebase) para las miniaturas de los adjuntos: tiene que coincidir exactamente con `STORAGE_ENDPOINT`. `'wasm-unsafe-eval'` deja compilar el lector de códigos de respaldo (ZXing en WebAssembly) en Safari y Firefox (ADR-051); sin él, el escáner solo funciona donde el navegador trae el suyo.

  El tiempo real va por WebSocket **directo a la API** (la rewrite no lleva WebSockets), por eso `connect-src` incluye la URL `wss://` de la API. Si la demo no dice «En directo», revisa esto primero.

### API (Web Service)

- **Docker:** Dockerfile `tablaria-backend/Dockerfile`, contexto `.`, health check `/api/health`.
- **Variables** (los valores secretos solo están en Render):
  - `NODE_ENV=production`, `DATABASE_URL` (Neon) y `JWT_ACCESS_SECRET`;
  - `APP_URL=https://tablaria.es` y `CORS_ORIGINS=https://tablaria.es`;
  - `TRUST_PROXY_HOPS=1`;
  - `REALTIME_URL=wss://tablaria.onrender.com/api/realtime`;
  - `MAIL_TRANSPORT=resend`, `RESEND_API_KEY` y `MAIL_FROM=Tablaria <no-reply@tablaria.es>`;
  - `STORAGE_ENDPOINT=https://s3.filebase.io`, `STORAGE_REGION=auto`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID` y `STORAGE_SECRET_ACCESS_KEY` para los adjuntos (ADR-039);
  - `AI_API_KEY` (Groq) para el asistente, y opcionalmente `AI_BASE_URL` y `AI_MODEL` (ADR-042);
  - `DEMO_ENABLED` (por defecto activada).

### DNS en Hostalia

- **Web:** la raíz (`tablaria.es`) y `www` tienen un registro A a `216.24.57.1` (Render). Hostalia no deja escribir `@`: la raíz aparece con el nombre del dominio.
- **Resend:** `resend._domainkey` (TXT), `send` y `rsend` (CNAME). No hay que tocarlos.
- **Buzones de Hostalia:** el MX, `imap`, `pop3`, `smtp`, `webmail` y el SPF de la raíz. No tienen nada que ver con la app.

---

## 4. Pendiente con fecha

- **Desde el 11 de noviembre de 2026: actualizar minimatch** (≥ 11.0.1), cuando la versión supere los 14 días de antigüedad mínima. Hoy solo llega a través de la CLI de shadcn, que no forma parte de la app, pero `pnpm audit --prod` lo sigue marcando.
- **Avisos de dependencias que no hace falta tocar:** `uuid` a través de ExcelJS (solo usa `v4()`, que no está afectado) y deepmerge, en la CLI de shadcn. Revísalos en cada auditoría por si dejan de ser inalcanzables.

---

## 5. Lo que queda por hacer

### Siguiente: v1.11

1. Actualizar minimatch (sección 4).

Ya están en `develop` para la v1.11:
- el SEO y el GEO (ADR-050);
- la preparación para el código abierto;
- esta documentación;
- el escáner y la app instalable (ADR-051);
- los tests de accesibilidad con axe (`e2e/tests/accessibility.spec.ts`) y CodeQL, que solo se ejecuta con el repositorio público.

Al publicarla, hay que añadir `'wasm-unsafe-eval'` a la CSP de Render (sección 3).

### Otras tareas difíciles

Detalladas en el ROADMAP:
- **Relaciones:**
  - ordenar y filtrar por fórmula;
  - resúmenes con condición;
  - consultas a través de relaciones múltiples (lo básico está hecho, del ADR-022 al ADR-034).
- **Datos:**
  - deshacer la última importación;
  - papelera recuperable;
  - selección múltiple como tipo de columna.
- **Cuenta:** cambiar el email verificando el nuevo.
- **Integración:** API pública con tokens y webhooks.
- **Adjuntos:** una columna con la foto principal, y subidas directas al bucket.

Puntos delicados que hay que respetar en cualquier cambio de relaciones:
- **Permisos:** las etiquetas solo se resuelven para tablas que el usuario puede abrir (`linkedLabels` en `relations/relations.ts`). Un *lookup* o un *rollup* sobre una tabla sin acceso no debe filtrar nada.
- **SQL:** cualquier valor de la otra tabla se lee como en `labelText` (`record-query.ts`): una subconsulta por clave primaria, parametrizada y solo para las fuentes que devuelve `labelSources`.
- **Enlaces públicos:** siguen sin mostrar relaciones (ADR-026), y lo mismo vale para *lookups* y *rollups*.

### Tareas acotadas, buenas para empezar o para un modelo más ligero

Cada una sigue un patrón que ya existe. Lee primero los archivos indicados.

| Tarea | Por dónde empezar |
|---|---|
| Registrar en el historial el reordenado de columnas y el cambio de nombre de la tabla | `activity/activity-log.ts` (`logActivity`), `columns.service.ts` (`reorder`), `tables.service.ts` (`update`). Añadir acciones al enum `ActivityAction` necesita una migración. |
| Borrar eventos de historial de más de N días | Un trabajo programado como el que borra las demos caducadas (`demo.service.ts`, `deleteExpiredAccounts`). |
| Caducidad opcional de los enlaces públicos | Columna `expiresAt` en `PublicLink` (migración), comprobarla en `public-links.service.ts` → `read` y un selector en `PublicLinkSection.tsx`. |
| Elegir qué columnas se ven en un enlace público | La lista de columnas visibles ya se calcula en `public-links.service.ts` → `read`; guardar la elección en `PublicLink`. |
| Traducción al inglés | Los textos ya están en `src/i18n/locales/es/*.json` por espacios de nombres. Hay que añadir `en/` y un selector de idioma. |

Para cualquier cambio en la API, copia la estructura de un módulo parecido (`stock-movements` o `activity` son pequeños y recientes):
- controlador fino y servicio con la lógica;
- validación con los esquemas zod de `packages/shared`;
- permisos con `requireTableRole` o `touchTable`;
- los e2e en `tablaria-backend/test/`.

### Al escribir en registros o columnas, no olvides

- `touchTable(tx, userId, tableId, rol)` al empezar la transacción: comprueba el rol y bloquea la tabla.
- `logStockChanges` si puede cambiar una columna de stock (ADR-024).
- `logActivity` para el historial (ADR-025).
- `requireUniqueValues` si hay columnas de valor único (ADR-023).
- `requireLinkedRecords` si hay relaciones (ADR-022).
- `this.realtime.publish(tableId, 'records' | 'columns' | …)` al terminar, para que las pantallas abiertas se actualicen.
