import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { prompt, imageBase64, model } = await req.json();
    if (!prompt) throw new Error("prompt required");
    const KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!KEY) throw new Error("OPENROUTER_API_KEY not configured");

    const userContent: any[] = [{ type: "text", text: prompt }];
    if (imageBase64) {
      userContent.push({
        type: "image_url",
        image_url: { url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/png;base64,${imageBase64}` },
      });
    }

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://oltrid.app",
        "X-Title": "Oltrid",
      },
      body: JSON.stringify({
        model: model || "google/gemini-2.5-flash-image-preview",
        messages: [{ role: "user", content: userContent }],
        modalities: ["image", "text"],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("OpenRouter error:", resp.status, t);
      return new Response(JSON.stringify({ error: `Image API error (${resp.status})` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await resp.json();
    const msg = data.choices?.[0]?.message;
    const imageUrl = msg?.images?.[0]?.image_url?.url || null;
    const text = msg?.content || "";
    return new Response(JSON.stringify({ imageUrl, text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-image error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
