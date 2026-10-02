/**
 * The two translation providers (Gemini, ChatGPT) behind one call: system + user prompt in,
 * the model's text out. Plain `fetch` against their REST APIs — no SDKs. Keys are never put
 * in URLs or error messages.
 */

export const AI_PROVIDERS = ["gemini", "openai"] as const;
export type AiProviderId = (typeof AI_PROVIDERS)[number];

export const DEFAULT_MODELS: Record<AiProviderId, string> = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-5-mini",
};

export type AiConfig = { provider: AiProviderId; model: string; apiKey: string };

export type AiRequest = {
  system: string;
  user: string;
  /** Ask for a JSON object back (both APIs have a JSON mode). */
  json?: boolean;
};

export type AiComplete = (req: AiRequest) => Promise<string>;

export class AiError extends Error {
  constructor(
    readonly code: "http" | "empty" | "network",
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 180_000;

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  error?: { message?: string };
};

type OpenAiResponse = {
  choices?: { message?: { content?: string | null } }[];
  error?: { message?: string };
};

export function geminiText(body: GeminiResponse): string {
  const parts = body.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

export function openAiText(body: OpenAiResponse): string {
  return (body.choices?.[0]?.message?.content ?? "").trim();
}

function request(cfg: AiConfig, req: AiRequest): { url: string; init: RequestInit } {
  if (cfg.provider === "gemini") {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`,
      init: {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": cfg.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: [{ role: "user", parts: [{ text: req.user }] }],
          generationConfig: req.json ? { responseMimeType: "application/json" } : {},
        }),
      },
    };
  }
  return {
    url: "https://api.openai.com/v1/chat/completions",
    init: {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
        ...(req.json ? { response_format: { type: "json_object" } } : {}),
      }),
    },
  };
}

/** One completion; throws AiError with the provider's own message on failure. */
export async function aiComplete(
  cfg: AiConfig,
  req: AiRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const { url, init } = request(cfg, req);
  let res: Response;
  try {
    res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new AiError("network", err instanceof Error ? err.message : String(err));
  }
  const body = (await res.json().catch(() => ({}))) as GeminiResponse & OpenAiResponse;
  if (!res.ok) {
    const msg = body.error?.message ?? res.statusText;
    throw new AiError("http", `${res.status}: ${msg}`.slice(0, 300), res.status);
  }
  const text = cfg.provider === "gemini" ? geminiText(body) : openAiText(body);
  if (!text) throw new AiError("empty", "empty response");
  return text;
}

export function aiCompleter(cfg: AiConfig, fetchImpl: typeof fetch = fetch): AiComplete {
  return (req) => aiComplete(cfg, req, fetchImpl);
}
