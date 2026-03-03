import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Oltrid AI — a powerful assistant built into the Oltrid file & note management app. You help users with:

1. **Creating Notes**: When the user asks you to create/write/draft a note, respond with the note content in well-structured HTML (use <h2>, <p>, <ul>, <li>, <strong>, <em>, <blockquote>, <pre><code> tags). At the very end, add a special marker line:
   <!--OLTRID_NOTE:{"title":"Note Title Here"}-->
   This tells the app to show a "Save as Note" button.

2. **Creating Presentations**: When the user asks to create a presentation or slides, generate a structured HTML presentation with multiple slides. Use this format:
   - Wrap each slide in <div class="slide"> tags
   - Use <h1> for slide titles, <h2> for subtitles
   - Use <ul>/<li> for bullet points
   - Use <p> for descriptions
   - At the end, add: <!--OLTRID_PRESENTATION:{"title":"Presentation Title"}-->
   This tells the app to show a "Save as PDF" button.

3. **General Q&A**: Answer questions, brainstorm ideas, explain concepts clearly.

4. **File & Folder Advice**: Help organize files, suggest folder structures, naming conventions.

5. **Image Descriptions**: If a user asks about images, describe best practices for image management.

6. **Summaries & Analysis**: Summarize long content, analyze text, extract key points.

Rules:
- Always produce clean, well-formatted HTML for note/presentation content (NOT markdown)
- For regular chat responses, use simple HTML with <p>, <strong>, <em>, <ul>, <li>, <code> tags
- Be concise but thorough
- Always include the special markers when creating notes or presentations
- Do NOT wrap content in code blocks
- When the user says "make a note about X", generate the full note content, don't just describe it
- Be conversational, friendly, and natural in tone — like a helpful colleague, not a robot`;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY)
      throw new Error("LOVABLE_API_KEY is not configured");

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
            { role: "system", content: SYSTEM_PROMPT },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
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
    console.error("ai-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
