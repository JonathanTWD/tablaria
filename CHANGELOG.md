# Changelog

## Sin publicar

- **Asistente: tope común para la demo** (auditoría de la v1.9.0): todas las sesiones de demo juntas pueden hacer como mucho 30 preguntas al día, para que abrir demos seguidas no agote el presupuesto de Groq que comparten las cuentas registradas. Al llegar al tope, la demo invita a crear una cuenta.
- **Importar con vista previa y sin repetidos** (ADR-044):
  - **Vista previa:** antes de importar, una tabla con las 5 primeras filas bajo la columna de Tablaria que llenará cada una, con las celdas con error en rojo.
  - **Filas repetidas:** al comprobar, avisa de las filas iguales a un registro de la tabla y de las que repiten otra del mismo archivo, comparando las columnas que trae el archivo sin distinguir mayúsculas. Se omiten por defecto (tachadas en la vista previa) y se pueden importar igualmente.

- **Excel (.xlsx)** (ADR-043):
  - **Exportar:** el botón «Exportar» ofrece Excel o CSV, siempre con la vista actual (búsqueda, filtros y orden).
    - El libro guarda los números y los precios como números (con su moneda), las fechas como fechas, y las relaciones con el nombre del registro enlazado.
    - La cabecera queda fija y con filtros, y las columnas con un ancho que encaja con su contenido.
  - **Importar:** el asistente acepta también libros de Excel. Lee la primera hoja con datos y sigue igual que con un CSV: emparejar columnas, revisar errores e importar todo o nada.
    - El libro se lee en el navegador y nunca se sube entero.
    - De una fórmula se toma su valor, no la fórmula.

- **Asistente: grabación con ondas y acceso más a mano** (ADR-042):
  - **Al preguntar por voz,** la caja de texto se convierte en una barra con la onda de tu voz en directo, un punto de grabación y el tiempo, como una nota de voz. Con «reducir movimiento» activado, la onda se sustituye por un texto.
  - **«Pensando…»** brilla mientras el asistente responde.
  - **El botón «Asistente»** va en el color de la marca, con un tooltip que enseña el atajo.
  - **`Ctrl + K`** (o `⌘ + K`) abre el asistente desde cualquier página, y el menú «⋯» de cada tabla tiene «Preguntar al asistente por esta tabla».
- **Asistente de IA** (ADR-042): un botón «Asistente» en la barra superior abre un chat para preguntar por los datos, como «¿qué está bajo mínimo y a qué proveedor lo pido?».
  - **Lee las tablas que puede ver el usuario,** con sus permisos y sin cambiar nada, y enlaza los registros en los que se basa la respuesta.
  - **Con voz:** micrófono para preguntar y lectura de la respuesta en voz alta, con la voz del navegador.
  - **Gratis:** usa el plan gratuito de Groq, con 15 preguntas al día por cuenta y 5 en la demo. No se guardan las conversaciones, y un aviso explica qué datos se envían antes de la primera pregunta.
- **Barra de la tabla que siempre cabe:** «Nuevo registro» ya no se cae a otra línea cuando falta sitio, por ejemplo con el menú lateral abierto en un portátil.
  - **Sin sitio:** exportar, etiquetas QR e importar se agrupan en un botón «Más».
  - **Con sitio** (pantallas grandes o el menú plegado): se ven como siempre.
  - Se decide por el ancho real de la barra, no por el de la pantalla.
- **Vistas guardadas** (ADR-041): la búsqueda, los filtros, el orden, la agrupación y el tamaño de página se guardan con un nombre («Bajo stock», «Pasillo A») desde el botón «Vistas».
  - **Para todos:** las vistas son de la tabla; las abre cualquiera que pueda verla, con un clic, y el botón muestra el nombre de la que estás viendo.
  - **Quién las gestiona:** quien edita la tabla las guarda, les cambia el nombre, las actualiza con lo que ve en ese momento o las elimina.
  - **En directo:** si alguien guarda o cambia una vista, los demás la ven al momento.
  - Hasta 20 por tabla, con nombres que no se repiten.
- **Edición en lote** (ADR-040): una casilla en cada fila (y otra para toda la página) selecciona registros, y una barra flotante permite:
  - **cambiar un valor:** una columna toma el mismo valor en todos, o se vacía;
  - **eliminarlos** a la vez, con confirmación.
  - Todo o nada: si un valor no vale, o algún registro ya no existe, no cambia ninguno. Cada cambio queda en el historial de actividad y en los movimientos de stock, como una edición normal.
  - Hasta 100 registros por vez (una página). Las columnas de valor único no se ofrecen con varios registros, porque se repetiría el valor.

