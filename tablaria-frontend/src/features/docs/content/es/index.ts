import type { DocGroup } from "../../types";
import { asistente } from "./asistente";
import { atajos } from "./atajos";
import { columnas } from "./columnas";
import { compartir } from "./compartir";
import { cuenta } from "./cuenta";
import { etiquetasQr } from "./etiquetas-qr";
import { formulas } from "./formulas";
import { importarExportar } from "./importar-exportar";
import { metricas } from "./metricas";
import { organizaciones } from "./organizaciones";
import { primerosPasos } from "./primeros-pasos";
import { registros } from "./registros";
import { relaciones } from "./relaciones";
import { stock } from "./stock";
import { tiempoReal } from "./tiempo-real";
import { vistasYLote } from "./vistas-y-lote";

/** The help in Spanish, in reading order: the menu, the index and previous / next follow it. */
export const DOCS_ES: DocGroup[] = [
  { title: "Primeros pasos", articles: [primerosPasos] },
  {
    title: "Tablas y datos",
    articles: [columnas, registros, vistasYLote, relaciones, formulas, importarExportar],
  },
  { title: "Inventario", articles: [stock, metricas, etiquetasQr] },
  { title: "Trabajo en equipo", articles: [compartir, organizaciones, tiempoReal] },
  { title: "Asistente de IA", articles: [asistente] },
  { title: "Tu cuenta", articles: [cuenta, atajos] },
];
