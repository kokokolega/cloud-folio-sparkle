# Implementation Plan

## 1. Drawing OCR — Review & Edit Step
- After `notes-drawing-to-text` returns HTML, instead of immediately inserting, open a new `DrawingReviewDialog`:
  - Resizable dialog (CSS `resize: both`, min/max bounds; remembers last size in localStorage).
  - Left pane: thumbnail of the saved drawing (PNG data URL).
  - Right pane: editable TipTap-style textarea/contenteditable for the OCR HTML.
  - Buttons: "Save drawing as image to note", "Insert text at cursor", "Insert both", "Cancel".
- `DrawingPad` exposes the drawing PNG; on convert, pass `{ imageDataUrl, html }` upstream.
- `NoteEditor` receives an `insertAtCursor(html)` API so the converted text lands at the caret position (not appended).
- Saving the drawing: upload PNG to `user-files` bucket and embed `<img>` in the note (or keep inline base64 if user prefers — toggle in dialog).

## 2. Notes — Folders & Subfolders
- Reuse existing `folders` table (already has `parent_id`). Add a notes-scoped folder tree:
  - New `NoteFolderTree` sidebar component on `/notes` (collapsible tree, create/rename/delete, drag-to-nest later).
  - `notes.folder_id` already exists — wire filter: clicking a folder shows only its notes; "All", "Unfiled", "Pinned" virtual views.
  - "New folder" / "New subfolder" actions via context menu + "+" buttons.
  - Move note to folder via dropdown on `NoteCard`.
- No schema migration needed.

## 3. PDF Editor (PowerPoint-like)
- New route `/pdf-editor` + sidebar entry (gated by existing `useSidebarFeatures` toggle, add `pdfEditor` key).
- Built with `pdf-lib` (load/save) + `pdfjs-dist` (render pages to canvas) + `react-rnd` for draggable/resizable overlays.
- Features:
  - Open PDF from device or from `files` table.
  - Page thumbnails sidebar; reorder, duplicate, delete, rotate pages.
  - Overlay layer per page with: text boxes (font/size/color), shapes (rect, ellipse, line, arrow), freehand ink, images, highlights, signatures.
  - Undo/redo stack, zoom, fit-to-width.
  - Export: flatten overlays into the PDF via `pdf-lib` `drawText`/`drawImage` and download, or save back to `user-files`.
- New deps: `pdf-lib`, `pdfjs-dist`, `react-rnd` (perfect-freehand already useful for ink — add if missing).

## 4. AI Image Generation (OpenRouter)
- **Security:** the OpenRouter key must NOT be hardcoded in client code. Will request the user via `add_secret` for `OPENROUTER_API_KEY` (the value they provided), then store as a Lovable Cloud secret.
- New edge function `ai-image` (verify_jwt validated in code):
  - `POST { mode: "generate" | "edit", prompt, imageBase64? }` → calls OpenRouter `google/gemini-2.5-flash-image-preview` (or similar) → returns base64 image.
- New `ImageStudio` panel inside `AiPage` (toggle via toolbar button "Image"):
  - Prompt input, optional reference image upload (drag/drop), generate button.
  - Result gallery with: download (PNG), edit (sends back as reference + new prompt), variations, save to `user-files`, insert into chat.
- Inline chat: `/image <prompt>` shortcut also triggers generation; result rendered in message bubble.

## 5. Chat Style Enhancements
Expand `RESPONSE_STYLES` in `AiPage` and inject richer instructions in `ai-assistant`:
- Add: Tutorial, Listicle, Q&A, Storytelling, Technical Spec, Casual DM, Executive Brief, Poetry, Bullet Snapshot, Step-by-Step Code Walkthrough.
- Each style gets a preview chip (icon + 1-line description) in a popover selector.
- Persist last-used style per conversation in `ai_conversations` (no schema change — store via local memory key).

## 6. AiPage Chrome Cleanup
- Remove the top "Oltrid AI" header block and any visible border/divider above the chat.
- Make the chat input bar **sticky to viewport bottom** (`sticky bottom-0` with backdrop blur), and ensure the messages list scrolls underneath with proper bottom padding so the last message is never hidden.
- Keep model/style selectors accessible via a compact floating toolbar above the input.

---

## Technical Notes
- New files: `src/components/notes/DrawingReviewDialog.tsx`, `src/components/notes/NoteFolderTree.tsx`, `src/pages/PdfEditorPage.tsx`, `src/components/pdf/*` (Canvas, OverlayLayer, Toolbar, Thumbnails), `src/components/ai/ImageStudio.tsx`, `supabase/functions/ai-image/index.ts`.
- Edited: `src/components/notes/DrawingPad.tsx`, `src/components/notes/NoteEditor.tsx`, `src/pages/NotesPage.tsx`, `src/pages/AiPage.tsx`, `src/components/layout/AppSidebar.tsx`, `src/hooks/useSidebarFeatures.tsx`, `src/App.tsx`, `supabase/functions/ai-assistant/index.ts`.
- Secret request: `OPENROUTER_API_KEY` (will be triggered before deploying `ai-image`).
- No DB migrations required.

Approve to implement everything in one pass.