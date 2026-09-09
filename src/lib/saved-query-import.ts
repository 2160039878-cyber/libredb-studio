import { z } from "zod";
import { SHIPPED_DATABASE_TYPES } from "@/lib/db/compatibility";
import type { SavedQuery } from "@/lib/types";

const savedQuerySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  query: z.string(),
  description: z.string().optional(),
  connectionType: z.enum(SHIPPED_DATABASE_TYPES),
  createdAt: z.string().pipe(z.coerce.date()),
  updatedAt: z.string().pipe(z.coerce.date()),
  tags: z.array(z.string()).optional(),
});

/** Validate the complete backup before any query is persisted. */
export function parseSavedQueries(text: string): SavedQuery[] {
  return z.array(savedQuerySchema).parse(JSON.parse(text));
}
