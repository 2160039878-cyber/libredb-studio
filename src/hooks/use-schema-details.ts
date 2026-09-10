"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { TableSchema } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

/** Shared by the standalone and host-managed shells. A refresh invalidates pending details. */
export function useSchemaDetails(
  connectionId: string | undefined,
  schema: TableSchema[],
  setSchema: Dispatch<SetStateAction<TableSchema[]>>,
  load: (tableName?: string) => Promise<TableSchema[]>,
) {
  const generation = useRef(0);
  const pending = useRef(new Map<string | undefined, { version: number; request: Promise<TableSchema[] | null> }>());
  const [isLoadingFullSchema, setIsLoadingFullSchema] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!connectionId) return;
    const requests = pending.current;
    return () => {
      generation.current += 1;
      requests.clear();
      setIsLoadingFullSchema(false);
    };
  }, [connectionId]);

  const startSchemaLoad = useCallback(() => {
    const version = ++generation.current;
    return () => version === generation.current;
  }, []);

  const ensureSchema = useCallback(
    async (tableName?: string): Promise<TableSchema[] | null> => {
      if (!connectionId) return null;
      const selected = tableName === undefined ? schema : schema.filter((table) => table.name === tableName);
      if (tableName !== undefined && selected.length === 0) return null;
      if (selected.every((table) => table.detailsLoaded !== false)) return selected;

      const existing = pending.current.get(tableName);
      if (existing?.version === generation.current) return existing.request;
      const version = generation.current;
      if (tableName === undefined) setIsLoadingFullSchema(true);
      const request: Promise<TableSchema[] | null> = Promise.resolve().then(async () => {
        try {
          const details = await load(tableName);
          if (version !== generation.current) return null;
          if (
            details.some((table) => table.detailsLoaded === false) ||
            (tableName !== undefined && (details.length !== 1 || details[0].name !== tableName))
          ) {
            throw new Error("Table details could not be read. Refresh the schema and try again.");
          }
          setSchema((current) =>
            tableName === undefined ? details : current.map((table) => (table.name === tableName ? details[0] : table)),
          );
          return details;
        } catch (error) {
          if (version === generation.current) {
            toast({
              title: "Schema Error",
              description: error instanceof Error ? error.message : "Failed to fetch table details",
              variant: "destructive",
            });
          }
          return null;
        } finally {
          if (pending.current.get(tableName)?.request === request) {
            pending.current.delete(tableName);
            if (tableName === undefined) setIsLoadingFullSchema(false);
          }
        }
      });
      pending.current.set(tableName, { version, request });
      return request;
    },
    [connectionId, schema, setSchema, load, toast],
  );

  return { ensureSchema, startSchemaLoad, isLoadingFullSchema };
}
