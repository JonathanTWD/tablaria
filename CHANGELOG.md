# Changelog

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
