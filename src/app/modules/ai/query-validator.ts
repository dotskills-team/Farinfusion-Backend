/**
 * query-validator.ts — Stage 7: Security / Query Validator
 *
 * This is the most important file in the AI integration.
 *
 * Gemini-generated queries NEVER touch MongoDB directly. Every query passes
 * through here first. Nothing here trusts the AI prompt/system instructions —
 * those are a *second, weaker* layer (see ai.prompt.ts). This validator is
 * the real security boundary.
 *
 * Responsibilities:
 *  - Only allow known collections (schemaMetadata allowlist).
 *  - Only allow read-only operations (find / aggregate / count).
 *  - Strip / reject blocked fields (passwords, tokens, credentials, etc).
 *  - Reject write-shaped or destructive operators anywhere in filter/pipeline.
 *  - Enforce a hard server-side result limit, regardless of what the AI asked for.
 *  - Enforce a hard cap on aggregation pipeline complexity.
 */

import {
  ParsedQueryDatabaseArgs,
  QueryOperation,
  RawQueryDatabaseArgs,
  ValidationResult,
} from "./ai.interface";
import { schemaMetadata, ALLOWED_COLLECTION_KEYS } from "./schema-metadata";

export const ALLOWED_OPERATIONS: QueryOperation[] = ["find", "aggregate", "count"];

/** Hard server-side ceiling. The AI's requested `limit` is always clamped to this. */
export const MAX_RESULT_LIMIT = 100;
export const DEFAULT_RESULT_LIMIT = 20;

/** Hard ceiling on aggregation pipeline length, to bound query cost. */
export const MAX_PIPELINE_STAGES = 12;

/** Mongo execution budget per query. */
export const QUERY_TIMEOUT_MS = 8000;

/**
 * Aggregation stage names that can mutate data, touch the filesystem/network,
 * or run arbitrary JS. Blocked outright — this integration is read-only.
 */
const BLOCKED_STAGE_KEYS = new Set([
  "$out",
  "$merge",
  "$function",
  "$accumulator",
  "$where",
  "$currentOp",
  "$indexStats",
  "$collStats",
  "$planCacheStats",
  "$graphLookup", // allowed conceptually, but disabled for now to bound query cost
]);

/**
 * Operator keys that are never allowed anywhere inside a filter/pipeline
 * object, even nested — these are the classic "escape hatches" for
 * arbitrary JS execution or server introspection.
 */
const BLOCKED_OPERATOR_KEYS = new Set([
  "$where",
  "$function",
  "$accumulator",
  "$expr", // allowed by many apps, but disabled here: easy to smuggle $function inside
]);

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

/**
 * Recursively walks a filter/projection/pipeline-stage object and throws if
 * it contains any blocked operator key, at any depth, including inside
 * arrays.
 */
function assertNoBlockedOperators(node: unknown, path = "$"): void {
  if (Array.isArray(node)) {
    node.forEach((item, i) => assertNoBlockedOperators(item, `${path}[${i}]`));
    return;
  }

  if (!isPlainObject(node)) return;

  for (const key of Object.keys(node)) {
    if (BLOCKED_OPERATOR_KEYS.has(key)) {
      throw new Error(
        `Operator "${key}" is not allowed (blocked at ${path}.${key}).`,
      );
    }
    if (key.startsWith("$") && BLOCKED_STAGE_KEYS.has(key)) {
      throw new Error(
        `Stage/operator "${key}" is not allowed (blocked at ${path}.${key}).`,
      );
    }
    assertNoBlockedOperators(node[key], `${path}.${key}`);
  }
}

/** Strips any top-level or dotted-path reference to a blocked field. */
function stripBlockedFields(
  obj: Record<string, unknown> | undefined,
  blockedFields: string[],
): Record<string, unknown> | undefined {
  if (!obj) return obj;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const rootField = key.split(".")[0];
    if (blockedFields.includes(rootField)) continue;
    clean[key] = value;
  }
  return clean;
}

function safeJsonParse<T>(raw: string | undefined, label: string): T | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`"${label}" was not valid JSON.`);
  }
}

/**
 * Validates & sanitizes a raw tool call from Gemini. Never throws for
 * "the AI asked for something disallowed" — those become a normal
 * { ok: false, error } result so Gemini can explain the limitation to the
 * admin instead of crashing the request.
 */
