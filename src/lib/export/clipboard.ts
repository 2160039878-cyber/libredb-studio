import { stringify as stringifyYaml } from "yaml";
import { asBytes, binaryText } from "./binary";
import { jsonText } from "./json";
import { toCsv } from "./csv";

export type ClipboardFormat = "json" | "yaml" | "csv";

/** The full value, without the grid's truncation or display-only formatting. */
export function clipboardCellText(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Date) return value.toISOString();
  const bytes = asBytes(value);
  if (bytes !== undefined) return binaryText(bytes);
  return typeof value === "object" ? jsonText(value) : String(value);
}

export function resultClipboardText(
  format: ClipboardFormat,
  rows: Record<string, unknown>[],
  fields: string[],
): string {
  if (format === "csv") return toCsv(rows, fields);
  const json = jsonText(rows, 2);
  // Use the same bigint/cycle/Date representation for JSON and YAML.
  return format === "yaml" ? stringifyYaml(JSON.parse(json)) : json;
}
