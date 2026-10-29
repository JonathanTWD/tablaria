# Changelog

## Sin publicar

- **Importar CSV** (fase 10): el botón «Importar CSV» de una tabla abre un asistente en tres pasos.
  - **Elegir el archivo:** vale el que guarda Excel en español, con `;` y acentos en Windows-1252, o el que exporta WiseData.
  - **Emparejar columnas:** las del mismo nombre se emparejan solas, ignorando mayúsculas y acentos, y el resto se elige o se salta.
  - **Revisar:** dice cuántas filas son válidas y lista cada error con la fila de la hoja de cálculo, la columna, el valor y el motivo. No importa nada mientras quede alguno.
  - **Conversión:** entiende números con coma decimal y separador de miles («1.099,00 €»), fechas día/mes/año, «Sí»/«No» y las opciones de lista sin distinguir mayúsculas.
  - **Opciones nuevas:** quien administra la tabla puede añadirlas de paso.
  - **Seguridad:** el archivo se lee en el navegador; la API recibe solo el texto de las celdas y valida cada una como al crear un registro.
  - **Columnas nuevas:** quien administra la tabla puede llevar una columna del archivo a «Nueva columna», con el tipo detectado a partir de sus valores (texto, número, precio, fecha, Sí/No o lista de opciones) y que se puede cambiar. Así también se importa en una tabla vacía, que ahora ofrece «Importar CSV».
  - **Tabla desde un archivo:** «Nueva tabla → Crear desde un archivo CSV» crea la tabla con el nombre del archivo, las columnas de su cabecera y todos sus registros.
- **Errores más claros**: un cuerpo de petición demasiado grande o mal formado responde 413 o 400, en vez de un error 500.

## v1.3.0 — Trabajo en equipo

- **Compartir tablas**:
  - **Invitar:** el botón «Compartir» de la cabecera de una tabla invita a cualquiera por email como lector o editor. Desde ahí se ven las personas con acceso, se cambia su permiso, se les quita el acceso o se anulan invitaciones pendientes.
  - **Aceptar:** el enlace del email lleva a una página para aceptar la invitación. Quien aún no tiene cuenta recibe la indicación de crearla con el email invitado y, al confirmarla, va directo a aceptarla.
  - **Compartidas conmigo:** estas tablas aparecen en la barra lateral y en el inicio, y se puede salir de ellas.
  - **Según el rol:**
    - el lector ve y exporta, pero no puede editar;
    - el editor cambia registros, pero no la tabla ni sus columnas;
    - los avisos de stock incluyen las tablas compartidas.
- **Organizaciones**: espacios compartidos cuyos miembros ven todas sus tablas con el permiso de su rol: lector, editor, administrador o propietario.
  - **Selector de espacio:** arriba de la barra lateral se elige entre «Mi espacio» y tus organizaciones. La barra y el inicio muestran las tablas de ese espacio, y desde ahí se crea una organización nueva.
  - **Página de la organización:** invitar por email, ver los miembros y las invitaciones pendientes, cambiar roles o quitar miembros, renombrarla, y salir de ella o borrarla con sus tablas.
  - **Reglas:**
    - solo los administradores crean tablas e invitan;
    - solo un propietario da o quita la propiedad;
    - siempre queda al menos un propietario;
    - el límite pasa a ser de 100 tablas por espacio.
  - **Demo:** incluye la organización de ejemplo «Equipo de la tienda», con el almacén central y tres compañeros ficticios.
- **Tiempo real**:
  - los cambios de otras personas aparecen solos, sin recargar: registros, columnas, el nombre de la tabla, los permisos o su borrado;
  - la cabecera de la tabla indica «En directo»;
  - si la conexión se corta, muestra «Reconectando…», vuelve a conectar sola y se pone al día;
  - quien pierde el acceso deja de recibir avisos al instante.
- **Presencia**: la cabecera de la tabla muestra avatares de quién más la tiene abierta, con su nombre al pasar el ratón. La celda que alguien está editando se resalta para los demás con su color y su nombre, también en las listas de opciones. Para los lectores de pantalla se anuncia quién está en la tabla y quién edita cada celda.
- **Editar a la vez sin perder cambios**:
  - el formulario «Editar registro» envía solo los campos que cambias, así que no deshace lo que otra persona haya guardado en el mismo registro;
  - nada se bloquea: si abres la misma celda que otra persona, un aviso dice que gana el último en guardar.
- **Pantallas grandes**:
  - la tabla de registros usa todo el ancho: a 1707 px pasa de 960 a 1403 px y deja de necesitar scroll horizontal;
  - el inicio se centra hasta 1600 px y, en pantallas anchas, pone «Bajo mínimo» y el gráfico en una columna lateral;
  - la primera columna se queda fija al desplazar la tabla en horizontal;
  - la landing crece hasta 1792 px: en un monitor de 27" ocupa el 70 % del ancho en lugar del 50 %.
- **Barra lateral plegable**:
  - se pliega a una tira de iconos con el botón de la cabecera, con `Ctrl/⌘ + B` o pulsando su borde, y la elección se recuerda en el navegador;
  - en móvil sigue siendo un panel que se abre por encima.
- **Seguridad** (auditoría OWASP Top 10):
  - un fallo de la base de datos durante una suscripción en tiempo real ya no tumba la API;
  - las conexiones de tiempo real sin autenticar tienen un límite;
  - los cambios de permisos quedan registrados con sus ids, sin datos personales.
- **Textos al día**: la landing explica cómo compartir y quién ve tus datos, y la comparativa añade el trabajo en equipo.

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
