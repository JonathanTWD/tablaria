# Changelog

## v1.6.0 — Relaciones avanzadas

- **Seguridad** (auditoría OWASP Top 10:2025 de la release):
  - **Código:** sin hallazgos. Se revisaron las etiquetas de las relaciones, la agrupación, las consultas, los resúmenes y las relaciones múltiples.
    - Todo el SQL va parametrizado, y las columnas se comprueban contra la tabla.
    - Los datos de otra tabla solo se muestran, buscan, filtran, ordenan o agrupan si puedes abrirla.
    - Los enlaces públicos siguen sin mostrar relaciones ni nada calculado a partir de ellas.
  - **Dependencias:** siguen los avisos de la v1.5.0 (body-parser, ya mitigado) y aparecen otros nuevos, ninguno alcanzable en producción:
    - nodemailer solo se usa con SMTP; producción envía con Resend.
    - multer no se usa: no hay subidas de archivos.
    - minimatch solo está en la CLI de shadcn.
    - Todos se actualizan hacia el 6 de noviembre.
- **Relaciones con varios registros** (ADR-032):
  - **Qué son:** una relación puede enlazar cada registro con varios de otra tabla, por ejemplo los miembros de un proyecto o los proveedores de un producto. Se activan con «Varios registros» al crear o editar la columna de relación.
  - **Elegir:** el selector deja la lista abierta para añadir o quitar registros uno a uno, y muestra arriba los que ya están enlazados.
  - **Funciones:** se buscan, filtran y ordenan por los nombres de los registros enlazados, y salen en el CSV separados por comas. No se puede agrupar por ellas.
  - **Resúmenes:** funcionan a través de ellas, así que en Empleados se puede contar en cuántos proyectos está cada persona.
  - **Consultas:** solo a través de relaciones de un registro. Al activar «Varios registros» se borran las consultas que leían a través de esa relación; el formulario lo avisa antes de guardar.
  - **Cambiar la opción:** al activarla, cada enlace actual se convierte en una lista de uno; al desactivarla, cada registro conserva el primero de su lista.
  - **Limpieza:** si se borra un registro enlazado, desaparece de las listas que lo tenían.
- **Columnas de resumen** (ADR-031):
  - **Qué son:** cuentan o calculan desde los registros que enlazan con cada fila, por ejemplo, en Equipos, «Nº de empleados», «Coste en salarios» o «Última alta», o en Proveedores, «Productos» y «Stock total». Se crean en «Añadir columna → Resumen de otra tabla».
  - **Cálculos:** contar, sumar, media, mínimo y máximo, con números, precios o fechas.
  - **En la misma tabla:** también funcionan con una relación de una tabla consigo misma, como «Personas a su cargo» a partir de «Jefe».
  - **Siempre al día:** se calculan cada vez y no se editan a mano. Salen en el CSV con su formato.
  - **Permisos:** solo muestran datos de tablas que puedes abrir.
  - **Limpieza:** desaparecen si se borra la relación o la columna que suman.
- **Columnas de consulta** (ADR-030):
  - **Qué son:** muestran un dato del registro enlazado, por ejemplo «Teléfono del proveedor» en Productos. Se crean en «Añadir columna → Consulta de otra tabla», eligiendo la relación y la columna que se quiere ver.
  - **Siempre al día:** el valor se lee de la otra tabla cada vez, así que si cambia allí, cambia aquí. No se edita en esta tabla.
  - **Funciones:** se pueden ordenar (por valor, si es un número o una fecha), filtrar y buscar, y salen en el CSV con el mismo formato que en su tabla.
  - **Permisos:** solo muestran datos de tablas que puedes abrir.
  - **Limpieza:** si se borra la relación o la columna que muestran, la consulta se borra con ellas.
- **Agrupar registros** (ADR-029): el selector «Agrupar por…» ordena la tabla por una lista de opciones, Sí/No, texto o relación, con una cabecera por grupo que dice cuántos registros tiene. Funciona con la búsqueda, los filtros, el orden, la paginación y la exportación, y queda en la URL para compartir la vista.
- **Qué se ve de un registro enlazado:** al crear o editar una columna de relación, la ayuda dice qué columna de la tabla enlazada se mostrará (su primera columna, por ejemplo «Nombre») y cómo cambiarla.

