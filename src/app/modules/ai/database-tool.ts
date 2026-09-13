/**
 * database-tool.ts
 *
 * The concrete implementation behind Gemini's `query_database` function
 * call. This is the ONLY function that ever sits between Gemini's function
 * call and the database:
 *
 *   Gemini function call → queryDatabase() → validator → executor → Mongo
 *
 * It never throws for "bad AI input" — every failure mode becomes a
 * structured { error } result, because a thrown exception here would abort
 * the whole chat turn, whereas an { error } result lets Gemini gracefully
 * tell the admin "that information isn't available" instead of hallucinating.
 */

import { RawQueryDatabaseArgs, QueryDatabaseToolResult } from "./ai.interface";
import { validateQueryDatabaseArgs } from "./query-validator";
import { executeQuery } from "./query-executor";

export async function queryDatabase(
  args: RawQueryDatabaseArgs,
): Promise<QueryDatabaseToolResult> {
  const validation = validateQueryDatabaseArgs(args);

  if (!validation.ok || !validation.query) {
    return {
      collection: args.collection,
      operation: (args.operation as QueryDatabaseToolResult["operation"]) ?? "find",
      error: validation.error ?? "Query was rejected by the security validator.",
    };
  }

  const { query } = validation;

  try {
    const result = await executeQuery(query);
    return {
      collection: query.collection,
      operation: query.operation,
      data: result.data,
      count: result.count,
      truncated: result.truncated,
    };
  } catch (err) {
    // Never leak raw Mongo/driver errors (they can contain internal detail)
    // back to Gemini — return a generic, safe message instead.
    // eslint-disable-next-line no-console
    console.error("[ai] query_database execution error:", err);
    return {
      collection: query.collection,
      operation: query.operation,
      error: "The database query could not be executed.",
    };
  }
}
