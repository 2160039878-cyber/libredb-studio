/**
 * The committed OLM bundle is the submission source for both community
 * operator catalogs, and its place in the update graph is the one part of it
 * that no bundle validator checks.
 *
 * k8s-operatorhub/community-operators runs this operator in
 * `updateGraph: replaces-mode`, and its deploy jobs build a catalog with
 * `opm index add --mode replaces` (the mode comes straight from `ci.yaml`).
 * That command reads `spec.replaces` and `spec.skips` ONLY. It does not look
 * at `olm.skipRange`, and without a pointer it prunes the previous bundle out
 * of the channel and fails:
 *
 *   add prunes bundle libredb-studio-operator.v0.9.59 ... channel alpha:
 *   this may be due to incorrect channel head (...v0.14.1, skips/replaces [])
 *
 * Measured against the real command with two bundle images and a local
 * registry: replaces-mode with a skipRange alone exits 1, replaces-mode with
 * `spec.replaces` exits 0. `check_dangling_bundles` in operatorcert is more
 * forgiving (it seeds its graph from `_resolve_skip_range`), which is exactly
 * why passing that check is not evidence that a submission will build.
 *
 * So both fields are stamped, and both are asserted here:
 *   - `spec.replaces` names the newest version the catalogs actually serve.
 *     It is NOT derivable from package.json, which is why it lives in
 *     `CATALOG_REPLACES` in operator/Makefile and has to be bumped when a
 *     submission merges upstream. Getting it wrong is loud, not silent: the
 *     same prune failure comes back on the next submission.
 *   - `olm.skipRange` lets a cluster jump straight to this version, and is
 *     what the FBC side accepts in `release-config.yaml`. An unparseable
 *     range is *ignored with a log warning* rather than rejected, so a typo
 *     would silently degrade to no range at all - hence the exact-string
 *     assertion below rather than a loose match.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../..");
const CSV = join(ROOT, "operator/bundle/manifests/libredb-studio-operator.clusterserviceversion.yaml");
const BASE_CSV = join(ROOT, "operator/config/manifests/bases/libredb-studio-operator.clusterserviceversion.yaml");

function packageVersion(): string {
  return JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
}

function annotation(file: string, name: string): string | undefined {
  const match = readFileSync(file, "utf8").match(new RegExp(`^\\s*${name}:\\s*(.+?)\\s*$`, "m"));
  return match?.[1]?.replace(/^['"]|['"]$/g, "");
}

/** A two-space-indented key, i.e. one directly under the CSV's `spec`. */
function csvField(name: string, file: string = CSV): string | undefined {
  return readFileSync(file, "utf8").match(new RegExp(`^  ${name}:\\s*(.+?)\\s*$`, "m"))?.[1];
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) {
      return pa[i] - pb[i];
    }
  }
  return 0;
}

describe("the generated bundle's place in the catalog update graph", () => {
  test("the CSV carries an olm.skipRange stamped from package.json", () => {
    expect(annotation(CSV, "olm\\.skipRange")).toBe(`>=0.0.0 <${packageVersion()}`);
  });

  test("the range excludes the bundle's own version, so the bundle cannot skip itself", () => {
    const range = annotation(CSV, "olm\\.skipRange");
    expect(range).toContain(`<${packageVersion()}`);
    expect(range).not.toContain(`<=${packageVersion()}`);
  });

  test("the base CSV holds the placeholder the Makefile stamps over", () => {
    // Mirrors containerImage: the stamp is a sed over a placeholder the base
    // owns, and sed exits 0 on zero matches - so a removed or reformatted
    // placeholder must be a visible failure here, not a silently unstamped CSV.
    expect(annotation(BASE_CSV, "olm\\.skipRange")).toBe(">=0.0.0 <0.0.0");
  });

  test("the CSV names the bundle it replaces", () => {
    expect(csvField("replaces")).toMatch(/^libredb-studio-operator\.v\d+\.\d+\.\d+$/);
  });

  test("the replaced version is older than this bundle, and is inside its skip range", () => {
    // A pointer at or above our own version is not a graph edge, it is a
    // cycle; and the two fields must agree, or a cluster is told one thing by
    // the range and another by the pointer.
    const replaced = csvField("replaces")?.replace("libredb-studio-operator.v", "") ?? "";
    expect(compareVersions(replaced, packageVersion())).toBeLessThan(0);
    expect(annotation(CSV, "olm\\.skipRange")).toBe(`>=0.0.0 <${packageVersion()}`);
  });

  test("the base CSV holds the replaces placeholder the Makefile stamps over", () => {
    expect(csvField("replaces", BASE_CSV)).toBe("libredb-studio-operator.v0.0.0");
  });
});