export function validateQueryDatabaseArgs(
  raw: RawQueryDatabaseArgs,
): ValidationResult {
  try {
    // --- collection allowlist -------------------------------------------------
    const collection = raw.collection;
    if (!ALLOWED_COLLECTION_KEYS.includes(collection)) {
      return {
        ok: false,
        error: `Collection "${collection}" is not queryable. Allowed collections: ${ALLOWED_COLLECTION_KEYS.join(", ")}.`,
      };
    }
    const meta = schemaMetadata[collection];

    // --- operation allowlist ---------------------------------------------------
    const operation = raw.operation as QueryOperation;
    if (!ALLOWED_OPERATIONS.includes(operation)) {
      return {
        ok: false,
        error: `Operation "${raw.operation}" is not allowed. Allowed operations: ${ALLOWED_OPERATIONS.join(", ")} (read-only).`,
      };
    }

    // --- parse JSON-encoded pieces ----------------------------------------------
    let filter = safeJsonParse<Record<string, unknown>>(raw.filter, "filter");
    let projection = safeJsonParse<Record<string, 0 | 1>>(
      raw.projection,
      "projection",
    );
    let pipeline = safeJsonParse<Record<string, unknown>[]>(
      raw.pipeline,
      "pipeline",
    );

    if (filter !== undefined && !isPlainObject(filter)) {
      return { ok: false, error: "filter must be a JSON object." };
    }
    if (projection !== undefined && !isPlainObject(projection)) {
      return { ok: false, error: "projection must be a JSON object." };
    }
    if (pipeline !== undefined && !Array.isArray(pipeline)) {
      return { ok: false, error: "pipeline must be a JSON array of stages." };
    }

    if (operation === "aggregate" && (!pipeline || pipeline.length === 0)) {
      return {
        ok: false,
        error: "aggregate operation requires a non-empty pipeline.",
      };
    }
    if (pipeline && pipeline.length > MAX_PIPELINE_STAGES) {
      return {
        ok: false,
        error: `pipeline has too many stages (max ${MAX_PIPELINE_STAGES}).`,
      };
    }

    // --- block dangerous operators anywhere in filter/pipeline -------------------
    assertNoBlockedOperators(filter, "filter");
    assertNoBlockedOperators(pipeline, "pipeline");

    // --- reject write-shaped pipeline stages by name (defense in depth) ----------
    if (pipeline) {
      for (const stage of pipeline) {
        const stageKeys = Object.keys(stage);
        for (const key of stageKeys) {
          if (BLOCKED_STAGE_KEYS.has(key)) {
            return {
              ok: false,
              error: `Pipeline stage "${key}" is not allowed (read-only access).`,
            };
          }
        }
      }
    }

    // --- strip sensitive fields from filter/projection ----------------------------
    filter = stripBlockedFields(filter, meta.blockedFields);
    projection = stripBlockedFields(projection, meta.blockedFields) as
      | Record<string, 0 | 1>
      | undefined;

    // If projection explicitly asked for a blocked field via `field: 1`, that's
    // already removed above. If caller used exclusion-style projection, also
    // force-exclude blocked fields regardless.
    if (meta.blockedFields.length > 0) {
      projection = { ...(projection ?? {}) };
      for (const blocked of meta.blockedFields) {
        // Only add exclusions if the projection isn't purely inclusion-style,
        // to avoid Mongo's "cannot mix inclusion and exclusion" error.
        const values = Object.values(projection);
        const isInclusionStyle = values.some((v) => v === 1);
        if (!isInclusionStyle) {
          projection[blocked] = 0;
        }
      }
      if (Object.keys(projection).length === 0) projection = undefined;
    }

    // --- clamp limit ---------------------------------------------------------------
    let limit = typeof raw.limit === "number" ? Math.floor(raw.limit) : DEFAULT_RESULT_LIMIT;
    if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_RESULT_LIMIT;
    limit = Math.min(limit, MAX_RESULT_LIMIT);

    // Also force a $limit stage onto aggregate pipelines that don't already
    // have one, so a runaway $group/$unwind can't return unbounded rows.
    if (pipeline && operation === "aggregate") {
      const hasLimitStage = pipeline.some((s) => "$limit" in s);
      const hasCountOrGroupOnly =
        pipeline.some((s) => "$count" in s) ||
        (pipeline.length > 0 &&
          "$group" in pipeline[pipeline.length - 1] &&
          (pipeline[pipeline.length - 1] as Record<string, unknown>)["$group"] &&
          isPlainObject(
            (pipeline[pipeline.length - 1] as Record<string, unknown>)["$group"],
          ) &&
          (
            (pipeline[pipeline.length - 1] as Record<string, unknown>)[
              "$group"
            ] as Record<string, unknown>
          )["_id"] === null);

      if (!hasLimitStage && !hasCountOrGroupOnly) {
        pipeline = [...pipeline, { $limit: limit }];
      }
    }

    const query: ParsedQueryDatabaseArgs = {
      collection,
      operation,
      filter,
      projection,
      pipeline,
      limit,
    };

    return { ok: true, query };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Query validation failed.",
    };
  }
}
