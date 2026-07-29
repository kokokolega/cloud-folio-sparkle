// Deterministic rule engine for Smart Capture. No LLMs involved.

export interface CategoryRule {
  category: string;
  subfolder: string;
  keywords: string[];
  strong?: string[]; // high-weight keywords
}

export const CATEGORY_RULES: CategoryRule[] = [
  {
    category: "Development",
    subfolder: "React",
    strong: ["usestate", "useeffect", "jsx", "react"],
    keywords: ["component", "hooks", "props", "render", "tsx", "vite", "npm", "typescript", "state"],
  },
  {
    category: "Development",
    subfolder: "Web",
    strong: ["javascript", "html", "css"],
    keywords: ["function", "const", "async", "await", "api", "endpoint", "json", "http", "class", "import"],
  },
  {
    category: "Development",
    subfolder: "Databases",
    strong: ["sql", "postgres", "mongodb"],
    keywords: ["select", "insert", "join", "query", "index", "schema", "table", "primary key"],
  },
  {
    category: "Mathematics",
    subfolder: "Calculus",
    strong: ["integration", "differentiation", "derivative", "integral"],
    keywords: ["limits", "continuity", "function", "theorem", "dx", "dy", "maxima", "minima"],
  },
  {
    category: "Mathematics",
    subfolder: "Algebra",
    strong: ["matrix", "determinant", "polynomial"],
    keywords: ["equation", "vector", "linear", "eigen", "quadratic", "roots"],
  },
  {
    category: "Finance",
    subfolder: "Receipts",
    strong: ["invoice", "gst", "receipt", "tax invoice"],
    keywords: ["amount", "total", "subtotal", "payment", "paid", "bill", "qty", "price", "due", "order id"],
  },
  {
    category: "Finance",
    subfolder: "Bank",
    strong: ["statement", "ifsc", "account number"],
    keywords: ["balance", "credit", "debit", "transaction", "upi", "neft", "bank"],
  },
  {
    category: "Personal",
    subfolder: "Identity Documents",
    strong: ["passport", "aadhaar", "aadhar", "driving licence", "driving license", "pan card"],
    keywords: ["date of birth", "nationality", "issued", "expiry", "government", "identity", "father"],
  },
  {
    category: "Personal",
    subfolder: "Certificates",
    strong: ["certificate", "certification"],
    keywords: ["awarded", "completion", "hereby", "achievement", "course", "issued to"],
  },
  {
    category: "College",
    subfolder: "Operating Systems",
    strong: ["operating system", "deadlock", "semaphore"],
    keywords: ["scheduling", "process", "thread", "paging", "kernel", "mutex", "cpu", "memory management"],
  },
  {
    category: "College",
    subfolder: "Data Structures",
    strong: ["binary tree", "linked list", "data structure"],
    keywords: ["stack", "queue", "graph", "traversal", "complexity", "sorting", "algorithm", "heap"],
  },
  {
    category: "College",
    subfolder: "Physics",
    strong: ["physics", "newton", "thermodynamics"],
    keywords: ["velocity", "acceleration", "force", "energy", "momentum", "chapter", "wave", "electric"],
  },
  {
    category: "College",
    subfolder: "Chemistry",
    strong: ["chemistry", "periodic table"],
    keywords: ["reaction", "molecule", "compound", "acid", "base", "bond", "atomic", "valency"],
  },
  {
    category: "Work",
    subfolder: "Meetings",
    strong: ["meeting notes", "agenda", "standup"],
    keywords: ["action items", "attendees", "minutes", "follow up", "discussion", "whiteboard", "sprint"],
  },
  {
    category: "Work",
    subfolder: "Diagrams",
    strong: ["flowchart", "architecture"],
    keywords: ["diagram", "workflow", "process", "start", "end", "decision", "flow"],
  },
];

export interface UserRule {
  keyword: string;
  category: string;
  subfolder: string | null;
  weight: number;
}

export interface Classification {
  category: string;
  subfolder: string;
  confidence: number;
  matched: string[];
}

const normalize = (t: string) => t.toLowerCase().replace(/\s+/g, " ");

export function classify(text: string, userRules: UserRule[] = []): Classification {
  const hay = normalize(text);
  if (!hay.trim()) {
    return { category: "Uncategorized", subfolder: "Needs Review", confidence: 0, matched: [] };
  }

  const scores = new Map<string, { score: number; matched: string[]; rule: CategoryRule }>();

  for (const rule of CATEGORY_RULES) {
    let score = 0;
    const matched: string[] = [];
    for (const k of rule.strong ?? []) {
      if (hay.includes(k)) {
        score += 6;
        matched.push(k);
      }
    }
    for (const k of rule.keywords) {
      if (hay.includes(k)) {
        score += 2;
        matched.push(k);
      }
    }
    if (score > 0) {
      scores.set(`${rule.category}/${rule.subfolder}`, { score, matched, rule });
    }
  }

  // Learned preferences from manual corrections outweigh built-ins.
  for (const ur of userRules) {
    if (!ur.keyword) continue;
    if (hay.includes(ur.keyword.toLowerCase())) {
      const key = `${ur.category}/${ur.subfolder ?? "General"}`;
      const existing = scores.get(key);
      const bump = 5 * Math.max(1, ur.weight);
      if (existing) {
        existing.score += bump;
        existing.matched.push(ur.keyword);
      } else {
        scores.set(key, {
          score: bump,
          matched: [ur.keyword],
          rule: { category: ur.category, subfolder: ur.subfolder ?? "General", keywords: [] },
        });
      }
    }
  }

  if (scores.size === 0) {
    return { category: "Uncategorized", subfolder: "Needs Review", confidence: 20, matched: [] };
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1].score - a[1].score);
  const [, best] = ranked[0];
  const runnerUp = ranked[1]?.[1].score ?? 0;
  const total = ranked.reduce((s, [, v]) => s + v.score, 0);

  // Confidence: share of total score, boosted by margin over runner-up.
  const share = best.score / total;
  const margin = best.score === 0 ? 0 : (best.score - runnerUp) / best.score;
  let confidence = Math.round((share * 0.6 + margin * 0.4) * 100);
  confidence = Math.max(25, Math.min(98, confidence + Math.min(best.score, 12)));

  const needsReview = confidence < 55;
  return {
    category: needsReview ? best.rule.category : best.rule.category,
    subfolder: needsReview ? "Needs Review" : best.rule.subfolder,
    confidence,
    matched: [...new Set(best.matched)],
  };
}

