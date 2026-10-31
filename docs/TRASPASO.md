# Guía de traspaso

Todo lo necesario para seguir con Tablaria sin el contexto de quien lo construyó: cómo trabajar en local, cómo publicar, cómo está montado en producción, qué queda pendiente y qué tareas son buenas para empezar.

Complementa al [README](../README.md) (instalación y scripts), a [DECISIONS.md](DECISIONS.md) (por qué está hecho así, ADR-001 a ADR-027) y a [ROADMAP.md](ROADMAP.md) (lo que falta). Las normas de código y de trabajo están en [AGENTS.md](../AGENTS.md); léelas antes de tocar nada.

Estado a 30 de octubre de 2026: **v1.5.1**, publicada en https://tablaria.es.

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
- **Variables:** `NODE_VERSION=22` y `SITE_URL=https://tablaria.es`. `SITE_URL` se escribe al compilar en la URL canónica y en la vista previa al compartir; si cambia, hay que volver a desplegar.
- **Rewrites,** en este orden:
  1. `/api/*` → `https://tablaria.onrender.com/api/*`, de tipo Rewrite;
  2. `/*` → `/index.html`, de tipo Rewrite.
- **Cabeceras** (todas con path `/*`):
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' wss://tablaria.onrender.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`

  El tiempo real va por WebSocket **directo a la API** (la rewrite no lleva WebSockets), por eso `connect-src` incluye la URL `wss://` de la API. Si la demo no dice «En directo», revisa esto primero.

### API (Web Service)

- **Docker:** Dockerfile `tablaria-backend/Dockerfile`, contexto `.`, health check `/api/health`.
- **Variables** (los valores secretos solo están en Render):
  - `NODE_ENV=production`, `DATABASE_URL` (Neon) y `JWT_ACCESS_SECRET`;
  - `APP_URL=https://tablaria.es` y `CORS_ORIGINS=https://tablaria.es`;
  - `TRUST_PROXY_HOPS=1`;
  - `REALTIME_URL=wss://tablaria.onrender.com/api/realtime`;
  - `MAIL_TRANSPORT=resend`, `RESEND_API_KEY` y `MAIL_FROM=Tablaria <no-reply@tablaria.es>`;
  - `DEMO_ENABLED` (por defecto activada).

### DNS en Hostalia

- **Web:** la raíz (`tablaria.es`) y `www` tienen un registro A a `216.24.57.1` (Render). Hostalia no deja escribir `@`: la raíz aparece con el nombre del dominio.
- **Resend:** `resend._domainkey` (TXT), `send` y `rsend` (CNAME). No hay que tocarlos.
- **Buzones de Hostalia:** el MX, `imap`, `pop3`, `smtp`, `webmail` y el SPF de la raíz. No tienen nada que ver con la app.

---

## 4. Pendiente con fecha

- **Hacia el 6 de noviembre de 2026: actualizar dependencias con avisos de seguridad.**
  - Cuando pasen los 14 días de antigüedad mínima: body-parser ≥ 2.4.0, multer ≥ 2.5.0, qs ≥ 6.16.1 y nodemailer ≥ 10.1.4 (salto de versión mayor desde la 9; solo se usa en local con Mailpit).
  - **El de body-parser ya está mitigado:** la API rechaza los cuerpos comprimidos (`inflate: false` en `app.setup.ts`). Mantenlo después de actualizar.
  - **Después:** `pnpm audit --prod` debería quedar limpio, salvo deepmerge, que solo se usa en la CLI de shadcn.
  - **Recomendado:** activar las alertas de Dependabot en GitHub y añadir `pnpm audit --prod --audit-level=high` a la CI.
- **Hacia el 8 de noviembre de 2026: importar Excel (.xlsx) con ExcelJS,** cuando su versión supere la antigüedad mínima. Encaja en el asistente de importación actual: el navegador lee el archivo y la API recibe las mismas filas de texto que con un CSV (ADR-021).

---

## 5. Lo que queda por hacer

### Siguiente tarea grande: relaciones avanzadas

Es la más interesante para el producto y amplía el ADR-022. Por orden de valor:

1. ~~Filtrar, buscar y ordenar por la etiqueta del registro enlazado~~: hecho en el ADR-028 (`labelSources` en `relations/relations.ts` y `labelText` en `record-query.ts`).
2. ~~Columnas de consulta (*lookup*)~~: hecho en el ADR-030 (`src/lookups/lookups.ts`: `lookupSources`, `fillLookups`, `dropLookups`; en la interfaz, `LookupFields` en `ColumnDialog.tsx`).
3. **Columnas de resumen (*rollup*):** contar o sumar desde la otra tabla, como «nº de productos» o «stock total» de un proveedor.
4. **Selección múltiple:** varios registros por celda.
5. **Columnas calculadas:** por ejemplo, precio × stock.

Puntos delicados que hay que respetar:
- **Permisos:** las etiquetas solo se resuelven para tablas que el usuario puede abrir (`linkedLabels` en `relations/relations.ts`). Un *lookup* o un *rollup* sobre una tabla sin acceso no debe filtrar nada.
- **SQL:** cualquier valor de la otra tabla se lee como en `labelText` (`record-query.ts`): una subconsulta por clave primaria, parametrizada y solo para las fuentes que devuelve `labelSources`.
- **Enlaces públicos:** siguen sin mostrar relaciones (ADR-026), y lo mismo vale para *lookups* y *rollups*.

### Otras tareas difíciles

Detalladas en el ROADMAP:
- deshacer la última importación;
- cambiar el email de la cuenta verificando el nuevo;
- API pública con tokens y webhooks;
- imágenes y adjuntos (aparcada, con el diseño en el ROADMAP).

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
