import { tool } from "ai";
import { z } from "zod";
import { readFile, writeFile, readdir } from "fs/promises";
import { join, resolve } from "path";
import { spawnSync } from "child_process";

// ─── readFile ──────────────────────────────────────────────────────────────

export const readFileTool = tool({
  description:
    "Read the full contents of a file at the given absolute path. Returns the file content as a string.",
  inputSchema: z.object({
    path: z.string().describe("Absolute path to the file to read."),
  }),
  execute: async ({ path }: { path: string }) => {
    try {
      const content = await readFile(resolve(path), "utf-8");
      return { success: true, content };
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  },
});

// ─── writeFile ─────────────────────────────────────────────────────────────

export const writeFileTool = tool({
  description:
    "Write (or overwrite) a file at the given absolute path with the provided content.",
  inputSchema: z.object({
    path: z.string().describe("Absolute path to the file to write."),
    content: z.string().describe("The content to write into the file."),
  }),
  execute: async ({ path, content }: { path: string; content: string }) => {
    try {
      await writeFile(resolve(path), content, "utf-8");
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  },
});

// ─── listDir ───────────────────────────────────────────────────────────────

export const listDirTool = tool({
  description:
    "List the files and subdirectories at the given path. Returns names and types (file | directory).",
  inputSchema: z.object({
    path: z.string().describe("Absolute path to the directory to list."),
  }),
  execute: async ({ path }: { path: string }) => {
    try {
      const entries = await readdir(resolve(path), { withFileTypes: true });
      const items = entries.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? "directory" : "file",
        fullPath: join(resolve(path), e.name),
      }));
      return { success: true, items };
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  },
});

// ─── runBunCommand ─────────────────────────────────────────────────────────

export const runBunCommandTool = tool({
  description:
    "Run a shell command in the given working directory. Returns stdout, stderr, and exit code.",
  inputSchema: z.object({
    command: z
      .string()
      .describe("The shell command to run, e.g. 'bun run build'."),
    cwd: z
      .string()
      .describe(
        "Absolute path of the working directory to run the command in.",
      ),
  }),
  execute: async ({ command, cwd }: { command: string; cwd: string }) => {
    try {
      const result = spawnSync(command, {
        cwd: resolve(cwd),
        shell: true,
        encoding: "utf-8",
        timeout: 30_000,
      });
      return {
        success: result.status === 0,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        exitCode: result.status ?? -1,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: String(err),
        stdout: "",
        stderr: "",
        exitCode: -1,
      };
    }
  },
});

// ─── Exports ───────────────────────────────────────────────────────────────

export const fastAgentTools = {
  readFile: readFileTool,
  writeFile: writeFileTool,
  listDir: listDirTool,
  runBunCommand: runBunCommandTool,
};
