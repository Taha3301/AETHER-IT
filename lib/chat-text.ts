export type ChatTextMessage = {
  id: string;
  sender: "USER" | "AI";
  content: string;
};

export type ChatLanguage = "fr" | "en";

export function replacePendingWithReply(
  messages: ChatTextMessage[],
  pendingMessageId: string,
  userMessage: ChatTextMessage | null,
  aiMessage: ChatTextMessage,
): ChatTextMessage[] {
  return [
    ...messages.filter(
      (message) =>
        message.id !== pendingMessageId && (!userMessage || message.id !== userMessage.id),
    ),
    ...(userMessage ? [userMessage] : []),
    aiMessage,
  ];
}

export function cleanSpeechText(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/&amp;/gi, " et ")
    .replace(/&(?:quot|apos|#39);/gi, " ")
    .replace(/&(?:lt|gt);/gi, " ")
    .replace(/['’]/g, (character, index, text: string) =>
      /\p{L}/u.test(text[index - 1] ?? "") && /\p{L}/u.test(text[index + 1] ?? "")
        ? character
        : " ",
    )
    .replace(/[^\p{L}\p{N}\s.,!?;:'’\-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
