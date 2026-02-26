<script lang="ts">
  import { onMount } from "svelte";
  import { Streamdown } from "svelte-streamdown";

  import { electroview, setAgentChunkHandler } from "./rpc";

  // ─── Types ─────────────────────────────────────────────────────────────────

  type Message = {
    id: string;
    role: "user" | "assistant";
    content: string;
    reasoning?: string;
    toolCalls?: string[];
    isStreaming?: boolean;
  };

  // ─── State ─────────────────────────────────────────────────────────────────

  let messages = $state<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hello! I'm Baton's Fast Agent. Ask me anything about your codebase.",
    },
  ]);

  let input = $state("");
  let isTyping = $state(false);
  let chatContentRef: HTMLElement | undefined = $state();

  // ─── Scroll ─────────────────────────────────────────────────────────────────

  function scrollToBottom() {
    if (chatContentRef) {
      setTimeout(() => {
        chatContentRef!.scrollTop = chatContentRef!.scrollHeight;
      }, 10);
    }
  }

  // ─── RPC setup ──────────────────────────────────────────────────────────────

  onMount(() => {
    setAgentChunkHandler((chunk) => {
      // Find the last assistant message (currently streaming)
      const last = messages.findLast(
        (m) => m.role === "assistant" && m.isStreaming,
      );
      if (!last) return;

      if (chunk.type === "delta") {
        last.content += chunk.text;
        scrollToBottom();
      } else if (chunk.type === "reasoning") {
        last.reasoning = (last.reasoning ?? "") + chunk.text;
      } else if (chunk.type === "tool_call") {
        last.toolCalls = [...(last.toolCalls ?? []), chunk.toolName];
      } else if (chunk.type === "done") {
        last.isStreaming = false;
        isTyping = false;
        scrollToBottom();
      }
    });
  });

  // ─── Send ───────────────────────────────────────────────────────────────────

  async function handleSend() {
    if (!input.trim() || isTyping) return;

    const userContent = input.trim();
    input = "";
    setTimeout(() => {
      const textarea = document.querySelector("textarea");
      if (textarea) textarea.style.height = "auto";
    }, 0);

    messages.push({
      id: crypto.randomUUID(),
      role: "user",
      content: userContent,
    });

    const assistantId = crypto.randomUUID();
    messages.push({
      id: assistantId,
      role: "assistant",
      content: "",
      reasoning: undefined,
      toolCalls: [],
      isStreaming: true,
    });

    isTyping = true;
    scrollToBottom();

    // Build conversation history for the agent (exclude streaming placeholder)
    const history = messages
      .filter((m) => !m.isStreaming && m.content.trim())
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    const result = await electroview.rpc!.request.chat({
      messages: history,
      workspaceRoot: "C:/Users/Seif Almotaz/Desktop/Bato bun",
    });

    if (!result.ok) {
      const last = messages.findLast((m) => m.id === assistantId);
      if (last) {
        last.content = `⚠️ Error: ${result.error ?? "Unknown error"}`;
        last.isStreaming = false;
      }
      isTyping = false;
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function autoResize(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    target.style.height = "auto";
    target.style.height = target.scrollHeight + "px";
  }

  // ─── Reasoning toggle ────────────────────────────────────────────────────────
  let expandedReasoning = $state<Set<string>>(new Set());
  function toggleReasoning(id: string) {
    const next = new Set(expandedReasoning);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expandedReasoning = next;
  }
</script>

<main class="app-container">
  <!-- Sidebar -->
  <aside class="sidebar">
    <button
      class="new-chat-btn"
      onclick={() => {
        messages = [
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "New conversation started. How can I help?",
          },
        ];
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        ><line x1="12" y1="5" x2="12" y2="19"></line><line
          x1="5"
          y1="12"
          x2="19"
          y2="12"
        ></line></svg
      >
      New Chat
    </button>
    <div class="history-list">
      <div class="history-item active">Current Conversation</div>
    </div>
    <div class="sidebar-footer">
      <div class="user-profile">
        <div class="avatar">B</div>
        <span>Baton Workspace</span>
      </div>
    </div>
  </aside>

  <!-- Main Chat -->
  <section class="main-chat">
    <header class="chat-header">
      <div class="model-selector">
        <span class="model-dot"></span>
        <span>Fast Agent · gpt-5.2</span>
      </div>
    </header>

    <div class="chat-content" bind:this={chatContentRef}>
      <div class="messages-container">
        {#each messages ?? [] as message (message.id)}
          <div class="message-wrapper {message.role}">
            <div class="message-container">
              {#if message.role === "assistant"}
                <div class="avatar-icon ai-avatar">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
                    ></polygon></svg
                  >
                </div>
              {/if}
              <div class="message-bubble">
                <!-- Reasoning block -->
                {#if message.reasoning}
                  <div class="reasoning-block">
                    <button
                      class="reasoning-toggle"
                      onclick={() => toggleReasoning(message.id)}
                      aria-expanded={expandedReasoning.has(message.id)}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class:rotated={expandedReasoning.has(message.id)}
                        ><polyline points="6 9 12 15 18 9"></polyline></svg
                      >
                      {expandedReasoning.has(message.id)
                        ? "Hide thinking"
                        : "Show thinking"}
                    </button>
                    {#if expandedReasoning.has(message.id)}
                      <div class="reasoning-text">{message.reasoning}</div>
                    {/if}
                  </div>
                {/if}

                <!-- Tool calls -->
                {#if message.toolCalls && message.toolCalls.length > 0}
                  <div class="tool-calls">
                    {#each message.toolCalls ?? [] as tool}
                      <span class="tool-badge">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          ><path
                            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                          ></path><polyline points="14 2 14 8 20 8"
                          ></polyline></svg
                        >
                        {tool}
                      </span>
                    {/each}
                  </div>
                {/if}

                <!-- Main text content -->
                {#if message.content || message.isStreaming}
                  <div class="message-text">
                    <!-- {message.content} -->
                    <Streamdown content={message.content} />
                    {#if message.isStreaming && !message.content}<span
                        class="cursor-blink">▋</span
                      >{/if}
                  </div>
                {/if}

                <!-- Streaming cursor (after content) -->
                {#if message.isStreaming && message.content}
                  <span class="cursor-blink">▋</span>
                {/if}
              </div>
            </div>
          </div>
        {/each}

        {#if isTyping && !messages.some((m) => m.isStreaming && m.content === "" && !m.reasoning)}
          <div class="message-wrapper assistant">
            <div class="message-container">
              <div class="avatar-icon ai-avatar">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
                  ></polygon></svg
                >
              </div>
              <div class="message-bubble typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <div class="input-area">
      <div class="input-container">
        <textarea
          bind:value={input}
          onkeydown={handleKeyDown}
          oninput={autoResize}
          placeholder="Message Fast Agent..."
          rows="1"
          aria-label="Message input"
        ></textarea>
        <button
          class="send-btn"
          onclick={handleSend}
          disabled={!input.trim() || isTyping}
          aria-label="Send message"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><line x1="22" y1="2" x2="11" y2="13"></line><polygon
              points="22 2 15 22 11 13 2 9 22 2"
            ></polygon></svg
          >
        </button>
      </div>
      <div class="footer-text">
        Baton Fast Agent can make mistakes. Verify important code.
      </div>
    </div>
  </section>
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family:
      "Inter",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      Helvetica,
      Arial,
      sans-serif;
    background-color: #212121;
    color: #ececec;
  }

  .app-container {
    display: flex;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    background-color: #212121;
  }

  /* Sidebar */
  .sidebar {
    width: 240px;
    background-color: #171717;
    display: flex;
    flex-direction: column;
    padding: 1rem;
    border-right: 1px solid #2a2a2a;
  }

  .new-chat-btn {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.65rem 1rem;
    background-color: transparent;
    border: 1px solid #383838;
    border-radius: 0.5rem;
    color: #ececec;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background-color 0.15s;
    margin-bottom: 0.5rem;
  }
  .new-chat-btn:hover {
    background-color: #262626;
  }

  .history-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    margin-top: 0.75rem;
  }

  .history-item {
    padding: 0.65rem 0.75rem;
    border-radius: 0.5rem;
    font-size: 0.8rem;
    color: #737373;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: all 0.15s;
  }
  .history-item:hover {
    background-color: #262626;
    color: #ececec;
  }
  .history-item.active {
    background-color: #262626;
    color: #ececec;
  }

  .sidebar-footer {
    margin-top: auto;
    padding-top: 0.75rem;
    border-top: 1px solid #2a2a2a;
  }
  .user-profile {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background-color 0.15s;
    font-size: 0.85rem;
    color: #a3a3a3;
  }
  .user-profile:hover {
    background-color: #262626;
  }
  .avatar {
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 50%;
    background: linear-gradient(135deg, #10b981, #059669);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.75rem;
    color: white;
  }

  /* Main chat */
  .main-chat {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: #212121;
  }

  .chat-header {
    height: 3.25rem;
    display: flex;
    align-items: center;
    padding: 0 1.5rem;
    border-bottom: 1px solid #2a2a2a;
  }

  .model-selector {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.75rem;
    border-radius: 0.5rem;
    font-size: 0.85rem;
    font-weight: 500;
    color: #a3a3a3;
    cursor: pointer;
    transition:
      background-color 0.15s,
      color 0.15s;
  }
  .model-selector:hover {
    background-color: #2a2a2a;
    color: #ececec;
  }

  .model-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 6px #10b981;
    animation: pulse-dot 2s infinite;
  }
  @keyframes pulse-dot {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }

  .chat-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem 1rem;
    display: flex;
    flex-direction: column;
    scroll-behavior: smooth;
  }

  .messages-container {
    max-width: 48rem;
    width: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding-bottom: 1rem;
  }

  .message-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
  }
  .message-wrapper.user {
    align-items: flex-end;
  }
  .message-wrapper.assistant {
    align-items: flex-start;
  }

  .message-container {
    display: flex;
    gap: 0.875rem;
    max-width: 88%;
  }

  .avatar-icon {
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 0.35rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 0.15rem;
  }
  .ai-avatar {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
  }

  .message-bubble {
    font-size: 0.975rem;
    line-height: 1.65;
    flex: 1;
  }

  .message-wrapper.user .message-bubble {
    background-color: #2f2f2f;
    color: #ececec;
    border-radius: 1rem;
    border-bottom-right-radius: 0.25rem;
    padding: 0.65rem 1rem;
  }
  .message-wrapper.assistant .message-bubble {
    background-color: transparent;
    color: #e2e2e2;
  }

  .message-text {
    white-space: pre-wrap;
  }

  /* Reasoning */
  .reasoning-block {
    margin-bottom: 0.65rem;
    border-left: 2px solid #2a2a2a;
    padding-left: 0.75rem;
  }
  .reasoning-toggle {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    background: none;
    border: none;
    color: #737373;
    font-size: 0.775rem;
    cursor: pointer;
    padding: 0;
    transition: color 0.15s;
  }
  .reasoning-toggle:hover {
    color: #a3a3a3;
  }
  .reasoning-toggle svg {
    transition: transform 0.2s ease;
  }
  .reasoning-toggle svg.rotated {
    transform: rotate(180deg);
  }

  .reasoning-text {
    margin-top: 0.5rem;
    font-size: 0.8rem;
    color: #606060;
    line-height: 1.5;
    white-space: pre-wrap;
    font-style: italic;
  }

  /* Tool badges */
  .tool-calls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-bottom: 0.5rem;
  }
  .tool-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.725rem;
    color: #737373;
    background: #1e1e1e;
    border: 1px solid #333;
    border-radius: 0.35rem;
    padding: 0.2rem 0.5rem;
  }

  /* Cursor */
  .cursor-blink {
    display: inline-block;
    color: #10b981;
    animation: blink 1s step-end infinite;
    font-size: 0.9em;
    margin-left: 1px;
  }
  @keyframes blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }

  /* Input */
  .input-area {
    padding: 1rem 2rem 1.75rem;
    max-width: 52rem;
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
  }

  .input-container {
    position: relative;
    background-color: #2a2a2a;
    border: 1px solid #383838;
    border-radius: 0.875rem;
    padding: 0.5rem 0.5rem 0.5rem 1rem;
    display: flex;
    align-items: flex-end;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    transition: border-color 0.2s;
  }
  .input-container:focus-within {
    border-color: #10b981;
  }

  textarea {
    flex: 1;
    background: transparent;
    border: none;
    color: #ececec;
    font-size: 0.975rem;
    resize: none;
    max-height: 200px;
    padding: 0.45rem 0;
    line-height: 1.5;
    outline: none;
    font-family: inherit;
  }
  textarea::placeholder {
    color: #555;
  }

  .send-btn {
    background: #10b981;
    color: white;
    border: none;
    border-radius: 0.5rem;
    width: 1.9rem;
    height: 1.9rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s;
    margin-left: 0.5rem;
    flex-shrink: 0;
    margin-bottom: 0.2rem;
  }
  .send-btn:hover:not(:disabled) {
    background: #0ea271;
    transform: translateY(-1px);
  }
  .send-btn:disabled {
    background: #333;
    color: #555;
    cursor: not-allowed;
  }

  .footer-text {
    text-align: center;
    font-size: 0.7rem;
    color: #555;
    margin-top: 0.65rem;
  }

  /* Typing dots */
  .typing-indicator {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0.4rem 0;
  }
  .typing-indicator span {
    width: 5px;
    height: 5px;
    background-color: #555;
    border-radius: 50%;
    animation: bounce 1.4s infinite ease-in-out both;
  }
  .typing-indicator span:nth-child(1) {
    animation-delay: -0.32s;
  }
  .typing-indicator span:nth-child(2) {
    animation-delay: -0.16s;
  }
  @keyframes bounce {
    0%,
    80%,
    100% {
      transform: scale(0);
    }
    40% {
      transform: scale(1);
    }
  }

  /* Scrollbar */
  ::-webkit-scrollbar {
    width: 5px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: #333;
    border-radius: 4px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #444;
  }
</style>
