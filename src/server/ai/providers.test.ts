import { describe, expect, it, vi } from "vitest";

import {
  AiError,
  aiComplete,
  aiCompleteWithUsage,
  geminiText,
  geminiThinking,
  limitOf,
  openAiReasoning,
  openAiText,
  request,
} from "./providers";

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

  it("tells a used-up quota from a short rate limit", () => {
    const quotaFailure = (quotaId: string) => ({
      "@type": "type.googleapis.com/google.rpc.QuotaFailure",
      violations: [{ quotaId }],
    });
    const retryInfo = (retryDelay: string) => ({
      "@type": "type.googleapis.com/google.rpc.RetryInfo",
      retryDelay,
    });
    // Gemini free tier, daily requests used up.
    expect(
      limitOf(
        429,
        { details: [quotaFailure("GenerateRequestsPerDayPerProjectPerModel-FreeTier")] },
        null,
      ),
    ).toEqual({ quota: true, retryAfterMs: undefined });
    // Gemini per-minute limit: wait as told.
    expect(
      limitOf(
        429,
        {
          details: [
            quotaFailure("GenerateRequestsPerMinutePerProjectPerModel-FreeTier"),
            retryInfo("37.2s"),
          ],
        },
        null,
      ),
    ).toEqual({ quota: false, retryAfterMs: 37_200 });
    // A wait longer than a minute counts as used up.
    expect(limitOf(429, { details: [retryInfo("3600s")] }, null).quota).toBe(true);
    // OpenAI.
    expect(limitOf(429, { code: "insufficient_quota" }, null).quota).toBe(true);
    expect(limitOf(429, { code: "rate_limit_exceeded" }, "12")).toEqual({
      quota: false,
      retryAfterMs: 12_000,
    });
    expect(limitOf(503, { code: "insufficient_quota" }, "5")).toEqual({});
  });

  it("puts the limit on the thrown error", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: "quota", code: "insufficient_quota" } }), {
          status: 429,
        }),
    );
    const err = await aiComplete(
      { provider: "openai", model: "m", apiKey: "k" },
      { system: "", user: "" },
      fetchImpl as unknown as typeof fetch,
    ).catch((e) => e);
    expect(err.limit).toEqual({ quota: true, retryAfterMs: undefined });
  });

  it("sends a conversation, a reply cap and low thinking (help assistant)", () => {
    const req = {
      system: "sys",
      user: "дараа нь?",
      history: [
        { role: "user" as const, text: "сайн уу" },
        { role: "assistant" as const, text: "сайн" },
      ],
      maxTokens: 900,
      effort: "low" as const,
    };
    const g = JSON.parse(
      request({ provider: "gemini", model: "gemini-3.8-flash", apiKey: "k" }, req).init
        .body as string,
    );
    expect(g.contents.map((c: { role: string }) => c.role)).toEqual(["user", "model", "user"]);
    expect(g.generationConfig).toEqual({
      maxOutputTokens: 900,
      thinkingConfig: { thinkingLevel: "low" },
    });
    const o = JSON.parse(
      request({ provider: "openai", model: "gpt-5-mini", apiKey: "k" }, req).init.body as string,
    );
    expect(o.messages.map((m: { role: string }) => m.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
    ]);
    expect(o).toMatchObject({ max_completion_tokens: 900, reasoning_effort: "low" });
    // The translation request is unchanged: no cap, no thinking knob.
    const plain = JSON.parse(
      request({ provider: "openai", model: "gpt-5-mini", apiKey: "k" }, { system: "s", user: "u" })
        .init.body as string,
    );
    expect(plain).not.toHaveProperty("max_completion_tokens");
    expect(plain).not.toHaveProperty("reasoning_effort");
  });

  it("only sends a thinking knob to models that take one", () => {
    expect(geminiThinking("gemini-2.5-flash-lite")).toEqual({ thinkingBudget: 0 });
    expect(geminiThinking("gemini-3.8-flash")).toEqual({ thinkingLevel: "low" });
    expect(geminiThinking("gemini-2.0-flash")).toBeUndefined();
    expect(openAiReasoning("gpt-5-mini")).toBe(true);
    expect(openAiReasoning("o4-mini")).toBe(true);
    expect(openAiReasoning("gpt-4.1-mini")).toBe(false);
    expect(openAiReasoning("gpt-5-chat-latest")).toBe(false);
  });

  it("reports token usage, cached and thinking included", async () => {
    const g = await aiCompleteWithUsage(
      { provider: "gemini", model: "gemini-3.8-flash", apiKey: "k" },
      { system: "s", user: "u" },
      (async () =>
        json({
          candidates: [{ content: { parts: [{ text: "ok" }] } }],
          usageMetadata: {
            promptTokenCount: 4000,
            cachedContentTokenCount: 3000,
            candidatesTokenCount: 50,
            thoughtsTokenCount: 20,
          },
        })) as unknown as typeof fetch,
    );
    expect(g.usage).toEqual({ input: 4000, cached: 3000, output: 70 });
    const o = await aiCompleteWithUsage(
      { provider: "openai", model: "gpt-5-mini", apiKey: "k" },
      { system: "s", user: "u" },
      (async () =>
        json({
          choices: [{ message: { content: "ok" } }],
          usage: {
            prompt_tokens: 4000,
            completion_tokens: 90,
            prompt_tokens_details: { cached_tokens: 2048 },
          },
        })) as unknown as typeof fetch,
    );
    expect(o.usage).toEqual({ input: 4000, cached: 2048, output: 90 });
  });
});
