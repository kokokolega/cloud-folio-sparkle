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

3. **Diagrams, Flowcharts, Mind Maps & Illustrations**: When the user asks for a diagram, flowchart, mind map, org chart, sequence diagram, architecture diagram, or any visual representation, generate it using Mermaid syntax wrapped in a code block like:
   \`\`\`mermaid
   graph TD
       A[Start] --> B[Process]
       B --> C{Decision}
       C -->|Yes| D[Result A]
       C -->|No| E[Result B]
   \`\`\`
   
   Use appropriate Mermaid diagram types:
   - graph TD/LR for flowcharts
   - mindmap for mind maps
   - sequenceDiagram for sequence diagrams
   - classDiagram for class diagrams
   - erDiagram for ER diagrams
   - gantt for Gantt charts
   - pie for pie charts
   - stateDiagram-v2 for state diagrams
   
   Make diagrams detailed, well-labeled, and visually clear. Use descriptive labels and proper node shapes.

4. **Web Search Mode**: When the message starts with [Web Search Mode], the user wants information about current events or web-based topics. Provide the most up-to-date information you have, clearly state your knowledge cutoff, and give comprehensive answers. Cite sources where possible.

5. **File Analysis**: When the user attaches files (shown as [Attached file: filename]), analyze the content thoroughly. For code files, review and suggest improvements. For documents, summarize and answer questions. For data files, analyze patterns and provide insights.

6. **General Q&A**: Answer questions, brainstorm ideas, explain concepts clearly.

7. **File & Folder Advice**: Help organize files, suggest folder structures, naming conventions.

8. **Summaries & Analysis**: Summarize long content, analyze text, extract key points.

Rules:
- Always produce clean, well-formatted HTML for note/presentation content (NOT markdown)
- For regular chat responses, use simple HTML with <p>, <strong>, <em>, <ul>, <li>, <code> tags
- For diagrams, use Mermaid syntax in code blocks
- Be concise but thorough
- Always include the special markers when creating notes or presentations
- Do NOT wrap content in code blocks except for Mermaid diagrams
- When the user says "make a note about X", generate the full note content, don't just describe it
- Be conversational, friendly, and natural in tone — like a helpful colleague, not a robot
- Do NOT use emojis in Mermaid diagram labels (they cause rendering errors)`;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { messages, webSearch } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY)
      throw new Error("LOVABLE_API_KEY is not configured");

    const systemMessages = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    if (webSearch) {
      systemMessages.push({
        role: "system",
        content: "The user has enabled web search mode. Provide the most comprehensive and up-to-date information possible. If you're unsure about recent events, clearly state your knowledge cutoff date.",
      });
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
            ...systemMessages,
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
