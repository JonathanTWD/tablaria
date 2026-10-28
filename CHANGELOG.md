# Changelog

## Sin publicar

- **Presencia**: la cabecera de la tabla muestra avatares de quién más la tiene abierta, con su nombre al pasar el ratón. La celda que alguien está editando se resalta para los demás con su color y su nombre. Para los lectores de pantalla se anuncia quién está en la tabla y quién edita cada celda.
- **«Compartir» visible**: el botón para compartir pasa del menú de los tres puntos a la cabecera de la tabla.
- **Tiempo real**:
  - los cambios de otras personas en una tabla aparecen solos, sin recargar: registros, columnas, el nombre de la tabla, los permisos o su borrado;
  - la cabecera de la tabla indica «En directo»;
  - si la conexión se corta, muestra «Reconectando…», vuelve a conectar sola y se pone al día;
  - quien pierde el acceso deja de recibir avisos al instante.
- **Compartir tablas** (fase 9, parte 2):
  - **Invitar:** con el menú «Compartir» de una tabla se invita a cualquiera por email como lector o editor, y desde ahí se ven las personas con acceso, se cambia su permiso, se les quita el acceso o se anulan invitaciones pendientes.
  - **Aceptar:** el enlace del email lleva a una página para aceptar la invitación, pasando antes por el inicio de sesión si hace falta.
  - **Compartidas conmigo:** estas tablas aparecen en la barra lateral y en el inicio, y se puede salir de ellas.
  - **Según el rol:**
    - el lector ve y exporta, pero no puede editar;
    - el editor cambia registros, pero no la tabla ni sus columnas;
    - los avisos de stock incluyen las tablas compartidas.
- **Base para compartir y organizaciones** (fase 9, parte 1): las tablas pasan a pertenecer a una organización, y cada cuenta tiene un espacio personal al que la migración mueve sus tablas. Ahora el acceso a una tabla se decide en un único sitio: el rol en su organización o el compartido directamente (lector, editor, administrador o propietario). Desde fuera no cambia nada todavía; compartir llega en la parte 2.
- **Pantallas grandes**: la app ya no limita todas las páginas a 1024 px.
  - La tabla de registros usa todo el ancho: a 1707 px pasa de 960 a 1403 px y deja de necesitar scroll horizontal.
  - El inicio se centra hasta 1600 px y, en pantallas anchas, pone «Bajo mínimo» y el gráfico en una columna lateral junto a las tablas.
  - Ajustes y columnas mantienen un ancho cómodo de lectura.
  - En escritorio, la cabecera de la tabla es más compacta, y la primera columna se queda fija al desplazar la tabla en horizontal.
- **Landing en monitores grandes**: el contenido crece de 1280 a 1792 px y los títulos aumentan con `clamp()` a partir de unos 2050 px de ancho. En un monitor de 27" (2560 px) el contenido pasa a ocupar el 70 % del ancho, frente al 50 % de antes. En pantallas altas, la cabecera ocupa la mayor parte de la primera pantalla. En portátiles y móviles se ve igual que antes.
- **Barra lateral plegable**: se pliega a una tira de iconos con el botón de la cabecera, con `Ctrl/⌘ + B` o pulsando su borde. Tiene tooltips con el nombre de cada icono. Las tablas se agrupan en un menú «Tablas», y la elección se recuerda en el navegador. Plegada, la tabla de un portátil de 1707 px pasa de 1403 a 1595 px. En móvil sigue siendo un panel que se abre por encima.

## v1.2.0 — Exportación, alertas y gráficos

- **Exportar a CSV**: botón «Exportar CSV» en cada tabla, con todos los registros que cumplen la búsqueda, los filtros y el orden actuales. Con doble clic se abre directamente en Excel en español (separador `;` y coma decimal), muestra bien los acentos y el €, y protege contra la inyección de fórmulas.
- **Alertas de stock bajo**: las columnas numéricas admiten un umbral opcional («Avisar cuando baje de…»). En la tabla, los valores por debajo se marcan en ámbar y los que llegan a 0 en rojo, con icono y texto para lectores de pantalla. El panel de inicio muestra una tarjeta «Bajo mínimo» con los registros más urgentes de todas las tablas. Las plantillas de inventario y catálogo, y la demo, traen umbrales ya configurados.
- **Resumen con gráficos**: el panel de inicio muestra un gráfico de barras de cualquier tabla, agrupando sus registros por una columna (lista de opciones, Sí / No o texto) y midiendo el número de registros o la suma de una columna numérica o de precio. Las barras usan los colores de las opciones y el gráfico es una tabla accesible para lectores de pantalla.
- **Mantenimiento**: ESLint 10, lockfile reparado tras las actualizaciones de Dependabot y `cooldown` de 14 días en Dependabot, igual que la antigüedad mínima de pnpm.

## v1.1.0 — Demo pública

- **Probar la demo**: entrada al instante, sin registro, en una cuenta temporal con tres tablas de ejemplo, que se borra a las 24 h.
- **Vista previa al compartir**: metaetiquetas Open Graph y de X/Twitter, imagen de 1200×630 y favicon de WiseData.
- **Despliegue**: la API aplica las migraciones al arrancar, avisa mientras el servidor gratuito despierta y registra la IP de los bloqueos por límite de peticiones.
- **Mantenimiento**: dependencias y GitHub Actions actualizadas, Dependabot agrupado y Node ≥ 22.22.

## v1.0.0 — MVP

Primera versión completa de WiseData.

### Cuentas y seguridad
- Registro con verificación por email, inicio de sesión, recuperación de contraseña y cierre de sesión.
- Sesiones con cookies httpOnly: access token JWT de 15 minutos y refresh token opaco y rotatorio con detección de reutilización.
- Protección contra enumeración de cuentas y pre-hijacking, límites por IP y por destinatario en los correos.
- Aislamiento total entre usuarios: los datos de otro responden 404 en todos los endpoints.

### Tablas, columnas y registros
- Tablas en blanco o desde plantilla (inventario básico, catálogo de productos, equipos y activos).
- Seis tipos de columna (texto, número, fecha, sí/no, lista de opciones con colores y precio) con obligatoriedad, valor por defecto, reordenación y cambio de tipo con conversión de los valores guardados.
- Registros con edición directa en la celda o en formulario, búsqueda, filtros por tipo, orden y paginación en el servidor, con la vista guardada en la URL.
- Dashboard con métricas y tablas recientes.

### Interfaz
- Landing con una tabla de inventario funcional, tema claro u oscuro, diseño adaptado a móvil, en español y preparada para más idiomas.

### Calidad y entrega
- Tests unitarios y e2e del backend, tests de frontend con Vitest y un flujo completo con Playwright.
- GitHub Actions en cada pull request, Dependabot y actions fijadas por SHA.
- Imágenes Docker de producción (API sin usuario root, nginx con cabeceras de seguridad y CSP) y `docker-compose.prod.yml` para ejecutarlo en local.
- Auditoría OWASP Top 10:2025 antes del release.
