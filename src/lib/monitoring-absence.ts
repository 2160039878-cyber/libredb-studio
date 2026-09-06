/**
 * The one place that tells two kinds of monitoring-panel absence apart.
 *
 * `getMonitoringData` reads each panel independently and, when one rejects, leaves that
 * panel absent and records the ENGINE's own sentence under `MonitoringData.errors`
 * (see the contract on `MonitoringData` in `src/lib/db/types.ts`). Both of the absences
 * below arrive through that same channel, but they are different facts and a reader
 * acts on them differently:
 *
 * - The object was never there. Materialize has no `pg_table_size()` and no
 *   `pg_stat_user_tables`; CockroachDB has no `pg_size_pretty()`. Nothing the user can
 *   do makes this panel answer, and nothing is wrong - it is a property of the engine.
 * - The object is there and this statement was refused. Apache Cloudberry answers
 *   `query plan with multiple segworker groups is not supported` for the very queries
 *   whose catalogs it holds and can read; its MPP planner is rejecting the query's
 *   shape, so a different statement could still succeed. That is worth a reader's
 *   attention in a way the first is not.
 *
 * Reading the first as the second made Materialize's dashboard look broken across three
 * panels while every one of them was behaving correctly. Reading the second as the first
 * would be worse: it would present a real, fixable restriction as a settled fact.
 *
 * This is deliberately NOT solved by having providers answer `[]` instead of rejecting.
 * An empty array claims the engine answered "nothing", which is a measurement it never
 * made, and it throws away the sentence that says why - the exact confusion the
 * `MonitoringData` contract exists to prevent.
 */

/**
 * Phrases an engine uses when the thing asked for is not there. Kept as a list rather
 * than one regex because each comes from a different engine's wording, measured on a
 * live instance: PostgreSQL and Materialize say "does not exist", Materialize also says
 * "unknown catalog item", CockroachDB says "unknown function".
 */
const ABSENT_OBJECT_PHRASES = ["does not exist", "unknown catalog item", "unknown function"] as const;

/**
 * True when the message says a `pg_`-prefixed object the query asked for is not there.
 *
 * Both halves are load-bearing. Without the phrase, any message mentioning a catalog
 * would qualify. Without the `pg_` name, Cloudberry's planner restriction would qualify
 * on a future wording that happens to contain "does not exist", and its panel would stop
 * telling the user that a different query might work.
 */
export function describesAbsentObject(message: string): boolean {
  const normalized = message.toLowerCase();
  return ABSENT_OBJECT_PHRASES.some((phrase) => normalized.includes(phrase)) && /\bpg_\w+/.test(normalized);
}
