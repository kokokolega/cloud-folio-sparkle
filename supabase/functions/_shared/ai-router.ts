/**
 * Shared AI provider router.
 *
 * Selects between OpenRouter (primary) and the existing Lovable AI Gateway
 * (Gemini) using configurable weights. Falls back to the other provider
 * on transient failures (429, 5xx, network errors).
 *
 * Both providers use the OpenAI-compatible /v1/chat/completions SSE format,
 * so the response stream is passed through unchanged to the frontend.
 *
 * Config is read from the `ai_provider_config` table via the
 * `get_ai_provider_config()` SECURITY DEFINER function. If the database
 * is unreachable, falls back to env vars:
 *   OPENROUTER_WEIGHT      (default 90)
 *   GEMINI_WEIGHT          (default 10)
 *   OPENROUTER_API_KEY_1..5
 *   OPENROUTER_MODEL_1..5
 *   LOVABLE_API_KEY
 */

export interface RouteResult {
  response: Response;
  provider: "openrouter" | "gemini";
}

export interface RouterOptions {
  /** Existing gateway model (e.g. "google/gemini-3-flash-preview") */
  geminiModel: string;
  /** Full message array to send */
  messages: any[];
  /** Whether to request SSE streaming (default true) */
  stream?: boolean;
}

interface ProviderConfig {
  orKeys: string[];
  orModels: string[];
  orWeight: number;
  gemWeight: number;
  lovableKey: string | null;
}

/* ---- config loading ---- */

async function loadConfig(): Promise<ProviderConfig> {
  // Try database first
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

  if (supabaseUrl && supabaseKey) {
    try {
      const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/get_ai_provider_config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
        },
        body: "{}",
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data) {
          const orKeys: string[] = (data.openrouter_api_keys || []).filter(Boolean);
          const orModels: string[] = (data.openrouter_models || []).filter(Boolean);
          return {
            orKeys,
            orModels,
            orWeight: data.openrouter_weight ?? 90,
            gemWeight: data.gemini_weight ?? 10,
            lovableKey,
          };
        }
      }
    } catch (e) {
      console.error("[ai-router] failed to load config from DB, falling back to env:", e instanceof Error ? e.message : e);
    }
  }

  // Fallback to env vars
  return {
    orKeys: getEnvList("OPENROUTER_API_KEY"),
    orModels: getEnvList("OPENROUTER_MODEL"),
    orWeight: getWeight("OPENROUTER_WEIGHT", 90),
    gemWeight: getWeight("GEMINI_WEIGHT", 10),
    lovableKey,
  };
}

function getWeight(env: string, fallback: number): number {
  const raw = Deno.env.get(env);
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function getEnvList(prefix: string): string[] {
  const out: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const v = Deno.env.get(`${prefix}_${i}`);
    if (v) out.push(v);
  }
  return out;
}

/* ---- provider callers ---- */

function callOpenRouter(
  apiKey: string,
  model: string,
  messages: any[],
  stream: boolean,
): Promise<Response> {
  return fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://oltrid.app",
      "X-Title": "Oltrid",
    },
    body: JSON.stringify({ model, messages, stream }),
  });
}

function callGemini(
  apiKey: string,
  model: string,
  messages: any[],
  stream: boolean,
): Promise<Response> {
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, stream }),
  });
}

/* ---- weighted selection ---- */

function pickProvider(orWeight: number, gemWeight: number): "openrouter" | "gemini" {
  const total = orWeight + gemWeight;
  if (total === 0) return "openrouter";
  const r = Math.random() * total;
  return r < orWeight ? "openrouter" : "gemini";
}

/* ---- retryable error check ---- */

function isTransient(status: number): boolean {
  return status === 429 || status === 408 || status >= 500;
}

/* ---- main entry ---- */

export async function routeAi(opts: RouterOptions): Promise<RouteResult> {
  const { geminiModel, messages, stream = true } = opts;

  const config = await loadConfig();
  const { orKeys, orModels, orWeight, gemWeight, lovableKey } = config;

  // Default OpenRouter model if none configured
  const defaultOrModel = "google/gemini-2.5-flash";

  const primary = pickProvider(orWeight, gemWeight);

  // If the selected primary has no keys, fall to the other
  let first: "openrouter" | "gemini" = primary;
  let second: "openrouter" | "gemini" = primary === "openrouter" ? "gemini" : "openrouter";

  if (first === "openrouter" && orKeys.length === 0) {
    first = "gemini";
    second = "openrouter";
  }
  if (first === "gemini" && !lovableKey) {
    first = "openrouter";
    second = "gemini";
  }
  // If neither provider has keys, throw
  if (orKeys.length === 0 && !lovableKey) {
    throw new Error("No AI provider keys configured");
  }

  for (const provider of [first, second]) {
    // Skip if this provider has no keys
    if (provider === "openrouter" && orKeys.length === 0) continue;
    if (provider === "gemini" && !lovableKey) continue;

    try {
      let resp: Response;
      if (provider === "openrouter") {
        const key = orKeys[Math.floor(Math.random() * orKeys.length)];
        const model = orModels.length > 0
          ? orModels[Math.floor(Math.random() * orModels.length)]
          : defaultOrModel;
        console.log(`[ai-router] calling OpenRouter model=${model}`);
        resp = await callOpenRouter(key, model, messages, stream);
      } else {
        console.log(`[ai-router] calling Gemini gateway model=${geminiModel}`);
        resp = await callGemini(lovableKey!, geminiModel, messages, stream);
      }

      // If transient error, try next provider
      if (!resp.ok && isTransient(resp.status)) {
        const bodyText = await resp.text().catch(() => "");
        console.error(`[ai-router] ${provider} transient ${resp.status}:`, bodyText.slice(0, 300));
        continue;
      }

      // Non-transient errors — return as-is so the calling function can
      // handle 402, 400, etc. in its existing logic.
      return { response: resp, provider };
    } catch (e) {
      console.error(`[ai-router] ${provider} network error:`, e instanceof Error ? e.message : e);
      continue;
    }
  }

  // Both providers failed — return a synthetic 503
  return {
    response: new Response(
      JSON.stringify({ error: "All AI providers are currently unavailable. Please try again shortly." }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    ),
    provider: first,
  };
}