## v1.5.1 — Tablaria

- **Nuevo nombre: Tablaria** (ADR-027). Cambian la marca, las carpetas, el paquete compartido y los nombres internos. La app se publica en el nuevo dominio [tablaria.es](https://tablaria.es) y los correos salen desde `mail.tablaria.es`. Hay que volver a iniciar sesión una vez; los datos son los mismos.

## v1.5.0 — Inventario conectado

- **Seguridad** (auditoría OWASP Top 10:2025 de la release):
  - **Código:** sin hallazgos nuevos. Se revisaron el acceso a las tablas enlazadas, la importación por clave, los movimientos, el historial, la ruta pública sin sesión y la gestión de la cuenta.
  - **Dependencias:** `pnpm audit` avisó de que body-parser < 2.4.0 se cae con un cuerpo comprimido seguido de bytes de más, sin necesidad de sesión. Mientras llega la actualización, la API rechaza los cuerpos comprimidos (415), que la app nunca envía.
  - **Avisos sin riesgo aquí:** multer (no hay subidas de archivos), qs (solo afecta a `stringify`), nodemailer (producción envía con Resend) y deepmerge (solo en la CLI de shadcn). Se actualizan hacia el 6 de noviembre, cuando pasen los 14 días de antigüedad mínima de pnpm.
- **Enlaces públicos de solo lectura** (Compartir → «Enlace público de solo lectura»):
  - **Ver sin cuenta:** quien administra una tabla puede crear un enlace para verla sin iniciar sesión y sin poder cambiar nada, con búsqueda y paginación.
  - **Seguridad:** el enlace se muestra una vez para copiarlo, porque solo se guarda su huella. Crear uno nuevo desactiva el anterior, y también se puede desactivar sin más.
  - **Qué no se ve:** las columnas de relación, porque apuntarían a otras tablas.
  - **En la demo** no está disponible.
- **Historial de actividad** (pestaña «Actividad» de cada tabla):
  - **Qué se ve:** quién creó, editó o borró registros y columnas, las importaciones y los movimientos de stock, agrupado por día y empezando por lo más reciente.
  - **Ediciones:** las seguidas de una persona en un mismo registro se juntan en una entrada, y dicen qué columnas cambiaron, no los valores.
  - **Nombres:** los registros y columnas borrados siguen apareciendo con el nombre que tenían.
  - **Quién lo ve:** cualquiera que pueda abrir la tabla. Se actualiza en tiempo real.
- **Movimientos de stock:**
  - **Columna de stock:** una columna de número puede llevar la cuenta de su stock (interruptor «Columna de stock» al crearla o editarla). Las plantillas de inventario y la demo ya la traen, y su referencia o SKU ahora es de valor único.
  - **Entradas, salidas y recuentos** desde «Movimientos de stock» en el menú de cada registro, con nota opcional y una vista previa del stock que quedará. Una salida no puede dejar el stock por debajo de cero.
  - **Historial por registro**, también para quien solo puede ver la tabla: quién hizo cada cambio, cuánto y cuándo. También quedan los cambios hechos editando la celda o importando, así que el historial siempre cuadra con el stock.
- **Columnas de valor único:**
  - **Una columna de texto o número puede ser única** (interruptor «Valor único» al crear o editar la columna), como el SKU o el número de serie: no deja guardar un valor que ya tiene otro registro, sin distinguir mayúsculas ni espacios.
  - **Al activarla** en una columna que ya repite valores, dice cuáles para corregirlos antes.
  - **Si otro registro ya tiene el valor,** el formulario lo marca en su campo y la celda avisa y recupera el valor anterior.
  - **Importar actualizando:** al importar, «Actualizar los registros que coincidan en» elige una columna única como clave (la primera emparejada, por defecto). Las filas cuyo valor ya existe actualizan ese registro en vez de duplicarlo y el resto se crean; la revisión dice cuántas actualizan.
  - **Al importar sin clave,** un valor repetido en el archivo o que ya está en la tabla aparece como error de esa fila.
- **Relaciones entre tablas**:
  - **Nuevo tipo de columna «Relación con otra tabla».** Al crearla eliges con qué tabla del mismo espacio enlaza, por ejemplo cada producto con su proveedor.
  - **Elegir el registro:** en la celda o en el formulario, un buscador lista los registros de esa tabla por su primera columna.
  - **Lo que ves:** la tabla muestra el nombre del registro enlazado. Si no puedes abrir la tabla enlazada, solo ves que hay un enlace, nunca qué es.
  - **Limpieza:** borrar un registro o una tabla limpia los enlaces que apuntaban a ellos.
  - **CSV:** la exportación muestra el nombre.
  - **Por ahora,** estas columnas no se pueden filtrar ni ordenar.
- **Tu cuenta** (Ajustes):
  - **cambiar la contraseña**, pidiendo la actual; el resto de dispositivos pierde la sesión;
  - **cerrar sesión en todos los dispositivos**;
  - **descargar tus datos** en JSON: la cuenta, tus espacios y las tablas de «Mi espacio» con sus registros, por nombre de columna (RGPD, portabilidad);
  - **borrar la cuenta** con su contraseña: se borran «Mi espacio», las organizaciones donde eres el único miembro y las invitaciones que te enviaron, así que tu email no queda en ningún sitio. Si eres el único propietario de una organización con más gente, primero hay que nombrar otro propietario, y se indica cuáles.
  
  Nada de esto aparece en la demo, que no tiene contraseña y se borra sola.

## v1.4.0 — Importar

- **Importar CSV** (fase 10): el botón «Importar CSV» de una tabla abre un asistente en tres pasos.
  - **Elegir el archivo:** vale el que guarda Excel en español, con `;` y acentos en Windows-1252, o el que exporta Tablaria.
  - **Emparejar columnas:** las del mismo nombre se emparejan solas, ignorando mayúsculas y acentos, y el resto se elige o se salta.
  - **Revisar:** dice cuántas filas son válidas y lista cada error con la fila de la hoja de cálculo, la columna, el valor y el motivo. No importa nada mientras quede alguno.
  - **Conversión:** entiende números con coma decimal y separador de miles («1.099,00 €»), fechas día/mes/año, «Sí»/«No» y las opciones de lista sin distinguir mayúsculas.
  - **Opciones nuevas:** quien administra la tabla puede añadirlas de paso.
  - **Seguridad:** el archivo se lee en el navegador; la API recibe solo el texto de las celdas y valida cada una como al crear un registro.
  - **Columnas nuevas:** quien administra la tabla puede llevar una columna del archivo a «Nueva columna», con el tipo detectado a partir de sus valores (texto, número, precio, fecha, Sí/No o lista de opciones) y que se puede cambiar. Así también se importa en una tabla vacía, que ahora ofrece «Importar CSV».
  - **Tabla desde un archivo:** «Nueva tabla → Crear desde un archivo CSV» crea la tabla con el nombre del archivo, las columnas de su cabecera y todos sus registros.
- **Orden de los registros importados**: los registros de una importación y los de la demo aparecen en el orden del archivo. Antes compartían la misma hora de creación y se mezclaban, algo que con 10 por página se notaba enseguida.
- **10 registros por página**: nueva opción en la paginación, y pasa a ser la vista por defecto (antes 25).
- **Seguridad** (auditoría OWASP de la release): el límite de 2 MB de las importaciones solo se aplica a peticiones con sesión válida. Sin sesión, el cuerpo se rechaza por tamaño antes de procesarlo, porque el límite de peticiones y la autenticación van después.
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
- **Vista previa al compartir**: metaetiquetas Open Graph y de X/Twitter, imagen de 1200×630 y favicon de Tablaria.
- **Despliegue**: la API aplica las migraciones al arrancar, avisa mientras el servidor gratuito despierta y registra la IP de los bloqueos por límite de peticiones.
- **Mantenimiento**: dependencias y GitHub Actions actualizadas, Dependabot agrupado y Node ≥ 22.22.

## v1.0.0 — MVP

Primera versión completa de Tablaria.

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
