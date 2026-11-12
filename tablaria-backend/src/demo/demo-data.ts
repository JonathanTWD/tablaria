import {
  type CellValue,
  type ColumnDefinitionInput,
  type RollupFunction,
  TABLE_TEMPLATES,
} from '@tablaria/shared';
import type { Role, StockMovementKind } from '../generated/prisma/client';

/**
 * The demo's tables (ADR-037): a hardware shop whose tables link to each
 * other, so a visitor sees every kind of column, the metrics, the stock
 * history and the activity without building anything first.
 */

export type DemoTableKey =
  'products' | 'suppliers' | 'orders' | 'equipment' | 'warehouse';

/** A column of a demo table. Links name tables by key and columns by name. */
export type DemoColumn =
  | ColumnDefinitionInput
  | { name: string; type: 'relation'; table: DemoTableKey; multiple?: boolean }
  | { name: string; type: 'lookup'; relation: string; target: string }
  | {
      name: string;
      type: 'rollup';
      /** The table whose relation links here, and that relation's name. */
      table: DemoTableKey;
      relation: string;
      function: RollupFunction;
      target?: string;
    }
  | { name: string; type: 'formula'; expression: string; currency?: string };

/** A stock change after the first count, written with its date and author. */
export interface DemoMovement {
  /** The record's first cell. */
  record: string;
  kind: Extract<StockMovementKind, 'IN' | 'OUT' | 'COUNT'>;
  delta: number;
  note: string;
  daysAgo: number;
  /** A member of the example organization; the visitor otherwise. */
  by?: string;
}

export interface DemoTable {
  key: DemoTableKey;
  name: string;
  description: string;
  /** In the example organization instead of the personal space. */
  inOrganization?: boolean;
  columns: DemoColumn[];
  /**
   * Cell values keyed by column name. A relation cell names the records it
   * links to by their first cell, as the table shows them.
   */
  rows: Record<string, CellValue>[];
  /** Records were added over this many days, the last one today. */
  spreadDays: number;
  movements?: DemoMovement[];
  /** Who added the records: a member of the example organization. */
  addedBy?: string;
}

