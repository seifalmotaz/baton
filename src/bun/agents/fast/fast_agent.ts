import { streamText, stepCountIs } from "ai";
import type { ModelMessage } from "ai";
import { openai, OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";

import { FAST_AGENT_SYSTEM_PROMPT } from "./system_prompt";
import { fastAgentTools } from "./tools";
import type { FastAgentRequest, FastAgentChunk } from "./types";

export type { FastAgentRequest, FastAgentChunk };

// ─── Core Agent ────────────────────────────────────────────────────────────

/**
 * Run the Fast Agent, streaming chunks to the caller via callback.
 *
 * @param request   - The conversation history and workspace root.
 * @param onChunk   - Called for each streamed event (delta, reasoning, tool_call, done).
 */
export async function runFastAgent(
  request: FastAgentRequest,
  onChunk: (chunk: FastAgentChunk) => void,
): Promise<void> {
  const { messages, workspaceRoot } = request;

  // Inject workspace context into the system prompt
  const systemPrompt =
    FAST_AGENT_SYSTEM_PROMPT +
    `\n\n## Current Workspace\nRoot: ${workspaceRoot}\n`;

  // Cast our simplified message type to ModelMessage[] for the SDK
  const modelMessages = messages as ModelMessage[];

  const result = streamText({
    // Use the Responses API for reasoning support (gpt-4.1 / o-series)
    // Switch to openai.chat("model") to force Chat Completions without reasoning
    model: openai("gpt-5.2-2025-12-11"),
    system: systemPrompt,
    messages: modelMessages,
    tools: fastAgentTools,
    // AI SDK v6: maxSteps replaced by stopWhen
    stopWhen: stepCountIs(10),
    providerOptions: {
      openai: {
        reasoningEffort: "medium",
        // Stream reasoning/thinking tokens (no-op for non-reasoning models)
        reasoningSummary: "auto",
        forceReasoning: true,
      } as OpenAILanguageModelResponsesOptions,
    },
  });

  // Stream chunks via fullStream async iterator (AI SDK v6)
  for await (const chunk of result.fullStream) {
    if (chunk.type === "text-delta") {
      onChunk({ type: "delta", text: chunk.text });
    } else if (chunk.type === "reasoning-delta") {
      // Thinking tokens from reasoning-capable models (o-series, gpt-5)
      onChunk({ type: "reasoning", text: chunk.text });
    } else if (chunk.type === "tool-call") {
      onChunk({
        type: "tool_call",
        toolName: chunk.toolName,
        input: chunk.input,
      });
    }
  }

  // Emit done event with final stats
  const steps = await result.steps;
  const fullText = await result.text;
  const toolCallCount = steps.reduce(
    (acc, step) => acc + step.toolCalls.length,
    0,
  );

  onChunk({ type: "done", fullText, toolCallCount });
}

// ─── Smoke test ─────────────────────────────────────────────────────────────
// Run directly with: bun src/bun/agents/fast/fast_agent.ts
// Requires OPENAI_API_KEY to be set in the environment.

if (import.meta.main) {
  console.log("🚀 Fast Agent smoke test\n");

  await runFastAgent(
    {
      messages: [
        {
          role: "user",
          content: "What files are in the current working directory?",
        },
      ],
      workspaceRoot: process.cwd(),
    },
    (chunk) => {
      if (chunk.type === "reasoning")
        console.log(`\n[reasoning] ${chunk.text}`);
      else if (chunk.type === "delta") process.stdout.write(chunk.text);
      else if (chunk.type === "tool_call") {
        console.log(
          `\n[tool] ${chunk.toolName}(${JSON.stringify(chunk.input)})`,
        );
      } else if (chunk.type === "done") {
        console.log(`\n\n✅ Done. Tool calls: ${chunk.toolCallCount}`);
      }
    },
  );
}
