# Implementation Plan

## 1. Settings UI — PDF Editor toggle
- Add a "PowerPoint-style PDF Editor" row in `SettingsPage.tsx` under the existing Sidebar Features section, wired to `useSidebarFeatures().features.pdfEditor` / `setFeature('pdfEditor', ...)`.
- Confirm `AppSidebar.tsx` already conditionally renders the PDF Editor link based on this flag (it does); no further change needed there.

## 2. Notes folders / subfolders sidebar tree (`/notes`)
- New `src/components/notes/NoteFolderTree.tsx`: recursive tree (uses existing `folders` table where `parent_id` enables nesting) with: create folder, create subfolder, rename, delete, drag-to-reparent (simple), and an "All notes / Unfiled" virtual root.
- Update `NotesPage.tsx` to a 2-column layout: left = `NoteFolderTree` (collapsible on mobile via Sheet), right = current notes grid filtered by `selectedFolderId`.
- Wire note creation/edit to assign `folder_id` of the active folder.

## 3. AI page — center the welcome state
- In `AiPage.tsx`, when there are no messages, vertically + horizontally center the "Welcome to Oltrid" block, suggestion chips (Create note, Search web, Flowchart, Summarize), and the "3 notes · 34 memories" stats line within the available space (flex column, `items-center justify-center`, max-w-2xl, `text-center`).

## 4. Drawing pad fixes
- `DrawingReviewDialog.tsx` and `NoteEditor.tsx` insert flow:
  - **Insert drawing** → embed the actual drawing PNG (data URL) into the note (currently inserts placeholder text in some cases).
  - **Drawing + text** → embed the PNG followed by the OCR text block.
  - Add a visible **close (X)** icon in the dialog header.
  - Make the dialog responsive: full-screen on mobile (`w-full h-full` < md), resizable on desktop, content scrollable, buttons wrap.
- Ensure drawing strokes are rasterized to PNG before insertion (not lost on close).

## 5. Image generation — switch from OpenRouter to Gemini (two keys, round-robin)
- Add two secrets `GEMINI_API_KEY_1` and `GEMINI_API_KEY_2` (request via add_secret).
- Rewrite `supabase/functions/ai-image/index.ts` to call Google Generative Language API (`gemini-2.5-flash-image-preview` / `imagen` endpoint) using `generateContent`, alternating between the two keys per request (simple counter in module scope + fallback on 429/5xx to the other key).
- Keep request/response shape the same (`{prompt, imageBase64?}` → `{imageUrl}`) so `ImageStudio.tsx` is unchanged.
- Remove `OPENROUTER_API_KEY` usage from this function (leave secret in place; not deleted).

## 6. Full responsiveness pass
- `AiPage.tsx`: chat bar, mode/style selectors, suggestion chips → wrap on small screens, sticky bottom retains safe-area padding.
- `NotesPage.tsx`: folder tree collapses into a Sheet on `<md`; note grid uses `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
- `ImageStudio.tsx`: stack panels vertically on `<md` (single column), make dialog `w-[95vw] h-[90vh]`.
- `DrawingPad` + `DrawingReviewDialog`: canvas uses `w-full` with aspect ratio, toolbars wrap.
- `SettingsPage.tsx`: feature toggle list stacks cleanly on mobile.
- `PdfEditorPage.tsx`: thumbnail rail collapses to a horizontal strip on `<md`.

## Technical notes
- Gemini image endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=KEY` with `contents:[{parts:[{text}, {inline_data:{mime_type,data}}?]}]`, response → `candidates[0].content.parts[].inline_data.data` (base64) → return as `data:image/png;base64,...`.
- Round-robin: `let idx = 0; const keys = [k1,k2].filter(Boolean); const key = keys[idx++ % keys.length];` retry once with the other key on failure.
- No DB migrations needed (folders table already supports `parent_id`).

## Files to change/create
- create: `src/components/notes/NoteFolderTree.tsx`
- edit: `src/pages/SettingsPage.tsx`, `src/pages/NotesPage.tsx`, `src/pages/AiPage.tsx`, `src/components/notes/DrawingReviewDialog.tsx`, `src/components/notes/DrawingPad.tsx`, `src/components/notes/NoteEditor.tsx`, `src/components/ai/ImageStudio.tsx`, `src/pages/PdfEditorPage.tsx`, `supabase/functions/ai-image/index.ts`
- secrets: add `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`
