import "../setup-dom";
import { mockToastError } from "../helpers/mock-sonner";
import { describe, test, expect, mock, beforeEach } from "bun:test";
import { useState } from "react";
import { renderHook, act } from "@testing-library/react";
import { useSchemaDetails } from "@/hooks/use-schema-details";
import type { TableSchema } from "@/lib/types";

const inventory: TableSchema[] = ["users", "orders"].map((name) => ({
  name,
  columns: [],
  indexes: [],
  detailsLoaded: false,
}));
const complete: TableSchema[] = inventory.map(({ detailsLoaded: _, ...table }) => ({
  ...table,
  columns: [{ name: "id", type: "INTEGER", nullable: false, isPrimary: true }],
}));
function setup(load: (name?: string) => Promise<TableSchema[]>, initial = inventory, id: string | undefined = "one") {
  return renderHook(
    ({ connectionId }: { connectionId: string | undefined }) => {
      const [schema, setSchema] = useState(initial);
      return { schema, ...useSchemaDetails(connectionId, schema, setSchema, load) };
    },
    { initialProps: { connectionId: id } as { connectionId: string | undefined } },
  );
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("lazy schema details", () => {
  beforeEach(() => mockToastError.mockClear());

  test("loads one table, preserves pending peers, then uses cached details", async () => {
    const load = mock(async () => [complete[0]]);
    const { result } = setup(load);
    await act(async () => {
      expect(await result.current.ensureSchema("users")).toEqual([complete[0]]);
    });
    expect(result.current.schema).toEqual([complete[0], inventory[1]]);
    await act(async () => {
      expect(await result.current.ensureSchema("users")).toEqual([complete[0]]);
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith("users");
  });

  test("coalesces concurrent table requests", async () => {
    const response = deferred<TableSchema[]>();
    const load = mock(() => response.promise);
    const { result } = setup(load);
    await act(async () => {
      const first = result.current.ensureSchema("users");
      const second = result.current.ensureSchema("users");
      response.resolve([complete[0]]);
      expect(await first).toEqual(await second);
    });
    expect(load).toHaveBeenCalledTimes(1);
  });

  test("full schema is explicit and replaces the inventory", async () => {
    const response = deferred<TableSchema[]>();
    const load = mock(() => response.promise);
    const { result } = setup(load);
    let request!: Promise<TableSchema[] | null>;
    act(() => {
      request = result.current.ensureSchema();
    });
    expect(result.current.isLoadingFullSchema).toBe(true);
    await act(async () => {
      response.resolve(complete);
      await request;
    });
    expect(result.current.schema).toEqual(complete);
    expect(result.current.isLoadingFullSchema).toBe(false);
    expect(await result.current.ensureSchema()).toEqual(complete);
    expect(load).toHaveBeenCalledTimes(1);
  });

  test("no connection and unknown tables never initiate reads", async () => {
    const load = mock(async () => complete);
    const { result, rerender } = setup(load);
    expect(await result.current.ensureSchema("missing")).toBeNull();
    rerender({ connectionId: undefined });
    expect(await result.current.ensureSchema()).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  test.each([new Error("timed out"), "unavailable"])(
    "failed reads preserve the inventory and can be retried: %s",
    async (error) => {
      const load = mock(async (): Promise<TableSchema[]> => {
        throw error;
      });
      const { result } = setup(load);
      await act(async () => {
        expect(await result.current.ensureSchema("users")).toBeNull();
      });
      expect(result.current.schema).toEqual(inventory);
      expect(mockToastError).toHaveBeenCalled();
      load.mockResolvedValue([complete[0]]);
      await act(async () => {
        expect(await result.current.ensureSchema("users")).toEqual([complete[0]]);
      });
    },
  );

  test.each([{ response: [] }, { response: [complete[1]] }, { response: inventory }])(
    "rejects missing, wrong or still-pending table responses: %j",
    async ({ response }) => {
      const { result } = setup(async () => [...response]);
      await act(async () => {
        expect(await result.current.ensureSchema("users")).toBeNull();
      });
      expect(result.current.schema).toEqual(inventory);
    },
  );

  test("connection changes discard old full reads and clear the loading indicator", async () => {
    const response = deferred<TableSchema[]>();
    const { result, rerender } = setup(() => response.promise);
    let request!: Promise<TableSchema[] | null>;
    act(() => {
      request = result.current.ensureSchema();
    });
    rerender({ connectionId: "two" });
    expect(result.current.isLoadingFullSchema).toBe(false);
    await act(async () => {
      response.resolve(complete);
      expect(await request).toBeNull();
    });
    expect(result.current.schema).toEqual(inventory);
  });

  test("refresh supersedes an in-flight table read even when names match", async () => {
    const old = deferred<TableSchema[]>();
    const fresh = deferred<TableSchema[]>();
    const load = mock(() => old.promise)
      .mockImplementationOnce(() => old.promise)
      .mockImplementationOnce(() => fresh.promise);
    const { result } = setup(load);
    let first!: Promise<TableSchema[] | null>;
    await act(async () => {
      first = result.current.ensureSchema("users");
    });
    result.current.startSchemaLoad();
    let second!: Promise<TableSchema[] | null>;
    await act(async () => {
      second = result.current.ensureSchema("users");
    });
    await act(async () => {
      old.resolve([complete[0]]);
      expect(await first).toBeNull();
    });
    const renamedColumn = { ...complete[0], columns: [{ ...complete[0].columns[0], name: "new_id" }] };
    await act(async () => {
      fresh.resolve([renamedColumn]);
      expect(await second).toEqual([renamedColumn]);
    });
    expect(result.current.schema[0]).toEqual(renamedColumn);
  });

  test("errors from a previous connection do not notify the current one", async () => {
    const response = deferred<TableSchema[]>();
    const { result, rerender } = setup(async () => {
      await response.promise;
      throw new Error("old connection");
    });
    const request = result.current.ensureSchema("users");
    rerender({ connectionId: "two" });
    await act(async () => {
      response.resolve([]);
      expect(await request).toBeNull();
    });
    expect(mockToastError).not.toHaveBeenCalled();
  });
});
