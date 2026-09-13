/**
 * ai.tools.ts — Stage 21: the expanded `query_database` tool declaration
 * given to Gemini.
 *
 * `filter`, `projection`, and `pipeline` are declared as JSON-encoded
 * strings rather than free-form objects. The Gemini structured function
 * schema doesn't support arbitrary/unknown nested object shapes well, and
 * MongoDB filters/pipelines are inherently open-ended — so we let Gemini
 * write JSON text for these three fields, and query-validator.ts parses +
 * sanitizes them server-side before anything reaches the database.
 */

import { FunctionDeclaration, Type } from "@google/genai";
import { ALLOWED_COLLECTION_KEYS } from "./schema-metadata";
import { ALLOWED_OPERATIONS, MAX_RESULT_LIMIT } from "./query-validator";

export const queryDatabaseFunctionDeclaration: FunctionDeclaration = {
  name: "query_database",
  description:
    "Read-only query against the application's MongoDB database. Use this any time you need real business data (orders, revenue, products, stock, users, payments, etc.) to answer the admin's question. Never invent numbers — always call this tool to get real data first.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      collection: {
        type: Type.STRING,
        description: `The collection to query. Must be one of: ${ALLOWED_COLLECTION_KEYS.join(", ")}.`,
        enum: ALLOWED_COLLECTION_KEYS,
      },
      operation: {
        type: Type.STRING,
        description: `The read-only operation to perform. Must be one of: ${ALLOWED_OPERATIONS.join(", ")}.`,
        enum: ALLOWED_OPERATIONS,
      },
      filter: {
        type: Type.STRING,
        description:
          'A JSON-encoded MongoDB filter object for "find" or "count" operations, e.g. \'{"orderStatus":"DELIVERED"}\'. Omit or use "{}" for no filter. Dates must be ISO 8601 strings.',
      },
      projection: {
        type: Type.STRING,
        description:
          'Optional JSON-encoded MongoDB projection for "find", e.g. \'{"title":1,"price":1}\'. Sensitive fields (passwords, credentials) are stripped automatically regardless of what you request.',
      },
      pipeline: {
        type: Type.STRING,
        description:
          'A JSON-encoded MongoDB aggregation pipeline array, required when operation is "aggregate", e.g. \'[{"$match":{...}},{"$group":{...}}]\'. Never use $out, $merge, $function, $accumulator, or $where — these are blocked and the call will be rejected.',
      },
      limit: {
        type: Type.NUMBER,
        description: `Maximum documents to return for "find"/"aggregate". Defaults to 20, hard-capped at ${MAX_RESULT_LIMIT} regardless of what you request.`,
      },
    },
    required: ["collection", "operation"],
  },
};

export const aiTools = [
  {
    functionDeclarations: [queryDatabaseFunctionDeclaration],
  },
];
