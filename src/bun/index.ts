import { BrowserWindow, BrowserView, Updater } from "electrobun/bun";
import type { BatonRPC } from "../shared/rpc";
import { runFastAgent } from "./agents/fast/fast_agent";
import type { FastAgentChunk } from "./agents/fast/types";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// Check if Vite dev server is running for HMR
async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    } catch {
      console.log(
        "Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
      );
    }
  }
  return "views://mainview/index.html";
}

const url = await getMainViewUrl();

// ─── RPC Definition ──────────────────────────────────────────────────────────
// We need a reference to the window before defining a handler that uses it.
// Use a late-binding closure over `win` so it's captured after assignment.
let sendChunkToView: ((chunk: FastAgentChunk) => void) | null = null;

const rpc = BrowserView.defineRPC<BatonRPC>({
  handlers: {
    requests: {
      chat: async (params) => {
        try {
          await runFastAgent(
            { messages: params.messages, workspaceRoot: params.workspaceRoot },
            (chunk) => sendChunkToView?.(chunk),
          );
          return { ok: true as const };
        } catch (err: unknown) {
          console.error("[FastAgent] error:", err);
          return { ok: false as const, error: String(err) };
        }
      },
    },
    messages: {},
  },
});

// ─── Window ──────────────────────────────────────────────────────────────────
const win = new BrowserWindow({
  title: "Baton",
  url,
  rpc,
  frame: {
    width: 1100,
    height: 750,
    x: 200,
    y: 200,
  },
});

// Wire the send callback AFTER the window is created so win.webview is ready
sendChunkToView = (chunk: FastAgentChunk) => {
  win.webview.rpc?.send.agentChunk(chunk);
};

console.log("Baton started!");