## v1.8.0 — Etiquetas QR y adjuntos

- **Seguridad** (auditoría OWASP Top 10:2025 de la release):
  - **Código:** sin hallazgos de gravedad media o alta. Se revisaron la ficha de un registro, las etiquetas QR y los adjuntos.
    - Los adjuntos se comprueban por su contenido real, se guardan en un bucket privado y se sirven desde su dominio con enlaces de 5 minutos. Solo los ve quien puede abrir la tabla, y solo los sube o borra quien la edita.
    - La cuota se cuenta con el espacio bloqueado, y la demo no puede subir archivos.
  - **Pendiente, de gravedad baja:** subir o borrar adjuntos aún no queda en el historial de actividad de la tabla. Además, la API lee el archivo entero antes de comprobar el límite de peticiones, como ya pasaba con las importaciones.
  - **Dependencias:** los mismos 2 avisos que en la v1.7.0 (minimatch y deepmerge), solo en la CLI de shadcn, que no forma parte de la app.
- **README** con capturas de la demo y un caso de uso de las etiquetas QR.

- **Adjuntos en cada registro** (ADR-039):
  - **En la ficha:** fotos (JPG, PNG o WebP) y documentos PDF de hasta 5 MB, con miniaturas. Se abren en una pestaña nueva.
  - **Quién puede:** quien edita la tabla sube y borra archivos (pidiendo confirmación); quien solo la ve puede abrirlos.
  - **Límites:** 10 archivos por registro y 50 MB por espacio. La demo no puede subir archivos.
  - **Seguridad:** el tipo se comprueba leyendo el propio archivo, no su nombre. Los archivos se guardan en un bucket privado y se abren con enlaces que caducan a los 5 minutos.
- **Arreglo:** la ficha del registro y el panel de filtros ocupan todo el ancho en el móvil.

- **Etiquetas QR y ficha de cada registro** (ADR-038):
  - **Ficha:** «Ver ficha» en el menú de cada fila abre un panel con todas sus celdas, también las calculadas, y su etiqueta QR. Se puede imprimir la etiqueta, descargar el QR en PNG, ver los movimientos de stock o editar el registro.
  - **Etiquetas para imprimir:** «Etiquetas QR» genera una hoja con la etiqueta de cada registro de la vista actual (búsqueda, filtros y orden), hasta 100. Lleva el nombre, la referencia (la primera columna de valor único, como el SKU) y la tabla.
  - **Al escanear** una etiqueta con el móvil se abre la ficha de ese registro. Solo la ve quien tiene acceso a la tabla: el código no lleva datos, solo el enlace.

## v1.7.0 — Fórmulas y métricas

- **Seguridad** (auditoría OWASP Top 10:2025 de la release):
  - **Código:** sin hallazgos. Se revisaron las fórmulas, el orden y filtro por resumen, las métricas, la importación de relaciones y la demo.
    - Las fórmulas tienen un lenguaje propio, analizado a mano, sin `eval` ni SQL, con un límite de 1.000 caracteres y 100 nodos.
    - Solo leen lo que el usuario puede ver: una consulta o un resumen sin acceso les llega vacío.
    - Los enlaces públicos no muestran ninguna columna calculada.
    - En el CSV, los textos de una fórmula se neutralizan como el resto, así que no pueden convertirse en fórmulas de la hoja de cálculo.
  - **Dependencias:** de 17 avisos a 2, los dos en la CLI de shadcn, que no forma parte de la app.
- **Columnas de fórmula** (ADR-033): calculan un valor a partir de las celdas del propio registro, como «Valor del stock» (`{Precio} * {Stock}`), «Margen» o un aviso con `SI`.
  - **Funciones en español:** `SI`, `Y`, `O`, `NO`, `ESVACIO`, `REDONDEAR`, `ABS`, `MIN`, `MAX`, `MAYUSC`, `MINUSC`, `LARGO`, `HOY` y `DIAS`. También valen sus nombres en inglés. Las columnas se citan entre llaves.
  - **Se comprueban mientras se escriben:** el formulario avisa de lo que no encaja y dice de qué tipo es el resultado. Una fórmula numérica se puede mostrar como precio.
  - **Pueden citar** consultas y resúmenes, pero no relaciones ni otras fórmulas.
  - **Siempre al día:** se calculan al leer y salen en el CSV. Si se renombra una columna, la fórmula sigue funcionando.
