import { DocLink, Note, Ui } from "../../prose";
import type { DocArticle } from "../../types";

export const etiquetasQr: DocArticle = {
  slug: "etiquetas-qr",
  title: "Ficha, etiquetas QR, escáner y adjuntos",
  description: "Imprime etiquetas para las estanterías, escanéalas o el código de barras de un producto con la cámara y guarda sus fotos y documentos.",
  keywords: [
    "qr",
    "código",
    "código de barras",
    "ean",
    "escanear",
    "escáner",
    "cámara",
    "imprimir",
    "etiqueta",
    "móvil",
    "foto",
    "pdf",
    "archivo",
    "imagen",
    "factura",
  ],
  intro: (
    <p>
      Cada registro tiene una ficha con todos sus datos, su código QR y sus adjuntos. Las etiquetas QR llevan esa ficha
      del almacén al móvil.
    </p>
  ),
  sections: [
    {
      id: "ficha",
      title: "La ficha de un registro",
      body: (
        <p>
          En el menú de cada fila, elige <Ui>Ver ficha</Ui>. Muestra todas las columnas del registro, su código QR y sus
          adjuntos. Desde ahí puedes <Ui>Imprimir etiqueta</Ui> o <Ui>Descargar QR</Ui> como imagen.
        </p>
      ),
    },
    {
      id: "imprimir",
      title: "Imprimir etiquetas de varios registros",
      body: (
        <>
          <ol>
            <li>Filtra la tabla para quedarte con los registros que quieres, por ejemplo los de un pasillo.</li>
            <li>
              Abre <Ui>Más</Ui> y elige <Ui>Etiquetas QR</Ui>.
            </li>
            <li>
              Pulsa <Ui>Imprimir</Ui>. Cada etiqueta lleva el QR, el nombre del registro y, si la tabla tiene una
              columna de valor único (como el SKU o la referencia), ese valor.
            </li>
          </ol>
          <p>Usa papel adhesivo para pegarlas en las estanterías, los equipos o las cajas.</p>
        </>
      ),
    },
    {
      id: "escanear",
      title: "Escanear etiquetas y códigos de barras",
      body: (
        <>
          <p>
            Escanea la etiqueta con la cámara del móvil y se abre la ficha del registro. Desde ella puedes anotar una
            entrada o una salida de <DocLink to="stock">stock</DocLink> sin buscar el producto.
          </p>
          <p>
            También puedes escanear desde la propia app, con el botón <Ui>Escanear un código</Ui>, que sirve para la
            etiqueta y también para el código de barras que trae un producto:
          </p>
          <ul>
            <li>
              <strong>En una tabla</strong> (junto a la búsqueda): una etiqueta QR abre su registro. Cualquier otro
              código, como el EAN de una caja, se busca en la tabla; si solo coincide un registro, se abre su ficha. Así
              encuentras un producto por su código si lo guardas en una columna, por ejemplo <Ui>Referencia</Ui>.
            </li>
            <li>
              <strong>En la barra superior,</strong> desde cualquier pantalla: abre la etiqueta QR de un registro.
            </li>
          </ul>
          <p>
            La primera vez, el navegador pide permiso para usar la cámara. Si no hay cámara o prefieres no usarla,
            escribe el código en el mismo cuadro. Lee QR, EAN, UPC, Code 128, Code 39, ITF y Data Matrix, en Chrome,
            Edge, Safari y Firefox.
          </p>
          <Note>
            El QR solo lleva el enlace, no los datos. Quien no tenga acceso a la tabla tendrá que iniciar sesión y no
            verá nada.
          </Note>
        </>
      ),
    },
    {
      id: "adjuntos",
      title: "Adjuntos: fotos y documentos",
      body: (
        <>
          <p>
            En la ficha, la sección <Ui>Adjuntos</Ui> guarda fotos y documentos del registro: la foto del producto, su
            factura o el manual de un equipo. Pulsa <Ui>Añadir archivos</Ui> para subirlos.
          </p>
          <ul>
            <li>Imágenes JPG, PNG o WebP y documentos PDF, de hasta 5 MB cada uno.</li>
            <li>Hasta 10 adjuntos por registro y 50 MB en total por espacio.</li>
            <li>Para subirlos o eliminarlos necesitas permiso de editor; quien solo lee puede verlos y descargarlos.</li>
          </ul>
          <p>
            Los archivos se guardan en un almacenamiento privado: cada vista o descarga usa un enlace que caduca en unos
            minutos. En la demo no se pueden subir adjuntos.
          </p>
        </>
      ),
    },
  ],
};
