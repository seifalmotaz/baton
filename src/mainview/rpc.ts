import { Electroview } from "electrobun/view";
import type { BatonRPC } from "../shared/rpc";
import type { FastAgentChunk } from "../bun/agents/fast/types";

// ─── Chunk handler registry ─────────────────────────────────────────────────
// Components subscribe by registering a callback; the RPC handler dispatches to it.
type ChunkHandler = (chunk: FastAgentChunk) => void;
let _chunkHandler: ChunkHandler | null = null;

export function setAgentChunkHandler(fn: ChunkHandler) {
  _chunkHandler = fn;
}

// ─── Electroview RPC bootstrap ──────────────────────────────────────────────
const rpcDef = Electroview.defineRPC<BatonRPC>({
  handlers: {
    requests: {},
    messages: {
      agentChunk: (chunk) => {
        _chunkHandler?.(chunk);
      },
    },
  },
});

export const electroview = new Electroview({ rpc: rpcDef });
