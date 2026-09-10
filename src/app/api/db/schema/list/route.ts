import { NextRequest } from "next/server";
import { handleSchemaRequest } from "@/lib/api/schema-route";

export const dynamic = "force-dynamic";

/**
 * Fast schema list. Structural lists are enriched with /schema/relations;
 * name-only inventories (detailsLoaded:false) use /schema?table=... on demand.
 * Providers without a fast list fall back to the full getSchema().
 */
export async function POST(req: NextRequest) {
  return handleSchemaRequest(req, "api/db/schema/list", (provider) =>
    provider.getSchemaList ? provider.getSchemaList() : provider.getSchema(),
  );
}
