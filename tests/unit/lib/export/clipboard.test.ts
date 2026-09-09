import { describe, expect, test } from "bun:test";
import { parse as parseYaml } from "yaml";
import { clipboardCellText, resultClipboardText } from "@/lib/export/clipboard";

describe("result clipboard serialization", () => {
  test("copies full strings and scalar values without display formatting", () => {
    const text = '  雪,"value"\n' + "long value ".repeat(60);
    expect(clipboardCellText(text)).toBe(text);
    expect(clipboardCellText(null)).toBe("NULL");
    expect(clipboardCellText(undefined)).toBe("NULL");
    expect(clipboardCellText(false)).toBe("false");
    expect(clipboardCellText(12345.67)).toBe("12345.67");
    expect(clipboardCellText(BigInt("9007199254740993"))).toBe("9007199254740993");
  });

  test("copies complete binary values and ISO dates", () => {
    expect(clipboardCellText(new Uint8Array(64).fill(255))).toBe("\\x" + "ff".repeat(64));
    expect(clipboardCellText({ type: "Buffer", data: [0, 255] })).toBe("\\x00ff");
    expect(clipboardCellText(new Date("2026-09-09T00:00:00Z"))).toBe("2026-09-09T00:00:00.000Z");
  });

  test("retains structured cells with bigint and cycles", () => {
    const cell: Record<string, unknown> = { ids: [BigInt(42)], empty: null };
    cell.self = cell;
    expect(clipboardCellText(cell)).toBe('{"ids":["42"],"empty":null,"self":"[Circular]"}');
  });

  test.each(["json", "yaml"] as const)("copies %s with the shared safe JSON representation", (format) => {
    const cell: Record<string, unknown> = { big: BigInt("9007199254740993") };
    cell.self = cell;
    const row = { cell, at: new Date("2026-09-09T00:00:00Z"), empty: null, text: "true" };
    const text = resultClipboardText(format, [row], Object.keys(row));
    const parsed = format === "json" ? JSON.parse(text) : parseYaml(text);
    expect(parsed).toEqual([
      {
        cell: { big: "9007199254740993", self: "[Circular]" },
        at: "2026-09-09T00:00:00.000Z",
        empty: null,
        text: "true",
      },
    ]);
    expect(cell.self).toBe(cell);
  });

  test("CSV preserves declared column order, RFC quoting and formula neutralization", () => {
    expect(
      resultClipboardText(
        "csv",
        [
          { name: '雪,"hi"\nnext', id: 1 },
          { id: 2, name: "=1+1" },
        ],
        ["id", "name"],
      ),
    ).toBe('id,name\n1,"雪,""hi""\nnext"\n2,"\'=1+1"');
  });

  test("empty results serialize without inventing a row", () => {
    expect(resultClipboardText("json", [], ["id"])).toBe("[]");
    expect(parseYaml(resultClipboardText("yaml", [], ["id"]))).toEqual([]);
    expect(resultClipboardText("csv", [], ["id"])).toBe("id");
  });
});
