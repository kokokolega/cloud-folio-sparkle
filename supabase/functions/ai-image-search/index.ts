import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { routeAi } from "../_shared/ai-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ---------- Types ---------- */

interface ImageResult {
  id: string;
  thumbnailUrl: string;
  imageUrl: string;
  sourceUrl: string;
  width: number;
  height: number;
  provider: string;
  attribution: string;
  alt: string;
}

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
  alt: string;
}

/* ---------- Pexels API ---------- */

async function searchPexels(
  query: string,
  perPage: number,
  page: number,
): Promise<{ photos: PexelsPhoto[]; hasMore: boolean }> {
  const apiKey = Deno.env.get("PEXELS_API_KEY");
  if (!apiKey) throw new Error("PEXELS_API_KEY not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&orientation=landscape`;
    const resp = await fetch(url, {
      headers: { Authorization: apiKey },
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`Pexels API ${resp.status}`);
    const data = await resp.json();
    return {
      photos: data.photos || [],
      hasMore: !!data.next_page,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/* ---------- Query Understanding via AI ---------- */

interface QueryUnderstanding {
  subject: string;
  style: string;
  environment: string;
  composition: string;
  orientation: string;
  negativeTerms: string[];
  searchQueries: string[];
}

async function understandQuery(userQuery: string): Promise<QueryUnderstanding> {
  const prompt = `You are an image search query optimizer. The user wants to find images. Analyze their request and produce optimized search queries.

User request: "${userQuery}"

Extract the following and respond as JSON ONLY (no markdown, no code fences):
{
  "subject": "the main subject in 2-5 words",
  "style": "visual style if mentioned, e.g. minimalist, modern, rustic, or empty string",
  "environment": "setting/context if mentioned, e.g. office, bedroom, outdoors, or empty string",
  "composition": "composition hints if mentioned, e.g. close-up, wide-angle, aerial, or empty string",
  "orientation": "landscape, portrait, or square if implied, otherwise empty string",
  "negativeTerms": ["terms to avoid if any"],
  "searchQueries": ["3-5 concise search queries (2-6 words each) optimized for stock photo search, tightly related to the original intent, no generic terms"]
}

Rules:
- Each search query must be 2-6 words
- Queries should cover different angles of the same intent
- Do NOT include the word "image" or "photo" or "picture" in queries
- Do NOT include style words unless the user mentioned them
- Return ONLY valid JSON`;

  try {
    const { response } = await routeAi({
      geminiModel: "google/gemini-3-flash-preview",
      messages: [{ role: "user", content: prompt }],
      stream: false,
    });

    if (!response.ok) throw new Error(`AI ${response.status}`);
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    if (!parsed.searchQueries || !Array.isArray(parsed.searchQueries) || parsed.searchQueries.length === 0) {
      throw new Error("No search queries returned");
    }

    return {
      subject: parsed.subject || userQuery,
      style: parsed.style || "",
      environment: parsed.environment || "",
      composition: parsed.composition || "",
      orientation: parsed.orientation || "",
      negativeTerms: parsed.negativeTerms || [],
      searchQueries: parsed.searchQueries.slice(0, 5),
    };
  } catch (e) {
    console.error("[ai-image-search] query understanding failed:", e instanceof Error ? e.message : e);
    // Fallback: use the raw query with a simple cleanup
    const cleaned = userQuery
      .replace(/\b(show|find|search|give|get|me|images?|photos?|pictures?|of|some)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);
    return {
      subject: cleaned || userQuery,
      style: "",
      environment: "",
      composition: "",
      orientation: "",
      negativeTerms: [],
      searchQueries: [cleaned || userQuery].slice(0, 3),
    };
  }
}

/* ---------- Relevance Ranking via AI ---------- */

interface RankedItem {
  id: string;
  relevanceScore: number;
  reason: string;
}

async function rankCandidates(
  userQuery: string,
  understanding: QueryUnderstanding,
  candidates: ImageResult[],
): Promise<Map<string, number>> {
  if (candidates.length <= 5) {
    // Not enough to justify an AI call — give all equal score
    const map = new Map<string, number>();
    candidates.forEach((c, i) => map.set(c.id, 1 - i * 0.01));
    return map;
  }

  // Build a compact description of each candidate for the AI
  const candidateDescriptions = candidates.map((c, i) => ({
    index: i,
    id: c.id,
    alt: c.alt,
    width: c.width,
    height: c.height,
    aspectRatio: (c.width / c.height).toFixed(2),
  }));

  const prompt = `You are an image relevance ranker. The user searched for: "${userQuery}"
Intent: subject="${understanding.subject}", style="${understanding.style}", environment="${understanding.environment}", composition="${understanding.composition}"

Here are ${candidates.length} candidate images (as JSON). For each, assign a relevance score from 0.0 to 1.0 based on how well it matches the user's intent. Consider:
- Subject match (most important)
- Context/environment match
- Style match if specified
- Image quality (prefer larger, higher resolution)
- Alt text relevance

Candidates:
${JSON.stringify(candidateDescriptions.slice(0, 40))}

Respond as JSON array ONLY (no markdown): [{"id":"...","score":0.85},...] for every candidate. Higher score = more relevant.`;

  try {
    const { response } = await routeAi({
      geminiModel: "google/gemini-3-flash-preview",
      messages: [{ role: "user", content: prompt }],
      stream: false,
    });

    if (!response.ok) throw new Error(`AI ${response.status}`);
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const rankings: RankedItem[] = JSON.parse(cleaned);

    const map = new Map<string, number>();
    for (const r of rankings) {
      if (r.id && typeof r.score === "number") {
        map.set(r.id, Math.max(0, Math.min(1, r.score)));
      }
    }
    return map;
  } catch (e) {
    console.error("[ai-image-search] ranking failed:", e instanceof Error ? e.message : e);
    // Fallback: use deterministic scoring based on resolution and order
    const map = new Map<string, number>();
    candidates.forEach((c, i) => {
      const resScore = Math.min(1, (c.width * c.height) / (1920 * 1280));
      const orderScore = 1 - i * 0.02;
      map.set(c.id, Math.max(0, resScore * 0.4 + orderScore * 0.6));
    });
    return map;
  }
}

/* ---------- Filtering ---------- */

function filterCandidates(items: ImageResult[]): ImageResult[] {
  const seen = new Set<string>();
  const result: ImageResult[] = [];

  for (const item of items) {
    // Skip broken/missing URLs
    if (!item.imageUrl || !item.thumbnailUrl) continue;
    // Skip extremely low-res (under 400x300)
    if (item.width < 400 || item.height < 300) continue;
    // Skip exact URL duplicates (normalized)
    const normalizedUrl = normalizeUrl(item.imageUrl);
    if (seen.has(normalizedUrl)) continue;
    seen.add(normalizedUrl);
    result.push(item);
  }

  return result;
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove query params that don't affect the image identity
    const params = new URLSearchParams(u.search);
    ["dl", "download", "token"].forEach((k) => params.delete(k));
    u.search = params.toString();
    return `${u.origin}${u.pathname}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/* ---------- Near-Duplicate Detection ---------- */

function removeNearDuplicates(items: ImageResult[]): ImageResult[] {
  // Group by photographer + similar dimensions (proxy for same photo shoot)
  const groups = new Map<string, ImageResult[]>();
  for (const item of items) {
    const key = `${item.attribution}-${Math.round(item.width / 100)}x${Math.round(item.height / 100)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  const result: ImageResult[] = [];
  for (const group of groups.values()) {
    // Keep the highest-resolution from each group
    group.sort((a, b) => b.width * b.height - a.width * a.height);
    result.push(group[0]);
  }
  return result;
}

/* ---------- Diversity Selection ---------- */

function ensureDiversity(items: ImageResult[], maxResults: number): ImageResult[] {
  if (items.length <= maxResults) return items;

  // Simple diversity: ensure different aspect ratios and photographers where possible
  const selected: ImageResult[] = [];
  const usedPhotographers = new Set<string>();
  const usedAspectBuckets = new Set<string>();

  // First pass: pick best from each photographer
  for (const item of items) {
    if (selected.length >= maxResults) break;
    const photographer = item.attribution;
    const aspectBucket = item.width > item.height ? "landscape" : item.width < item.height ? "portrait" : "square";
    if (!usedPhotographers.has(photographer) || !usedAspectBuckets.has(aspectBucket)) {
      selected.push(item);
      usedPhotographers.add(photographer);
      usedAspectBuckets.add(aspectBucket);
    }
  }

  // Second pass: fill remaining slots with best remaining
  for (const item of items) {
    if (selected.length >= maxResults) break;
    if (!selected.includes(item)) selected.push(item);
  }

  return selected.slice(0, maxResults);
}

/* ---------- Main Handler ---------- */

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { query, page = 1 } = await req.json();
    if (!query || typeof query !== "string") {
      return new Response(
        JSON.stringify({ error: "query required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const trimmedQuery = query.trim().slice(0, 200);
    const pageNum = Math.max(1, Math.min(5, page));

    // Step 1: Query Understanding
    const understanding = await understandQuery(trimmedQuery);

    // Step 2: Multi-query retrieval from Pexels (concurrent)
    const perPage = 15;
    const searchPromises = understanding.searchQueries.map((q, idx) =>
      searchPexels(q, perPage, pageNum).then((r) => ({
        query: q,
        queryIndex: idx,
        photos: r.photos,
      })).catch((e) => {
        console.error(`[ai-image-search] Pexels query "${q}" failed:`, e instanceof Error ? e.message : e);
        return { query: q, queryIndex: idx, photos: [] as PexelsPhoto[] };
      }),
    );

    const searchResults = await Promise.all(searchPromises);

    // Step 3: Collect candidates
    const candidateMap = new Map<number, { photo: PexelsPhoto; queryIndex: number }>();
    for (const result of searchResults) {
      for (const photo of result.photos) {
        if (!candidateMap.has(photo.id)) {
          candidateMap.set(photo.id, { photo, queryIndex: result.queryIndex });
        }
      }
    }

    // Convert to ImageResult
    let candidates: ImageResult[] = Array.from(candidateMap.values()).map(({ photo }) => ({
      id: `pexels-${photo.id}`,
      thumbnailUrl: photo.src.medium || photo.src.small || photo.src.tiny,
      imageUrl: photo.src.large2x || photo.src.large || photo.src.original,
      sourceUrl: photo.url,
      width: photo.width,
      height: photo.height,
      provider: "Pexels",
      attribution: photo.photographer ? `Photo by ${photo.photographer} on Pexels` : "Pexels",
      alt: photo.alt || trimmedQuery,
    }));

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({
          type: "image_search",
          query: trimmedQuery,
          results: [],
          page: pageNum,
          hasMore: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Step 4: Filter (broken URLs, low-res, exact dupes)
    candidates = filterCandidates(candidates);

    // Step 5: Remove near-duplicates
    candidates = removeNearDuplicates(candidates);

    // Step 6: AI Relevance Ranking
    const scoreMap = await rankCandidates(trimmedQuery, understanding, candidates);

    // Apply scores and sort
    candidates = candidates.map((c) => ({
      ...c,
      _score: scoreMap.get(c.id) ?? 0.5,
    })).sort((a: any, b: any) => (b._score as number) - (a._score as number));

    // Clean up internal field
    candidates = candidates.map(({ _score, ...rest }: any) => rest) as ImageResult[];

    // Step 7: Diversity selection — return top 12
    const maxResults = 12;
    const finalResults = ensureDiversity(candidates, maxResults);

    // Determine if there are more results
    const totalFromFirstQuery = searchResults[0]?.photos.length || 0;
    const hasMore = totalFromFirstQuery === perPage && pageNum < 5;

    return new Response(
      JSON.stringify({
        type: "image_search",
        query: trimmedQuery,
        results: finalResults,
        page: pageNum,
        hasMore,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[ai-image-search] error", e);
    return new Response(
      JSON.stringify({ error: "Image search failed. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
