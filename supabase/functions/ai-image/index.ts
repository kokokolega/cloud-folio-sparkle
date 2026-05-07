import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let rrIndex = 0;

function getKeys(): string[] {
  return [
    Deno.env.get("GEMINI_API_KEY_1"),
    Deno.env.get("GEMINI_API_KEY_2"),
  ].filter(Boolean) as string[];
}

async function callGemini(key: string, model: string, prompt: string, imageBase64?: string) {
  const parts: any[] = [{ text: prompt }];
  if (imageBase64) {
    const cleaned = imageBase64.startsWith("data:")
      ? imageBase64.split(",")[1]
      : imageBase64;
    parts.push({ inline_data: { mime_type: "image/png", data: cleaned } });
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
    }),
  });
  return resp;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { prompt, imageBase64, model } = await req.json();
    if (!prompt) throw new Error("prompt required");

    const keys = getKeys();
    if (keys.length === 0) throw new Error("No Gemini API keys configured");

    const useModel = model || "gemini-2.5-flash-image-preview";

    // Round-robin pick + fallback to the other key on failure
    const order = [];
    const start = rrIndex++ % keys.length;
    for (let i = 0; i < keys.length; i++) order.push(keys[(start + i) % keys.length]);

    let lastErr = "Unknown error";
    let lastStatus = 500;
    for (const key of order) {
      try {
        const resp = await callGemini(key, useModel, prompt, imageBase64);
        if (!resp.ok) {
          const t = await resp.text();
          console.error(`Gemini error (${resp.status}):`, t.slice(0, 400));
          lastErr = t;
          lastStatus = resp.status;
          if (resp.status === 429 || resp.status >= 500) continue; // try next key
          break;
        }
        const data = await resp.json();
        const cand = data.candidates?.[0];
        const partsOut = cand?.content?.parts || [];
        const imgPart = partsOut.find((p: any) => p.inline_data || p.inlineData);
        const inline = imgPart?.inline_data || imgPart?.inlineData;
        const text = partsOut.filter((p: any) => p.text).map((p: any) => p.text).join("\n");
        const imageUrl = inline?.data
          ? `data:${inline.mime_type || inline.mimeType || "image/png"};base64,${inline.data}`
          : null;
        return new Response(JSON.stringify({ imageUrl, text }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        console.error("Gemini call failed:", lastErr);
      }
    }
    return new Response(JSON.stringify({ error: `Image API error (${lastStatus})`, detail: lastErr.slice(0, 300) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-image error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