/** An ISO date `days` before `today`. */
function daysAgo(today: Date, days: number): string {
  const date = new Date(today);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/** An ISO date `days` after `today`: deliveries and warranties still to come. */
function daysAhead(today: Date, days: number): string {
  return daysAgo(today, -days);
}

const EUR = { currency: 'EUR' };

/**
 * Written in Spanish: like the templates, this becomes the visitor's own
 * data. Dates count back from `today`, so the timelines always look recent.
 * Tables come in the order they are filled: linked tables first.
 */
export function demoTables(today: Date): DemoTable[] {
  return [
    {
      key: 'suppliers',
      name: 'Proveedores',
      description:
        'Quién nos sirve cada producto, cómo contactarle y cuánto tarda en entregar.',
      spreadDays: 120,
      columns: [
        { name: 'Nombre', type: 'text', required: true, unique: true },
        { name: 'Contacto', type: 'text' },
        { name: 'Teléfono', type: 'text' },
        { name: 'Email', type: 'text' },
        { name: 'Entrega (días)', type: 'number' },
        {
          name: 'Productos',
          type: 'rollup',
          table: 'products',
          relation: 'Proveedor',
          function: 'count',
        },
        {
          name: 'Unidades en stock',
          type: 'rollup',
          table: 'products',
          relation: 'Proveedor',
          function: 'sum',
          target: 'Stock',
        },
      ],
      rows: [
        {
          Nombre: 'Suministros Norte',
          Contacto: 'Ana Ruiz',
          Teléfono: '944 120 300',
          Email: 'pedidos@suministrosnorte.example',
          'Entrega (días)': 3,
        },
        {
          Nombre: 'Ferrotool',
          Contacto: 'Carlos Vega',
          Teléfono: '961 555 210',
          Email: 'ventas@ferrotool.example',
          'Entrega (días)': 5,
        },
        {
          Nombre: 'Medición Precisa',
          Contacto: 'Irene Soto',
          Teléfono: '911 230 450',
          Email: 'hola@medicionprecisa.example',
          'Entrega (días)': 7,
        },
        {
          Nombre: 'Fijaciones Levante',
          Contacto: 'Pablo Gil',
          Teléfono: '963 874 112',
          Email: 'comercial@fijacioneslevante.example',
          'Entrega (días)': 2,
        },
      ],
    },
    {
      key: 'products',
      name: 'Productos',
      description:
        'El catálogo de la ferretería: precios, márgenes, stock y de qué proveedor viene cada producto.',
      spreadDays: 90,
      columns: [
        { name: 'Producto', type: 'text', required: true },
        { name: 'Referencia', type: 'text', unique: true },
        {
          name: 'Categoría',
          type: 'select',
          options: {
            choices: [
              { id: 'power', label: 'Eléctricas', color: 'blue' },
              { id: 'hand', label: 'Manuales', color: 'amber' },
              { id: 'measure', label: 'Medición', color: 'teal' },
              { id: 'fixings', label: 'Fijaciones', color: 'purple' },
              { id: 'other', label: 'Otros', color: 'gray' },
            ],
          },
        },
        { name: 'Proveedor', type: 'relation', table: 'suppliers' },
        {
          name: 'Teléfono del proveedor',
          type: 'lookup',
          relation: 'Proveedor',
          target: 'Teléfono',
        },
        { name: 'Precio', type: 'currency', options: EUR },
        { name: 'Coste', type: 'currency', options: EUR },
        {
          name: 'Margen',
          type: 'formula',
          expression: '{Precio} - {Coste}',
          currency: 'EUR',
        },
        {
          name: 'Stock',
          type: 'number',
          stock: true,
          defaultValue: 0,
          options: { alertBelow: 5 },
        },
        {
          name: 'Valor del stock',
          type: 'formula',
          expression: '{Coste} * {Stock}',
          currency: 'EUR',
        },
        {
          name: 'Estado',
          type: 'select',
          defaultValue: 'Disponible',
          options: {
            choices: [
              { id: 'available', label: 'Disponible', color: 'green' },
              { id: 'out-of-stock', label: 'Agotado', color: 'red' },
              { id: 'discontinued', label: 'Descatalogado', color: 'gray' },
            ],
          },
        },
        { name: 'Destacado', type: 'boolean', defaultValue: false },
        // The EAN-13 on each box: the in-app scanner finds a product by it (ADR-051).
        { name: 'Código de barras', type: 'text', unique: true },
        {
          name: 'Pedidos',
          type: 'rollup',
          table: 'orders',
          relation: 'Productos',
          function: 'count',
        },
      ],
      rows: [
        product(
          'Taladro percutor 750 W',
          'TL-750',
          'Eléctricas',
          'Ferrotool',
          89.9,
          52.4,
          14,
          true,
        ),
        product(
          'Atornillador a batería 12 V',
          'AT-012',
          'Eléctricas',
          'Ferrotool',
          64.5,
          38,
          9,
          true,
        ),
        product(
          'Sierra de calar',
          'SC-650',
          'Eléctricas',
          'Ferrotool',
          74,
          45.1,
          0,
          false,
          'Agotado',
        ),
        product(
          'Martillo de carpintero',
          'MT-010',
          'Manuales',
          'Suministros Norte',
          12.5,
          5.9,
          32,
          false,
        ),
        product(
          'Juego de destornilladores (8 pzas)',
          'DS-008',
          'Manuales',
          'Suministros Norte',
          18.95,
          9.2,
          21,
          false,
        ),
        product(
          'Llave inglesa 250 mm',
          'LL-250',
          'Manuales',
          'Suministros Norte',
          15.4,
          7.8,
          7,
          false,
        ),
        product(
          'Cinta métrica 5 m',
          'CM-005',
          'Medición',
          'Medición Precisa',
          8.75,
          3.9,
          3,
          false,
        ),
        product(
          'Nivel de burbuja 60 cm',
          'NV-060',
          'Medición',
          'Medición Precisa',
          14.2,
          6.5,
          0,
          false,
          'Agotado',
        ),
        product(
          'Caja de tornillos 4×40 (200 u.)',
          'TR-440',
          'Fijaciones',
          'Fijaciones Levante',
          6.2,
          2.4,
          120,
          false,
        ),
        product(
          'Tacos de nailon 8 mm (100 u.)',
          'TC-008',
          'Fijaciones',
          'Fijaciones Levante',
          4.9,
          1.8,
          2,
          false,
        ),
        product(
          'Silicona neutra transparente',
          'SL-280',
          'Otros',
          'Suministros Norte',
          5.6,
          2.3,
          18,
          false,
        ),
        product(
          'Escalera de aluminio 5 peldaños',
          'ES-005',
          'Otros',
          null,
          79,
          48,
          6,
          false,
          'Descatalogado',
        ),
      ],
      movements: [
        {
          record: 'Taladro percutor 750 W',
          kind: 'IN',
          delta: 10,
          note: 'Entrega de Ferrotool',
          daysAgo: 20,
        },
        {
          record: 'Taladro percutor 750 W',
          kind: 'OUT',
          delta: -3,
          note: 'Pedido PED-1038',
          daysAgo: 12,
        },
        {
          record: 'Taladro percutor 750 W',
          kind: 'OUT',
          delta: -1,
          note: 'Venta en mostrador',
          daysAgo: 4,
        },
        {
          record: 'Tacos de nailon 8 mm (100 u.)',
          kind: 'OUT',
          delta: -6,
          note: 'Pedido PED-1039',
          daysAgo: 6,
        },
        {
          record: 'Cinta métrica 5 m',
          kind: 'COUNT',
          delta: -2,
          note: 'Recuento: dos dañadas',
          daysAgo: 9,
        },
        {
          record: 'Caja de tornillos 4×40 (200 u.)',
          kind: 'IN',
          delta: 60,
          note: 'Entrega de Fijaciones Levante',
          daysAgo: 15,
        },
        {
          record: 'Sierra de calar',
          kind: 'OUT',
          delta: -2,
          note: 'Pedido PED-1036',
          daysAgo: 25,
        },
      ],
    },
    {
      key: 'orders',
      name: 'Pedidos',
      description:
        'Pedidos de clientes: qué productos llevan, cuánto suman y en qué punto están.',
      spreadDays: 150,
      columns: [
        { name: 'Pedido', type: 'text', required: true, unique: true },
        { name: 'Cliente', type: 'text' },
        { name: 'Fecha', type: 'date' },
        // Upcoming deliveries fill the calendar and, a week ahead, "Próximamente".
        { name: 'Entrega', type: 'date', options: { alertDaysBefore: 7 } },
        {
          name: 'Productos',
          type: 'relation',
          table: 'products',
          multiple: true,
        },
        { name: 'Importe', type: 'currency', options: EUR },
        {
          name: 'Estado',
          type: 'select',
          defaultValue: 'Pendiente',
          options: {
            choices: [
              { id: 'pending', label: 'Pendiente', color: 'amber' },
              { id: 'sent', label: 'Enviado', color: 'blue' },
              { id: 'delivered', label: 'Entregado', color: 'green' },
            ],
          },
        },
        { name: 'Pagado', type: 'boolean', defaultValue: false },
      ],
      rows: [
        order(
          'PED-1031',
          'Reformas Sol',
          daysAgo(today, 148),
          daysAgo(today, 144),
          'Taladro percutor 750 W, Caja de tornillos 4×40 (200 u.)',
          102.3,
          'Entregado',
          true,
        ),
        order(
          'PED-1032',
          'María Gómez',
          daysAgo(today, 131),
          daysAgo(today, 128),
          'Martillo de carpintero',
          12.5,
          'Entregado',
          true,
        ),
        order(
          'PED-1033',
          'Construcciones Ebro',
          daysAgo(today, 117),
          daysAgo(today, 112),
          'Atornillador a batería 12 V, Juego de destornilladores (8 pzas), Llave inglesa 250 mm',
          98.85,
          'Entregado',
          true,
        ),
        order(
          'PED-1034',
          'Taller Ruiz',
          daysAgo(today, 96),
          daysAgo(today, 92),
          'Llave inglesa 250 mm, Cinta métrica 5 m',
          24.15,
          'Entregado',
          true,
        ),
        order(
          'PED-1035',
          'Reformas Sol',
          daysAgo(today, 74),
          daysAgo(today, 70),
          'Nivel de burbuja 60 cm, Cinta métrica 5 m',
          22.95,
          'Entregado',
          true,
        ),
        order(
          'PED-1036',
          'Construcciones Ebro',
          daysAgo(today, 52),
          daysAgo(today, 47),
          'Sierra de calar, Tacos de nailon 8 mm (100 u.)',
          78.9,
          'Entregado',
          true,
        ),
        order(
          'PED-1037',
          'Jorge Martín',
          daysAgo(today, 33),
          daysAgo(today, 30),
          'Silicona neutra transparente',
          5.6,
          'Entregado',
          false,
        ),
        order(
          'PED-1038',
          'Reformas Sol',
          daysAgo(today, 12),
          daysAhead(today, 1),
          'Taladro percutor 750 W, Atornillador a batería 12 V, Caja de tornillos 4×40 (200 u.)',
          160.6,
          'Enviado',
          true,
        ),
        order(
          'PED-1039',
          'Taller Ruiz',
          daysAgo(today, 6),
          daysAhead(today, 2),
          'Tacos de nailon 8 mm (100 u.), Martillo de carpintero',
          17.4,
          'Enviado',
          false,
        ),
        order(
          'PED-1040',
          'Construcciones Ebro',
          daysAgo(today, 1),
          daysAhead(today, 5),
          'Taladro percutor 750 W',
          89.9,
          'Pendiente',
          false,
        ),
        order(
          'PED-1041',
          'Hostal La Plaza',
          daysAgo(today, 0),
          daysAhead(today, 3),
          'Cinta métrica 5 m, Nivel de burbuja 60 cm',
          22.95,
          'Pendiente',
          false,
        ),
        order(
          'PED-1042',
          'María Gómez',
          daysAgo(today, 0),
          daysAhead(today, 7),
          'Silicona neutra transparente',
          5.6,
          'Pendiente',
          true,
        ),
        order(
          'PED-1043',
          'Reformas Sol',
          daysAgo(today, 2),
          daysAhead(today, 9),
          'Sierra de calar',
          74,
          'Enviado',
          true,
        ),
        order(
          'PED-1044',
          'Taller Ruiz',
          daysAgo(today, 3),
          daysAhead(today, 12),
          'Juego de destornilladores (8 pzas)',
          18.95,
          'Pendiente',
          false,
        ),
        order(
          'PED-1045',
          'Construcciones Ebro',
          daysAgo(today, 4),
          daysAhead(today, 16),
          'Tacos de nailon 8 mm (100 u.), Caja de tornillos 4×40 (200 u.)',
          11.1,
          'Pendiente',
          false,
        ),
      ],
    },
    {
      key: 'equipment',
      name: 'Equipos de la oficina',
      description:
        'Portátiles, pantallas y otros equipos: quién los tiene y en qué estado están.',
      spreadDays: 60,
      // Warranties ending in the coming weeks show on the calendar.
      columns: [
        ...TABLE_TEMPLATES.assets,
        {
          name: 'Fin de garantía',
          type: 'date',
          options: { alertDaysBefore: 15 },
        },
      ],
      rows: [
        {
          Equipo: 'Portátil 14" Dell Latitude',
          'Nº de serie': 'DL14-7H2K9',
          Estado: 'En uso',
          'Asignado a': 'Laura Martín',
          'Fecha de compra': '2025-03-14',
          Valor: 1149,
          'Fin de garantía': daysAhead(today, 4),
        },
        {
          Equipo: 'Portátil 14" Dell Latitude',
          'Nº de serie': 'DL14-8J4P1',
          Estado: 'En uso',
          'Asignado a': 'Carlos Ruiz',
          'Fecha de compra': '2025-03-14',
          Valor: 1149,
          'Fin de garantía': daysAhead(today, 4),
        },
        {
          Equipo: 'MacBook Air 13"',
          'Nº de serie': 'MBA13-Q9X3',
          Estado: 'En reparación',
          'Asignado a': 'Ana Gómez',
          'Fecha de compra': '2024-11-05',
          Valor: 1299,
          'Fin de garantía': daysAhead(today, 11),
        },
        {
          Equipo: 'Monitor 27" LG',
          'Nº de serie': 'LG27-55821',
          Estado: 'En uso',
          'Asignado a': 'Laura Martín',
          'Fecha de compra': '2025-01-20',
          Valor: 289,
          'Fin de garantía': daysAhead(today, 19),
        },
        {
          Equipo: 'Monitor 27" LG',
          'Nº de serie': 'LG27-55822',
          Estado: 'Almacenado',
          'Fecha de compra': '2025-01-20',
          Valor: 289,
          'Fin de garantía': daysAhead(today, 19),
        },
        {
          Equipo: 'Impresora láser HP',
          'Nº de serie': 'HPL-20391',
          Estado: 'En uso',
          'Asignado a': 'Recepción',
          'Fecha de compra': '2023-06-02',
          Valor: 349,
          'Fin de garantía': daysAgo(today, 150),
        },
        {
          Equipo: 'Teléfono IP Yealink',
          'Nº de serie': 'YL-T46-0112',
          Estado: 'De baja',
          'Fecha de compra': '2021-09-15',
          Valor: 120,
        },
        {
          Equipo: 'Proyector Epson',
          'Nº de serie': 'EP-X41-778',
          Estado: 'Almacenado',
          'Asignado a': 'Sala de reuniones',
          'Fecha de compra': '2022-02-28',
          Valor: 539,
          'Fin de garantía': daysAhead(today, 26),
        },
      ],
    },
    {
      key: 'warehouse',
      name: 'Almacén central',
      description: 'Existencias por ubicación y fecha de la última revisión.',
      inOrganization: true,
      spreadDays: 45,
      addedBy: 'marta.garcia',
      columns: TABLE_TEMPLATES['basic-inventory'],
      rows: [
        {
          Producto: 'Cajas de cartón 40×30',
          SKU: 'EMB-4030',
          Cantidad: 320,
          Ubicación: 'Pasillo A · Estante 1',
          'Última revisión': daysAgo(today, 30),
        },
        {
          Producto: 'Cinta adhesiva marrón',
          SKU: 'EMB-CINTA',
          Cantidad: 48,
          Ubicación: 'Pasillo A · Estante 2',
          'Última revisión': daysAgo(today, 30),
        },
        {
          Producto: 'Film estirable',
          SKU: 'EMB-FILM',
          Cantidad: 12,
          Ubicación: 'Pasillo A · Estante 3',
          'Última revisión': daysAgo(today, 44),
        },
        {
          Producto: 'Palés europeos',
          SKU: 'LOG-PALE',
          Cantidad: 26,
          Ubicación: 'Muelle de carga',
          'Última revisión': daysAgo(today, 22),
        },
        {
          Producto: 'Guantes de trabajo (talla L)',
          SKU: 'EPI-GUA-L',
          Cantidad: 4,
          Ubicación: 'Pasillo C · Estante 1',
          'Última revisión': daysAgo(today, 32),
        },
        {
          Producto: 'Chalecos reflectantes',
          SKU: 'EPI-CHAL',
          Cantidad: 15,
          Ubicación: 'Pasillo C · Estante 1',
          'Última revisión': daysAgo(today, 32),
        },
        {
          Producto: 'Etiquetas térmicas 100×150',
          SKU: 'ETQ-100',
          Cantidad: 0,
          Ubicación: 'Pasillo B · Estante 4',
          'Última revisión': daysAgo(today, 20),
        },
        {
          Producto: 'Transpalé manual',
          SKU: 'LOG-TRANS',
          Cantidad: 2,
          Ubicación: 'Muelle de carga',
          'Última revisión': daysAgo(today, 72),
        },
        {
          Producto: 'Bridas de plástico',
          SKU: 'FIJ-BRIDA',
          Cantidad: 950,
          Ubicación: 'Pasillo B · Estante 2',
        },
      ],
      movements: [
        {
          record: 'Cajas de cartón 40×30',
          kind: 'OUT',
          delta: -80,
          note: 'Envíos de la semana',
          daysAgo: 8,
          by: 'javier.ruiz',
        },
        {
          record: 'Guantes de trabajo (talla L)',
          kind: 'OUT',
          delta: -6,
          note: 'Reparto al equipo',
          daysAgo: 5,
          by: 'javier.ruiz',
        },
        {
          record: 'Palés europeos',
          kind: 'IN',
          delta: 10,
          note: 'Devolución de transportista',
          daysAgo: 3,
          by: 'marta.garcia',
        },
      ],
    },
  ];
}

/** Valid EAN-13 codes (Spanish 84 prefix), one per demo product. */
const BARCODES: Record<string, string> = {
  'Taladro percutor 750 W': '8436045100108',
  'Atornillador a batería 12 V': '8436045100177',
  'Sierra de calar': '8436045100245',
  'Martillo de carpintero': '8436045100313',
  'Juego de destornilladores (8 pzas)': '8436045100382',
  'Llave inglesa 250 mm': '8436045100450',
  'Cinta métrica 5 m': '8436045100528',
  'Nivel de burbuja 60 cm': '8436045100597',
  'Caja de tornillos 4×40 (200 u.)': '8436045100665',
  'Tacos de nailon 8 mm (100 u.)': '8436045100733',
  'Silicona neutra transparente': '8436045100801',
  'Escalera de aluminio 5 peldaños': '8436045100870',
};

function product(
  name: string,
  reference: string,
  category: string,
  supplier: string | null,
  price: number,
  cost: number,
  stock: number,
  featured: boolean,
  status = 'Disponible',
): Record<string, CellValue> {
  return {
    Producto: name,
    Referencia: reference,
    Categoría: category,
    Proveedor: supplier,
    Precio: price,
    Coste: cost,
    Stock: stock,
    Estado: status,
    Destacado: featured,
    'Código de barras': BARCODES[name] ?? null,
  };
}

function order(
  code: string,
  customer: string,
  date: string,
  delivery: string,
  products: string,
  amount: number,
  status: string,
  paid: boolean,
): Record<string, CellValue> {
  return {
    Pedido: code,
    Cliente: customer,
    Fecha: date,
    Entrega: delivery,
    Productos: products,
    Importe: amount,
    Estado: status,
    Pagado: paid,
  };
}

/**
 * An organization the visitor owns, so the demo shows teamwork too. Its other
 * members are fictitious accounts that nobody can sign in to.
 */
export const DEMO_ORGANIZATION: {
  name: string;
  members: { name: string; role: Exclude<Role, 'OWNER'> }[];
} = {
  name: 'Equipo de la tienda',
  members: [
    { name: 'marta.garcia', role: 'ADMIN' },
    { name: 'javier.ruiz', role: 'EDITOR' },
    { name: 'lucia.sanz', role: 'VIEWER' },
  ],
};
