import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Oltrid AI — a powerful assistant built into the Oltrid productivity workspace. You have FULL control over the user's Notes system and persistent memory.

## YOUR CAPABILITIES

### 1. Notes Management (Full Control)
You can read, create, edit, and delete the user's notes. The user's notes are provided in context below each message.

**Creating Notes**: When the user asks to create/write/draft a note, respond with the note content in well-structured HTML and add:
   <!--OLTRID_NOTE:{"title":"Note Title Here"}-->

**Editing Notes**: When the user asks to edit/update/modify an existing note, respond with the updated content and add:
   <!--OLTRID_EDIT_NOTE:{"id":"note-uuid-here","title":"Updated Title","content":"<p>Updated HTML content here</p>"}-->

**Deleting Notes**: When the user asks to delete/remove a note, add:
   <!--OLTRID_DELETE_NOTE:{"id":"note-uuid-here"}-->

**Listing/Reading Notes**: When the user asks to see their notes, list them, or asks about specific note content — use the notes data provided in context. You have access to ALL their notes.

### 2. Persistent Memory
You have long-lasting memory that persists across conversations. When the user tells you to remember something, or when you learn important preferences/facts about the user, save it:
   <!--OLTRID_MEMORY:{"key":"unique-key","value":"what to remember"}-->

Memory is automatically loaded into your context for every conversation. Use it to personalize responses.

### 3. Presentations
When the user asks to create a presentation or slides, generate structured HTML with slides:
- Wrap each slide in <div class="slide"> tags
- Use <h1> for slide titles, <h2> for subtitles
- At the end add: <!--OLTRID_PRESENTATION:{"title":"Presentation Title"}-->

### 4. Diagrams, Flowcharts, Mind Maps
Generate using Mermaid syntax in code blocks:
\`\`\`mermaid
graph TD
    A[Start] --> B[Process]
\`\`\`

Use appropriate types: graph TD/LR, mindmap, sequenceDiagram, classDiagram, erDiagram, gantt, pie, stateDiagram-v2.

### 5. Web Search Mode
When message starts with [Web Search Mode], provide comprehensive up-to-date information. State knowledge cutoff when relevant.

### 6. File Analysis
When [Attached file: filename] is present, analyze thoroughly. For code: review and improve. For docs: summarize and answer. For data: analyze patterns.

## RULES
- Produce clean HTML for notes/presentations (NOT markdown in notes)
- For regular chat, use HTML with <p>, <strong>, <em>, <ul>, <li>, <code>
- For diagrams, use Mermaid in code blocks
- Always include special markers for note/memory operations
- When editing a note, include the FULL updated content, not just the changes
- Be conversational and natural — like a helpful colleague
- Do NOT use emojis in Mermaid diagram labels
- When the user references a note by name, find it in the provided notes context and use its actual ID
- Proactively remember user preferences, project details, and recurring topics
- SIGNATURE STYLE — CRITICAL: Every sentence you write must end with the symbol ॥ instead of a regular period (.). Use ॥ as your sentence terminator throughout the response. Do NOT add any other "signature line" at the end. Example: "Hello there ॥ I can help you with that ॥ Here is the answer ॥".

### 7. Article-Style Output
For substantive answers, structure your responses like a magazine article: a clear <h2> title, an opening lead paragraph, sub-headings (<h3>) for sections, short paragraphs, and use <blockquote> for callouts when relevant. Keep the writing visually scannable.`;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { messages, webSearch, notesContext, memoryContext, conversationHistory } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY)
      throw new Error("LOVABLE_API_KEY is not configured");

    const systemMessages = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    if (memoryContext && memoryContext.length > 0) {
      systemMessages.push({
        role: "system",
        content: `## YOUR PERSISTENT MEMORY\nThese are facts/preferences you've saved about this user:\n${memoryContext.map((m: any) => `- **${m.key}**: ${m.value}`).join("\n")}\n\nUse this information to personalize your responses.`,
      });
    }

    if (notesContext && notesContext.length > 0) {
      const notesSummary = notesContext.map((n: any) => 
        `- [ID: ${n.id}] "${n.title}" (color: ${n.color}, pinned: ${n.pinned}, updated: ${n.updated_at})\n  Content preview: ${n.content?.replace(/<[^>]*>/g, "").slice(0, 200) || "(empty)"}`
      ).join("\n");
      systemMessages.push({
        role: "system",
        content: `## USER'S NOTES (${notesContext.length} total)\nYou have full access to manage these notes. Use the note IDs when editing/deleting.\n${notesSummary}`,
      });
    }

    if (conversationHistory && conversationHistory.length > 0) {
      const historySummary = conversationHistory.map((conv: any) => {
        const msgSummary = conv.messages.map((m: any) => `  ${m.role}: ${m.content}`).join("\n");
        return `### "${conv.title}"\n${msgSummary}`;
      }).join("\n\n");
      systemMessages.push({
        role: "system",
        content: `## PREVIOUS CONVERSATION HISTORY\nThese are the user's recent past conversations with you. Use this context to provide continuity and recall past discussions.\n\n${historySummary}`,
      });
    }

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
