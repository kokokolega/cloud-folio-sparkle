const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export type CardAiMode = "summarize_social" | "rewrite_audience" | "better_carousel";

const PROMPTS: Record<CardAiMode, string> = {
  summarize_social:
    "Condense this note into a punchy social carousel script. Return HTML only: one <h1> title, one short <p> hook, then 2-4 short <h2> sections each followed by a <ul> of at most 4 crisp bullets (max 14 words each). Keep any striking numbers as their own short <p>. No preamble, no code block.",
  rewrite_audience:
    "Rewrite this note for a general social-media audience: plain language, concrete, no jargon. Return HTML only: <h1> title, <p> hook, <h2> sections with <ul> bullets, and at most one <blockquote> takeaway. No preamble, no code block.",
  better_carousel:
    "Restructure this note into the strongest possible swipeable carousel. Return HTML only in this order: <h1> title, <p> one-line hook, then 4-7 slides where each slide is an <h2> heading plus either a <ul> of max 4 bullets or one short <p>. Include one <blockquote> insight and one standalone <p> containing a single key statistic if the source supports it. No preamble, no code block.",
};

/** Calls the shared ai-notes function (SSE) and returns the full HTML result. */
export async function rewriteForCards(mode: CardAiMode, content: string): Promise<string> {
  const plain = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!plain) throw new Error("This note is empty");

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-notes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ action: "custom", content, customPrompt: PROMPTS[mode] }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "AI request failed" }));
    throw new Error(err.error || "AI request failed");
  }

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        full += parsed.choices?.[0]?.delta?.content ?? "";
      } catch {
        /* partial chunk — ignore */
      }
    }
  }

  const html = full.replace(/^```html\s*/i, "").replace(/```\s*$/, "").trim();
  if (!html) throw new Error("AI returned an empty result");
  return html;
}
