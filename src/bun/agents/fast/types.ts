// Compatible with the messages array accepted by Vercel AI SDK v6's streamText
export type AgentMessageRole = "user" | "assistant" | "system";

export interface FastAgentRequest {
  messages: Array<{ role: AgentMessageRole; content: string }>;
  workspaceRoot: string;
}

export interface FastAgentChunkDelta {
  type: "delta";
  text: string;
}

/** Streaming thinking/reasoning token from o-series or gpt-5 reasoning models */
export interface FastAgentChunkReasoning {
  type: "reasoning";
  text: string;
}

export interface FastAgentChunkToolCall {
  type: "tool_call";
  toolName: string;
  input: unknown;
}

export interface FastAgentChunkDone {
  type: "done";
  fullText: string;
  toolCallCount: number;
}

export type FastAgentChunk =
  | FastAgentChunkDelta
  | FastAgentChunkReasoning
  | FastAgentChunkToolCall
  | FastAgentChunkDone;
