import type { QueryHistoryItem } from "@/lib/types";
import { csvRow } from "./csv";

export function queryHistoryText(items: readonly QueryHistoryItem[], format: "csv" | "json"): string {
  if (format === "json") return JSON.stringify(items, null, 2);

  const headers = ["Executed At", "Status", "Connection", "Tab", "Execution Time (ms)", "Rows", "Query", "Error"];
  const rows = items.map((item) =>
    csvRow([
      item.executedAt,
      item.status,
      item.connectionName || item.connectionId,
      item.tabName || "",
      item.executionTime,
      item.rowCount || 0,
      item.query,
      item.errorMessage || "",
    ]),
  );
  return [csvRow(headers), ...rows].join("\n");
}