export interface Entities {
  dates: string[];
  urls: string[];
  emails: string[];
  phones: string[];
  numbers: string[];
  headings: string[];
  bullets: string[];
}

export function extractEntities(text: string): Entities {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const uniq = (a: string[]) => [...new Set(a)].slice(0, 25);
  return {
    dates: uniq(text.match(/\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}-\d{2}-\d{2}|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s*\d{0,4})\b/gi) ?? []),
    urls: uniq(text.match(/\bhttps?:\/\/[^\s)]+|\bwww\.[^\s)]+/gi) ?? []),
    emails: uniq(text.match(/\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/g) ?? []),
    phones: uniq(text.match(/(?:\+\d{1,3}[\s-]?)?\b\d{5}[\s-]?\d{5}\b|\b\d{3}[\s-]\d{3}[\s-]\d{4}\b/g) ?? []),
    numbers: uniq(text.match(/\b\d+(?:[.,]\d+)?\b/g) ?? []),
    headings: uniq(lines.filter((l) => l.length > 3 && l.length < 60 && (l === l.toUpperCase() || /^(chapter|unit|module|lesson|part)\b/i.test(l)))),
    bullets: uniq(lines.filter((l) => /^([-*•●▪]|\d+[.)])\s+/.test(l)).map((l) => l.replace(/^([-*•●▪]|\d+[.)])\s+/, ""))),
  };
}

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "this", "that", "from", "your", "have", "will", "are", "was", "not", "you",
  "all", "can", "has", "but", "our", "out", "use", "any", "how", "its", "one", "two", "get", "new", "may",
  "into", "when", "then", "than", "they", "their", "them", "there", "which", "while", "also", "such", "each",
]);

export function generateTags(text: string, classification: Classification): string[] {
  const words = normalize(text).replace(/[^a-z0-9\s#]/g, " ").split(/\s+/);
  const freq = new Map<string, number>();
  for (const w of words) {
    if (w.length < 3 || w.length > 18 || STOP_WORDS.has(w) || /^\d+$/.test(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
  const base = [
    classification.category.toLowerCase().replace(/\s+/g, "-"),
    classification.subfolder.toLowerCase().replace(/\s+/g, "-"),
    ...classification.matched.map((m) => m.replace(/\s+/g, "-")),
  ];
  return [...new Set([...base, ...top])].filter(Boolean).slice(0, 12);
}

const TITLE_CASE = (s: string) =>
  s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toUpperCase()))
    .join(" ");

export function generateTitle(text: string, classification: Classification, entities: Entities): string {
  const clean = (s: string) => s.replace(/[^\w\s\-&.,]/g, " ").replace(/\s+/g, " ").trim();

  // Chapter / unit style
  const chapter = text.match(/\b(chapter|unit|module|lesson|part)\s+(\d+|[ivx]+)\b/i);
  if (chapter) {
    const topic = classification.subfolder !== "Needs Review" ? classification.subfolder : classification.category;
    return `${topic} - ${TITLE_CASE(chapter[0])}`;
  }

  // Invoice / receipt style
  if (/\b(invoice|receipt|bill)\b/i.test(text)) {
    const vendor = text
      .split("\n")
      .map(clean)
      .find((l) => l.length > 2 && l.length < 40 && /[a-z]/i.test(l) && !/invoice|receipt|bill|gst|tax/i.test(l));
    const date = entities.dates[0];
    return clean(`${vendor ? TITLE_CASE(vendor) + " " : ""}Invoice${date ? " " + date : ""}`).slice(0, 70);
  }

  // Identity documents
  const idMatch = text.match(/\b(passport|aadhaar|aadhar|driving licence|driving license|pan card)\b/i);
  if (idMatch) return `${TITLE_CASE(idMatch[0])} Document`;

  // First strong heading
  const heading = entities.headings[0] ?? text.split("\n").map(clean).find((l) => l.length > 6 && l.length < 60);
  if (heading) {
    const t = TITLE_CASE(clean(heading));
    if (t.length > 3) return t.slice(0, 70);
  }

  const topic = classification.subfolder !== "Needs Review" ? classification.subfolder : classification.category;
  return `${topic} Capture`;
}

export function safeFileName(title: string, ext: string) {
  const base = title.replace(/[^\w\s-]/g, "").replace(/\s+/g, " ").trim().slice(0, 60) || "Capture";
  return `${base}.${ext}`;
}

/** Simple token overlap similarity, 0..1 */
export function textSimilarity(a: string, b: string): number {
  const tok = (s: string) =>
    new Set(
      normalize(s)
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    );
  const A = tok(a);
  const B = tok(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((w) => { if (B.has(w)) inter++; });
  return inter / Math.min(A.size, B.size);
}
