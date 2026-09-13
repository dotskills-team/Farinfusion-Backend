/**
 * ai.interface.ts — shared types for the AI Database Assistant module.
 */

export type QueryOperation = "find" | "aggregate" | "count";

/** Raw args as they arrive from Gemini's function call (before validation). */
export interface RawQueryDatabaseArgs {
  collection: string;
  operation: string;
  /** JSON-encoded MongoDB filter object, e.g. '{"orderStatus":"DELIVERED"}'. */
  filter?: string;
  /** JSON-encoded projection object, e.g. '{"title":1,"price":1}'. */
  projection?: string;
  /** JSON-encoded aggregation pipeline array. Required when operation = "aggregate". */
  pipeline?: string;
  /** Max documents to return. Server always clamps this to MAX_RESULT_LIMIT. */
  limit?: number;
}

/** Args after JSON parsing + structural validation, before security checks. */
export interface ParsedQueryDatabaseArgs {
  collection: string;
  operation: QueryOperation;
  filter?: Record<string, unknown>;
  projection?: Record<string, 0 | 1>;
  pipeline?: Record<string, unknown>[];
  limit?: number;
}

export interface ValidationResult {
  ok: boolean;
  /** Present when ok = false. Sent back to Gemini so it can explain to the admin. */
  error?: string;
  /** Present when ok = true — the sanitized, safe-to-execute query. */
  query?: ParsedQueryDatabaseArgs;
}

export interface QueryDatabaseToolResult {
  collection: string;
  operation: QueryOperation;
  /** True when the query was rejected — Gemini must not invent data in this case. */
  error?: string;
  /** Result rows (find/aggregate) or a single count (count). Always capped. */
  data?: unknown;
  count?: number;
  truncated?: boolean;
}

export interface AiChatResponse {
  message: string;
  /** Raw structured data behind the final answer, if any tool call produced some. */
  data?: unknown;
  toolCalls?: {
    collection: string;
    operation: string;
  }[];
}