- **Seguridad: dependencias actualizadas** (los avisos de la auditoría de la v1.5.0 y la v1.6.0):
  - **body-parser 2.4.0**, que corrige el fallo con cuerpos comprimidos. Se mantiene igualmente el rechazo de cuerpos comprimidos (`inflate: false`), que la app nunca envía.
  - **multer 2.5.0** y **qs 6.16.1**, en las dependencias de Express y Nest, fijados con `overrides` en `pnpm-workspace.yaml` hasta que ellos mismos los exijan.
  - **nodemailer 10.2.1**, que solo se usa para enviar por SMTP en desarrollo (producción envía con Resend).
  - **Pendiente:** minimatch y deepmerge, solo en la CLI de shadcn, que no forma parte de la app. La versión arreglada de minimatch cumple los 14 días de pnpm hacia el 11 de noviembre, y deepmerge no tiene arreglo todavía.
- **Una demo que lo enseña todo** (ADR-037): la cuenta de demostración llega con una ferretería cuyas tablas están enlazadas, para ver todas las funciones sin montar nada.
  - **Productos** (antes «Ferretería López»): lista de categorías y proveedor enlazado, con su teléfono como consulta. Lleva coste y precio, las fórmulas «Margen» y «Valor del stock», stock con aviso de bajo mínimo e historial de movimientos, y un resumen «Pedidos».
  - **Proveedores:** datos de contacto y los resúmenes «Productos» y «Unidades en stock».
  - **Pedidos:** cada uno enlaza con varios productos, con fechas repartidas en los últimos meses para que la evolución de las métricas tenga forma, además de estado y pagado.
  - **Historial real:** los registros se añadieron a lo largo de semanas, con entradas, salidas y recuentos de stock en días distintos, así que la pestaña «Actividad» y el historial de cada producto tienen contenido. En la organización «Equipo de la tienda», los movimientos son de los compañeros ficticios.
  - Siguen «Equipos de la oficina» en Mi espacio y «Almacén central» en la organización.
- **Importar relaciones por nombre** (ADR-036): al importar un CSV, una columna de relación se rellena con el nombre del registro enlazado, el que se ve en la tabla (su primera columna).
  - **Varios registros:** en una relación múltiple, los nombres van separados por comas («Makita, Bosch»).
  - **Sin distinguir mayúsculas** ni espacios de más. Un nombre repetido en la misma celda enlaza una sola vez.
  - **Errores claros:** si ningún registro se llama así, o se llaman así varios, la fila sale en el informe de errores y no se importa nada hasta corregirlo.
  - **Ida y vuelta:** el CSV que exporta Tablaria, que ya escribe las relaciones por nombre, se puede volver a importar tal cual.
  - **Permisos:** hay que poder abrir la tabla enlazada, como al enlazar a mano.
- **Métricas de cada tabla** (ADR-035): una pestaña nueva, «Métricas», junto a Registros, Columnas y Actividad.
  - **De un vistazo:** total de registros, cuántos están bajo mínimo y, por cada columna numérica o de precio, su total, media, mínimo y máximo.
  - **Bajo mínimo:** la lista de la tabla, con enlace a cada registro.
  - **Por grupos:** barras o dona por una lista de opciones, Sí/No, texto o una relación (con el nombre del registro enlazado). Se mide el número de registros o la suma, la media, el mínimo o el máximo de una columna. Por ejemplo, «Coste en salarios por equipo» o «Stock por proveedor».
  - **Evolución:** registros por día, semana o mes, según su fecha de creación o una columna de fecha, con los periodos sin registros también, y la misma medida a elegir.
  - **Accesibles:** cada gráfico lleva sus datos en una tabla para lectores de pantalla, y los colores son los de las opciones de cada lista.
  - **Inicio, más limpio:** el gráfico «Resumen» y la lista «Bajo mínimo» pasan a las métricas de cada tabla. Inicio queda con las cifras generales y la lista de tablas.
- **Ordenar y filtrar por resumen** (ADR-034): los resúmenes se ordenan con su cabecera y se filtran por rango en «Filtros».
  - **Ejemplos:** «los clientes que más facturan», «los proveedores con 10 productos o más» o «los equipos con una incorporación desde enero».
  - **Valores:** un conteo o una suma se filtran como número, y el mínimo o el máximo de unas fechas, como fecha.
  - **Vacíos:** un registro sin nada que enlace con él cuenta 0 en conteos y sumas. En medias, mínimos y máximos queda vacío y se ordena al final.
  - **Exportación:** el CSV sale en el mismo orden.
  - **Permisos:** solo con resúmenes de tablas que puedes abrir.

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
