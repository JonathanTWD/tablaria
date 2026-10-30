import { columnDefinitionSchema, type TableColumn } from "@tablaria/shared";
import { describe, expect, it } from "vitest";
import { applicableView, parseRecordsView } from "./records-view";

const PRICE_ID = "0b8d6c2e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const NAME_ID = "1c9e7d3f-2b3c-4d4e-9f0a-1b2c3d4e5f60";

function column(id: string, definition: object): TableColumn {
  return {
    ...columnDefinitionSchema.parse({ name: "Column", ...definition }),
    id,
    position: 0,
    createdAt: "",
    updatedAt: "",
  };
}

describe("parseRecordsView", () => {
  it("reads every part of the view from the URL", () => {
    const filters = [{ columnId: PRICE_ID, op: "between", min: 10 }];
    const params = new URLSearchParams({
      page: "3",
      pageSize: "50",
      q: "taladro",
      sort: PRICE_ID,
      order: "desc",
      filters: JSON.stringify(filters),
    });

    expect(parseRecordsView(params)).toEqual({
      page: 3,
      pageSize: 50,
      search: "taladro",
      sort: PRICE_ID,
      order: "desc",
      filters,
    });
  });

  it("falls back to defaults one parameter at a time", () => {
    const params = new URLSearchParams({
      page: "abc",
      pageSize: "1000",
      q: "taladro",
      sort: "not-a-uuid",
      filters: "{broken",
    });

    expect(parseRecordsView(params)).toEqual({
      page: 1,
      pageSize: 10,
      search: "taladro",
      sort: undefined,
      order: "asc",
      filters: [],
    });
  });
});

describe("applicableView", () => {
  it("drops the sort and filters of columns that no longer fit", () => {
    const columns = [column(NAME_ID, { type: "text" }), column(PRICE_ID, { type: "number" })];
    const view = parseRecordsView(
      new URLSearchParams({
        sort: "2d0f8e4a-3c4d-4e5f-8a0b-2c3d4e5f6071",
        filters: JSON.stringify([
          { columnId: NAME_ID, op: "contains", value: "a" },
          // A range filter on a text column: the column changed type since the link was made.
          { columnId: NAME_ID, op: "between", min: 1 },
          { columnId: "2d0f8e4a-3c4d-4e5f-8a0b-2c3d4e5f6071", op: "is", value: true },
        ]),
      }),
    );

    const applicable = applicableView(view, columns);

    expect(applicable.sort).toBeUndefined();
    expect(applicable.filters).toEqual([{ columnId: NAME_ID, op: "contains", value: "a" }]);
  });
});
