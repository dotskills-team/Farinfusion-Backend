/**
 * ai.service.ts — Stage 9/10: AI Service (Gemini conversation + function-calling loop)
 *
 * Generalizes the proven test-ai.ts flow (Stage 2) into a reusable service:
 *
 *   admin message -> Gemini -> [query_database function call(s)] -> database-tool
 *                 -> tool result -> Gemini -> ... (looped until no more calls)
 *                 -> final natural-language answer
 *
 * Provider-agnostic note (Stage 35): only this file + ai.tools.ts know about
 * @google/genai. Swapping providers later means rewriting this file, not the
 * validator/executor/security layers.
 */

import {
  Content,
  FunctionCallingConfigMode,
  GoogleGenAI,
  Part,
} from "@google/genai";
import httpStatus from "http-status-codes";
import AppError from "../../errorHelpers/appError";
import { aiTools } from "./ai.tools";
import { buildSystemInstruction } from "./ai.prompt";
import { queryDatabase } from "./database-tool";
import { AiChatResponse } from "./ai.interface";

const AI_MODEL = process.env.AI_MODEL || "gemini-3.6-flash";

/** Hard cap on how many function-calling round trips a single question may take. */
const MAX_TOOL_ITERATIONS = 6;

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!process.env.AI_API_KEY) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "AI_API_KEY is not configured on the server.",
    );
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.AI_API_KEY });
  }
  return client;
}

export interface ChatTurn {
  role: "user" | "model";
  text: string;
}

/**
 * Runs one admin question through the full function-calling loop and
 * returns the final natural-language answer.
 *
 * `history` lets the caller pass prior turns for a continuing conversation;
 * it's optional -- the target API (Stage 33) can start with just `message`.
 */
async function chat(
  message: string,
  history: ChatTurn[] = [],
): Promise<AiChatResponse> {
  const ai = getClient();

  const contents: Content[] = [
    ...history.map(
      (turn): Content => ({
        role: turn.role,
        parts: [{ text: turn.text }],
      }),
    ),
    {
      role: "user",
      parts: [{ text: message }],
    },
  ];

  const toolCalls: { collection: string; operation: string }[] = [];
  let lastToolData: unknown = undefined;

  const config = {
    systemInstruction: buildSystemInstruction(),
    tools: aiTools,
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingConfigMode.AUTO,
      },
    },
  };

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents,
      config,
    });

    const functionCalls = response.functionCalls ?? [];

    if (functionCalls.length === 0) {
      return {
        message: response.text ?? "",
        data: lastToolData,
        toolCalls,
      };
    }

    // Record the model's function-call turn in the conversation.
    contents.push({
      role: "model",
      parts: response.candidates?.[0]?.content?.parts ?? [],
    });

    // Execute every requested tool call and feed results back.
    const responseParts: Part[] = [];

    for (const call of functionCalls) {
      if (call.name !== "query_database") continue;

      const args = (call.args ?? {}) as {
        collection: string;
        operation: string;
        filter?: string;
        projection?: string;
        pipeline?: string;
        limit?: number;
      };

      toolCalls.push({ collection: args.collection, operation: args.operation });

      const result = await queryDatabase(args);
      if (!result.error) lastToolData = result.data ?? result.count;

      responseParts.push({
        functionResponse: {
          name: call.name,
          id: call.id,
          response: result as unknown as Record<string, unknown>,
        },
      });
    }

    if (responseParts.length === 0) {
      // Gemini requested a function we don't recognize -- stop the loop
      // gracefully rather than looping forever.
      return {
        message:
          response.text ??
          "I couldn't complete that request with the tools available to me.",
        data: lastToolData,
        toolCalls,
      };
    }

    contents.push({
      role: "user",
      parts: responseParts,
    });
  }

  return {
    message:
      "I wasn't able to finish answering that within the allowed number of database lookups. Could you narrow down the question?",
    data: lastToolData,
    toolCalls,
  };
}

export const AiService = {
  chat,
};
