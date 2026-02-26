import type { RPCSchema } from "electrobun/bun";
import type { FastAgentChunk } from "../bun/agents/fast/types";

export type BatonRPC = {
  bun: RPCSchema<{
    requests: {
      /**
       * Browser sends conversation history → Bun starts the Fast Agent.
       * Streaming chunks are pushed back via webview messages.
       */
      chat: {
        params: {
          messages: Array<{
            role: "user" | "assistant" | "system";
            content: string;
          }>;
          workspaceRoot: string;
        };
        response: { ok: boolean; error?: string };
      };
    };
    messages: {};
  }>;
  webview: RPCSchema<{
    requests: {};
    messages: {
      /** Each streaming chunk from the Fast Agent (delta, reasoning, tool_call, done) */
      agentChunk: FastAgentChunk;
    };
  }>;
};
