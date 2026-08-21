import { describe, expect, it } from "vitest";
import {
  CONVERSATION_ROLES,
  CONVERSATION_STATES,
  appendMessage,
  clearConversation,
  conversationToHistory,
  createConversation,
  createMessage,
  resetMessageIdForTests,
  updateMessage,
} from "./conversation";

describe("conversation", () => {
  it("creates a message with id and timestamp", () => {
    resetMessageIdForTests();
    const message = createMessage({ role: CONVERSATION_ROLES.user, content: "hello" });
    expect(message.id).toMatch(/^msg-/);
    expect(message.role).toBe("user");
    expect(message.content).toBe("hello");
    expect(typeof message.timestamp).toBe("number");
    expect(message.streaming).toBe(false);
  });

  it("supports optional context and tool metadata", () => {
    const message = createMessage({
      role: CONVERSATION_ROLES.assistant,
      content: "hi",
      contextMetadata: { budget: 1000 },
      toolMetadata: { toolCalls: [{ toolName: "ide.current-file" }] },
      streaming: true,
    });
    expect(message.contextMetadata.budget).toBe(1000);
    expect(message.toolMetadata.toolCalls).toHaveLength(1);
    expect(message.streaming).toBe(true);
  });

  it("appends and updates messages", () => {
    const conversation = createConversation({ title: "Test" });
    const message = createMessage({ role: "user", content: "a" });
    const next = appendMessage(conversation, message);
    expect(next.messages).toHaveLength(1);
    const updated = updateMessage(next, message.id, { content: "b" });
    expect(updated.messages[0].content).toBe("b");
  });

  it("clears conversation", () => {
    const conversation = createConversation();
    const message = createMessage({ role: "user", content: "x" });
    const filled = appendMessage(conversation, message);
    expect(clearConversation(filled).messages).toHaveLength(0);
  });

  it("maps to history excluding error messages", () => {
    const messages = [
      createMessage({ role: "user", content: "hi" }),
      createMessage({ role: "error", content: "oops" }),
      createMessage({ role: "assistant", content: "hello" }),
    ];
    const history = conversationToHistory(messages);
    expect(history).toHaveLength(2);
    expect(history[0].role).toBe("user");
  });

  it("exposes conversation states", () => {
    expect(CONVERSATION_STATES.idle).toBe("idle");
    expect(CONVERSATION_STATES.generating).toBe("generating");
  });
});
