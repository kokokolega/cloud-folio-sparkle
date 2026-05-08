import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let rrIndex = 0;

// Try multiple model names — Google has rotated names
const MODEL_CANDIDATES = [
  "gemini-2.5-flash-image",
  "gemini-2.0-flash-exp-image-generation",
  "gemini-2.5-flash-image-preview",
];

function getKeys(): string[] {
  return [
    Deno.env.get("GEMINI_API_KEY_1"),
    Deno.env.get("GEMINI_API_KEY_2"),
  ].filter(Boolean) as string[];
}

async function callGemini(key: string, model: string, prompt: string, imageBase64?: string) {
  const parts: any[] = [{ text: prompt }];
  if (imageBase64) {
    const cleaned = imageBase64.startsWith("data:") ? imageBase64.split(",")[1] : imageBase64;
    parts.push({ inline_data: { mime_type: "image/png", data: cleaned } });
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  return await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
    }),
  });
}

async function callLovableGateway(prompt: string, imageBase64?: string) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;
  const content: any[] = [{ type: "text", text: prompt }];
  if (imageBase64) {
    const url = imageBase64.startsWith("data:") ? imageBase64 : `data:image/png;base64,${imageBase64}`;
    content.push({ type: "image_url", image_url: { url } });
  }
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
    }),
  });
  if (!resp.ok) {
    console.error("Lovable gateway error", resp.status, (await resp.text()).slice(0, 300));
    return null;
  }
  const data = await resp.json();
  const msg = data.choices?.[0]?.message;
  const imageUrl = msg?.images?.[0]?.image_url?.url || null;
  return { imageUrl, text: msg?.content || "" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { prompt, imageBase64 } = await req.json();
    if (!prompt) throw new Error("prompt required");

    // Try Gemini direct first if keys present
    const keys = getKeys();
    let lastErr = "";
    let lastStatus = 0;

    for (const model of MODEL_CANDIDATES) {
      if (keys.length === 0) break;
      const start = rrIndex++ % keys.length;
      for (let i = 0; i < keys.length; i++) {
        const key = keys[(start + i) % keys.length];
        try {
          const resp = await callGemini(key, model, prompt, imageBase64);
          if (!resp.ok) {
            const t = await resp.text();
            lastErr = t;
            lastStatus = resp.status;
            console.error(`Gemini ${model} -> ${resp.status}:`, t.slice(0, 200));
            if (resp.status === 404) break; // try next model
            if (resp.status === 429 || resp.status >= 500) continue;
            break;
          }
          const data = await resp.json();
          const partsOut = data.candidates?.[0]?.content?.parts || [];
          const imgPart = partsOut.find((p: any) => p.inline_data || p.inlineData);
          const inline = imgPart?.inline_data || imgPart?.inlineData;
          const text = partsOut.filter((p: any) => p.text).map((p: any) => p.text).join("\n");
          const imageUrl = inline?.data
            ? `data:${inline.mime_type || inline.mimeType || "image/png"};base64,${inline.data}`
            : null;
          if (imageUrl) {
            return new Response(JSON.stringify({ imageUrl, text }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
        }
      }
    }

    // Fallback to Lovable AI Gateway
    console.log("Falling back to Lovable AI Gateway");
    const gw = await callLovableGateway(prompt, imageBase64);
    if (gw?.imageUrl) {
      return new Response(JSON.stringify(gw), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: `Image API error (${lastStatus || 500})`, detail: lastErr.slice(0, 300) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ai-image error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
