import { describe, expect, it, vi } from "vitest";

import { AiError, aiComplete, geminiText, openAiText } from "./providers";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("AI providers", () => {
  it("calls Gemini with the key in a header (not the URL) and JSON mode", async () => {
    const fetchImpl = vi.fn(async () =>
      json({
        candidates: [
          { content: { parts: [{ text: "думаа", thought: true }, { text: '{"a":"б"}' }] } },
        ],
      }),
    );
    const out = await aiComplete(
      { provider: "gemini", model: "gemini-3.8-flash", apiKey: "g-key" },
      { system: "sys", user: "hi", json: true },
      fetchImpl as unknown as typeof fetch,
    );
    expect(out).toBe('{"a":"б"}');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
    );
    expect(url).not.toContain("g-key");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("g-key");
    const body = JSON.parse(init.body as string);
    expect(body.systemInstruction.parts[0].text).toBe("sys");
    expect(body.generationConfig.responseMimeType).toBe("application/json");
  });

  it("calls OpenAI chat completions with a bearer key", async () => {
    const fetchImpl = vi.fn(async () => json({ choices: [{ message: { content: " сайн " } }] }));
    const out = await aiComplete(
      { provider: "openai", model: "gpt-5-mini", apiKey: "o-key" },
      { system: "sys", user: "hi" },
      fetchImpl as unknown as typeof fetch,
    );
    expect(out).toBe("сайн");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer o-key");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("gpt-5-mini");
    expect(body.messages).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "hi" },
    ]);
    expect(body.response_format).toBeUndefined();
  });

  it("turns API errors into AiError with the provider's message and status", async () => {
    const fetchImpl = vi.fn(async () => json({ error: { message: "API key not valid" } }, 400));
    const err = await aiComplete(
      { provider: "gemini", model: "m", apiKey: "k" },
      { system: "", user: "" },
      fetchImpl as unknown as typeof fetch,
    ).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.status).toBe(400);
    expect(err.message).toContain("API key not valid");
  });

  it("treats an empty answer as an error", async () => {
    expect(geminiText({ candidates: [] })).toBe("");
    expect(openAiText({ choices: [{ message: { content: null } }] })).toBe("");
    const fetchImpl = vi.fn(async () => json({ choices: [] }));
    await expect(
      aiComplete(
        { provider: "openai", model: "m", apiKey: "k" },
        { system: "", user: "" },
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: "empty" });
  });
});
