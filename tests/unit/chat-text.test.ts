import { describe, expect, it } from "vitest";
import { cleanSpeechText, replacePendingWithReply } from "@/lib/chat-text";

describe("chat text utilities", () => {
  it("replaces a pending user message without duplicating the saved message", () => {
    const savedUserMessage = { id: "user-1", sender: "USER" as const, content: "hello" };
    const messages = replacePendingWithReply(
      [
        savedUserMessage,
        { id: "pending-1", sender: "USER", content: "hello" },
      ],
      "pending-1",
      savedUserMessage,
      { id: "ai-1", sender: "AI", content: "Hi there." },
    );

    expect(messages).toEqual([
      savedUserMessage,
      { id: "ai-1", sender: "AI", content: "Hi there." },
    ]);
  });

  it("removes markdown and symbols while preserving readable wording", () => {
    expect(
      cleanSpeechText(
        '**Bonjour** "Alex" [consultez le guide](https://example.com/docs) !\n`code` [OK]',
      ),
    ).toBe("Bonjour Alex consultez le guide ! code OK");
  });

  it("preserves natural apostrophes and sentence punctuation", () => {
    expect(cleanSpeechText("L'IA répond : c’est prêt.")).toBe("L'IA répond : c’est prêt.");
  });

  it("returns an empty string for symbol-only content", () => {
    expect(cleanSpeechText(`["*_#]`)).toBe("");
  });
});
