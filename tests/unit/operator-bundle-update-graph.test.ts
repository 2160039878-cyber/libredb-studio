/**
 * The committed OLM bundle is the submission source for both community
 * operator catalogs, and its place in the update graph is the one part of it
 * that no bundle validator checks.
 *
 * k8s-operatorhub/community-operators runs this operator in
 * `updateGraph: replaces-mode`, whose static check (`check_dangling_bundles` in
 * operatorcert) fails any bundle that is neither a channel head nor reachable
 * from one. That check seeds its graph from `_resolve_skip_range`, so an
 * `olm.skipRange` annotation satisfies it exactly as `spec.replaces` would -
 * and unlike `replaces` it is derivable from package.json, so nothing has to
 * remember which version the catalogs last accepted.
 *
 * Two upstream behaviours make this worth asserting offline rather than
 * trusting the Makefile's sed:
 *   - an unparseable range is *ignored with a log warning*, not rejected, so a
 *     typo degrades to "no skipRange" and the dangling failure comes back;
 *   - the range must exclude the bundle's own version, or the bundle skips
 *     itself.
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

  test("no spec.replaces, which replaces-mode's skipRange path makes unnecessary", () => {
    // Keeping it absent is what lets the bundle be regenerated from
    // package.json alone; a replaces pointer would have to name the newest
    // version the catalogs actually serve, which lags our releases by however
    // many submissions are still unmerged.
    expect(readFileSync(CSV, "utf8")).not.toMatch(/^\s{2}replaces:/m);
  });
});
