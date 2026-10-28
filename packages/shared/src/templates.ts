import type { ColumnDefinitionInput } from "./column-types.js";

export const TABLE_TEMPLATE_IDS = ["basic-inventory", "product-catalog", "assets"] as const;

export type TableTemplateId = (typeof TABLE_TEMPLATE_IDS)[number];

// Column names become the user's own data, so they are written in Spanish, the
// product's primary language. Template names and descriptions are translated in the UI.
export const TABLE_TEMPLATES: Record<TableTemplateId, ColumnDefinitionInput[]> = {
  "basic-inventory": [
    { name: "Producto", type: "text", required: true },
    { name: "SKU", type: "text" },
    {
      name: "Cantidad",
      type: "number",
      required: true,
      defaultValue: 0,
      options: { alertBelow: 5 },
    },
    { name: "Ubicación", type: "text" },
    { name: "Última revisión", type: "date" },
  ],
  "product-catalog": [
    { name: "Producto", type: "text", required: true },
    { name: "Referencia", type: "text" },
    { name: "Categoría", type: "text" },
    { name: "Precio", type: "currency", options: { currency: "EUR" } },
    { name: "Stock", type: "number", defaultValue: 0, options: { alertBelow: 5 } },
    {
      name: "Estado",
      type: "select",
      defaultValue: "Disponible",
      options: {
        choices: [
          { id: "available", label: "Disponible", color: "green" },
          { id: "out-of-stock", label: "Agotado", color: "red" },
          { id: "discontinued", label: "Descatalogado", color: "gray" },
        ],
      },
    },
    { name: "Destacado", type: "boolean", defaultValue: false },
  ],
  assets: [
    { name: "Equipo", type: "text", required: true },
    { name: "Nº de serie", type: "text" },
    {
      name: "Estado",
      type: "select",
      defaultValue: "En uso",
      options: {
        choices: [
          { id: "in-use", label: "En uso", color: "green" },
          { id: "stored", label: "Almacenado", color: "gray" },
          { id: "repair", label: "En reparación", color: "amber" },
          { id: "retired", label: "De baja", color: "red" },
        ],
      },
    },
    { name: "Asignado a", type: "text" },
    { name: "Fecha de compra", type: "date" },
    { name: "Valor", type: "currency", options: { currency: "EUR" } },
  ],
};
