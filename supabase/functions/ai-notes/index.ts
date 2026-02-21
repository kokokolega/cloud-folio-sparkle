import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROMPTS: Record<string, string> = {
  summarize:
    "Summarize the following note content concisely. Keep the key points and return well-structured HTML using <p>, <ul>, <li>, <strong> tags. Do NOT wrap in a code block.",
  expand:
    "Expand on the following note content with more detail, examples, and depth. Return well-structured HTML using <p>, <ul>, <li>, <strong>, <h2> tags. Do NOT wrap in a code block.",
  improve:
    "Improve the writing quality of the following note — fix grammar, improve clarity and flow, and make it more professional. Return well-structured HTML. Do NOT wrap in a code block.",
  fix_grammar:
    "Fix all grammar, spelling, and punctuation errors in the following note. Keep the meaning unchanged. Return the corrected text as HTML. Do NOT wrap in a code block.",
  simplify:
    "Simplify the following note content so it's easier to understand. Use shorter sentences and simpler words. Return as HTML. Do NOT wrap in a code block.",
  make_formal:
    "Rewrite the following note in a formal, professional tone. Return as HTML. Do NOT wrap in a code block.",
  make_casual:
    "Rewrite the following note in a friendly, casual tone. Return as HTML. Do NOT wrap in a code block.",
  bullet_points:
    "Convert the following note content into a well-organized bullet-point list. Return as HTML using <ul> and <li> tags. Do NOT wrap in a code block.",
  generate_title:
    "Generate a concise, descriptive title for the following note content. Return ONLY the title text, no HTML tags, no quotes.",
  continue_writing:
    "Continue writing from where the following note left off. Match the style and topic. Return as HTML. Do NOT wrap in a code block.",
  translate_english:
    "Translate the following note content to English. Preserve formatting. Return as HTML. Do NOT wrap in a code block.",
  translate_spanish:
    "Translate the following note content to Spanish. Preserve formatting. Return as HTML. Do NOT wrap in a code block.",
  translate_french:
    "Translate the following note content to French. Preserve formatting. Return as HTML. Do NOT wrap in a code block.",
  translate_hindi:
    "Translate the following note content to Hindi. Preserve formatting. Return as HTML. Do NOT wrap in a code block.",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { action, content, customPrompt } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY)
      throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt =
      action === "custom"
        ? `Follow the user's instruction on the note content. Return well-structured HTML. Do NOT wrap in a code block. Instruction: ${customPrompt}`
        : PROMPTS[action];

    if (!systemPrompt) {
      return new Response(
        JSON.stringify({ error: `Unknown action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: content || "(empty note)" },
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-notes error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
