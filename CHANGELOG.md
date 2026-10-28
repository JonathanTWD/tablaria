# Changelog

## Sin publicar

- **Exportar a CSV**: botón «Exportar CSV» en cada tabla, con todos los registros que cumplen la búsqueda, los filtros y el orden actuales. Con doble clic se abre directamente en Excel en español (separador `;` y coma decimal), muestra bien los acentos y el €, y protege contra la inyección de fórmulas.
- **Alertas de stock bajo**: las columnas numéricas admiten un umbral opcional («Avisar cuando baje de…»). En la tabla, los valores por debajo se marcan en ámbar y los que llegan a 0 en rojo, con icono y texto para lectores de pantalla. El panel de inicio muestra una tarjeta «Bajo mínimo» con los registros más urgentes de todas las tablas. Las plantillas de inventario y catálogo, y la demo, traen umbrales ya configurados.
- **Resumen con gráficos**: el panel de inicio muestra un gráfico de barras de cualquier tabla, agrupando sus registros por una columna (lista de opciones, Sí / No o texto) y midiendo el número de registros o la suma de una columna numérica o de precio. Las barras usan los colores de las opciones y el gráfico es una tabla accesible para lectores de pantalla.

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
