import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderApp, setViewport, MOBILE, DESKTOP } from "./harness";

vi.mock("html-to-image", () => ({
  toPng: vi.fn(async () => "data:image/png;base64,"),
  toJpeg: vi.fn(async () => "data:image/jpeg;base64,"),
  toSvg: vi.fn(async () => "data:image/svg+xml,"),
}));

import { ShareCardsDialog } from "@/components/notes/ShareCardsDialog";

const note = {
  id: "note-1",
  title: "Second Brain Basics",
  content: "<h1>Second Brain Basics</h1><p>Capture everything.</p><h2>Organize</h2><p>Group by project.</p>",
};

/** Tailwind responsive contract: an element must carry a base + breakpoint variant. */
function hasResponsiveClasses(el: Element | null) {
  const cls = el?.className?.toString() ?? "";
  return /(^|\s)(sm|md|lg):/.test(cls);
}

describe("Show as Cards — responsiveness", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["mobile", MOBILE],
    ["desktop", DESKTOP],
  ])("renders the studio with card slides on %s", async (_label, viewport) => {
    setViewport(viewport);
    renderApp(<ShareCardsDialog open onOpenChange={() => {}} note={note} />);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();

    // Slides parsed from the note must be rendered on every viewport.
    await waitFor(() => {
      expect(screen.getAllByText(/Second Brain Basics/i).length).toBeGreaterThan(0);
    });

    // The dialog shell must adapt: no fixed-only sizing.
    expect(hasResponsiveClasses(dialog)).toBe(true);
  });

  it("keeps the preview from collapsing on a narrow viewport", async () => {
    setViewport(MOBILE);
    renderApp(<ShareCardsDialog open onOpenChange={() => {}} note={note} />);

    const dialog = await screen.findByRole("dialog");
    const cls = dialog.className;
    // Width must be viewport relative rather than a hard desktop pixel width.
    expect(/w-\[|max-w-|w-full/.test(cls)).toBe(true);
    expect(cls).not.toMatch(/\bw-\[1[0-9]{3}px\]/);
  });

  it("does not render when closed", () => {
    setViewport(DESKTOP);
    renderApp(<ShareCardsDialog open={false} onOpenChange={() => {}} note={note} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
