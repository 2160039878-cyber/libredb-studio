import { useState, type ReactNode } from "react";
import type { TableSchema } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Whole-schema tools must not interpret unloaded columns as an empty schema. */
export function SchemaLoadGate({
  schema,
  onLoadSchema,
  onClose,
  className,
  children,
}: {
  schema: TableSchema[];
  onLoadSchema?: () => Promise<TableSchema[] | null>;
  onClose?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const [loading, setLoading] = useState(false);
  if (!schema.some((table) => table.detailsLoaded === false)) return children;
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 p-6 bg-background text-sm", className)}>
      <p>This view needs details for all {schema.length.toLocaleString()} tables.</p>
      <p className="text-muted-foreground">Loading the full schema can take time and memory for large databases.</p>
      <Button
        disabled={loading || !onLoadSchema}
        onClick={async () => {
          setLoading(true);
          try {
            await onLoadSchema?.();
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? "Loading full schema..." : "Load full schema"}
      </Button>
      {onClose && (
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      )}
    </div>
  );
}
