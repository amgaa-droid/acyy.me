/**
 * The two translation providers (Gemini, ChatGPT) behind one call: system + user prompt in,
 * the model's text out. Plain `fetch` against their REST APIs — no SDKs. Keys are never put
 * in URLs or error messages.
 */

export const AI_PROVIDERS = ["gemini", "openai"] as const;
export type AiProviderId = (typeof AI_PROVIDERS)[number];

export const DEFAULT_MODELS: Record<AiProviderId, string> = {
  gemini: "gemini-3.8-flash",
  openai: "gpt-5-mini",
};

/**
 * Models a provider has shut down → the one to use instead. Saved settings still naming one are
 * upgraded when read, so a retirement doesn't break the sync until someone edits /admin/ai.
 */
export const RETIRED_MODELS: Record<AiProviderId, Record<string, string>> = {
  gemini: { "gemini-2.5-flash": DEFAULT_MODELS.gemini },
  openai: {},
};

export function currentModel(provider: AiProviderId, model: string): string {
  const m = model.trim();
  return RETIRED_MODELS[provider][m] ?? m;
}

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
    readonly limit: {
      /** The plan's quota is used up (daily / billing) — retrying won't help today. */
      quota?: boolean;
      /** The provider says when to try again (a per-minute rate limit). */
      retryAfterMs?: number;
    } = {},
  ) {
    super(message);
  }
}

type ApiError = {
  message?: string;
  code?: string | number;
  type?: string;
  details?: { "@type"?: string; retryDelay?: string; violations?: { quotaId?: string }[] }[];
};

/** A rate limit asking us to wait longer than this is treated as a used-up quota. */
const MAX_RETRY_AFTER_MS = 60_000;

/**
 * Reads a 429: Gemini puts the quota (`…PerDay…` / `…PerMinute…`) and a `RetryInfo` delay in
 * `error.details`; OpenAI says `insufficient_quota` and may send a `retry-after` header.
 */
export function limitOf(
  status: number,
  error: ApiError | undefined,
  retryAfterHeader: string | null,
): AiError["limit"] {
  if (status !== 429) return {};
  const header = Number(retryAfterHeader);
  const delay = error?.details?.find((d) => d["@type"]?.endsWith("RetryInfo"))?.retryDelay;
  const retryAfterMs =
    retryAfterHeader && Number.isFinite(header)
      ? header * 1000
      : delay && /^\d+(\.\d+)?s$/.test(delay)
        ? Math.ceil(parseFloat(delay) * 1000)
        : undefined;
  const quotaIds = (error?.details ?? []).flatMap((d) => d.violations ?? []).map((v) => v.quotaId);
  const quota =
    error?.code === "insufficient_quota" ||
    error?.type === "insufficient_quota" ||
    quotaIds.some((id) => id && /per ?day/i.test(id)) ||
    (retryAfterMs ?? 0) > MAX_RETRY_AFTER_MS;
  return { quota, retryAfterMs };
}

const TIMEOUT_MS = 180_000;

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  error?: ApiError;
};

type OpenAiResponse = {
  choices?: { message?: { content?: string | null } }[];
  error?: ApiError;
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
    throw new AiError(
      "http",
      `${res.status}: ${msg}`.slice(0, 300),
      res.status,
      limitOf(res.status, body.error, res.headers.get("retry-after")),
    );
  }
  const text = cfg.provider === "gemini" ? geminiText(body) : openAiText(body);
  if (!text) throw new AiError("empty", "empty response");
  return text;
}

export function aiCompleter(cfg: AiConfig, fetchImpl: typeof fetch = fetch): AiComplete {
  return (req) => aiComplete(cfg, req, fetchImpl);
}
