import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  answerProjectMessage,
  generateProjectAnalysis,
  generateProjectTitle,
  LlmConfigurationError,
  LlmRequestError,
} from "@/lib/llm";

const analysis = {
  summary: "A booking platform.",
  problem: "Finding available local services is difficult.",
  solution: "A searchable booking platform.",
  targetAudience: "Local customers",
  targetMarket: "Tunisia",
  businessModel: "Commission",
  valueProposition: "Simple bookings",
  features: '["Search","Booking"]',
  competitors: "Unknown",
  technology: "Web",
  marketingStrategy: "Local partnerships",
  roadmap: '["MVP","Launch"]',
  risks: "Customer acquisition",
};

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-api-key");
  vi.stubEnv("OPENAI_MODEL", "test-model");
  vi.stubEnv("OPENAI_BASE_URL", "https://llm.example.test/v1");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("OpenAI-compatible LLM service", () => {
  it("sends chat history server-side and returns the provider answer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ output_text: "A useful reply.", output: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const reply = await answerProjectMessage("Booking app", [
      { role: "user", content: "I need bookings." },
    ]);
    expect(reply).toBe("A useful reply.");
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://llm.example.test/v1/responses"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer test-api-key",
        }),
        body: expect.stringContaining('"store":false'),
        cache: "no-store",
      }),
    );
    const requestOptions = fetchMock.mock.calls[0]?.[1];
    if (!requestOptions) throw new Error("Expected AI provider fetch options.");
    const requestBody = JSON.parse(requestOptions.body as string) as {
      input: Array<{ role: string; content: string }>;
    };
    expect(requestBody.input[0].content).toContain("Reply only in French");
  });

  it("instructs the assistant to answer in the selected language", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ output_text: "A useful reply.", output: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await answerProjectMessage("Booking app", [], "en");

    const requestOptions = vi.mocked(fetch).mock.calls[0]?.[1];
    if (!requestOptions) throw new Error("Expected AI provider fetch options.");
    const requestBody = JSON.parse(requestOptions.body as string) as {
      input: Array<{ role: string; content: string }>;
    };
    expect(requestBody.input[0].content).toContain("Reply only in English");
  });

  it("generates a concise project name from the idea in the selected language", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ output_text: '"Plateforme de réservation locale"', output: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(
      generateProjectTitle("Je veux créer une application de réservation.", "fr"),
    ).resolves.toBe("Plateforme de réservation locale");

    const requestOptions = vi.mocked(fetch).mock.calls[0]?.[1];
    if (!requestOptions) throw new Error("Expected AI provider fetch options.");
    const requestBody = JSON.parse(requestOptions.body as string) as {
      input: Array<{ role: string; content: string }>;
    };
    expect(requestBody.input[0].content).toContain("in French");
    expect(requestBody.input[1]).toEqual({
      role: "user",
      content: "Je veux créer une application de réservation.",
    });
  });

  it("parses and validates structured analysis JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ output_text: JSON.stringify(analysis), output: [] }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );
    await expect(generateProjectAnalysis("Booking app", [])).resolves.toEqual(analysis);
    const fetchMock = vi.mocked(fetch);
    const requestOptions = fetchMock.mock.calls[0]?.[1];
    if (!requestOptions) throw new Error("Expected AI provider fetch options.");
    const requestBody = JSON.parse(requestOptions.body as string) as {
      input: Array<{ role: string; content: string }>;
    };
    expect(requestBody.input[0].content).toContain(
      "write every analysis value in that same language",
    );
  });

  it("requires a configured server-side key and model", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(answerProjectMessage("Booking app", [])).rejects.toBeInstanceOf(
      LlmConfigurationError,
    );
  });

  it("reports invalid provider responses as request failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ output_text: "", output: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    await expect(answerProjectMessage("Booking app", [])).rejects.toBeInstanceOf(
      LlmRequestError,
    );
  });

  it("returns useful provider errors without leaking API keys", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              message:
                "Invalid API key sk-proj-1234567890abcdefghijklmnopqrstuvwxyz",
            },
          }),
          {
            status: 401,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );
    await expect(answerProjectMessage("Booking app", [])).rejects.toThrow(
      "AI provider returned HTTP 401: Invalid API key [redacted]",
    );
  });
});
