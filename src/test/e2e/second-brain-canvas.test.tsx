import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderApp, setViewport, pointer, MOBILE, DESKTOP } from "./harness";
import { defaultState, makeDesktop, makeObject } from "@/lib/secondBrain";

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("./supabaseMock")).supabaseMock,
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, session: {}, signOut: vi.fn(), loading: false }),
  AuthProvider: ({ children }: any) => children,
}));
vi.mock("@/components/layout/DashboardLayout", () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="layout">{children}</div>,
}));

import SecondBrainPage from "@/pages/SecondBrainPage";

const KEY = "oltrid-second-brain";

function seed() {
  const d = makeDesktop("Test");
  d.grid = false; // avoid grid snapping so exact deltas are assertable
  d.objects = [
    makeObject({ kind: "sticky", title: "Draggable Card", preview: "hello", x: 100, y: 100, w: 220, h: 150 }),
  ];
  const state = { ...defaultState(), desktops: [d], activeId: d.id, updatedAt: Date.now() };
  localStorage.setItem(KEY, JSON.stringify(state));
  return d.objects[0];
}

function cardEl() {
  return screen.getByText("Draggable Card").closest("div.absolute") as HTMLElement;
}

function persisted() {
  const raw = JSON.parse(localStorage.getItem(KEY)!);
  return raw.desktops[0].objects[0];
}

describe.each([
  ["desktop", DESKTOP, "mouse" as const],
  ["mobile", MOBILE, "touch" as const],
])("Second Brain Desktop — %s", (_label, viewport, pointerType) => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    setViewport(viewport);
  });

  it("drags an object to a new position", async () => {
    seed();
    renderApp(<SecondBrainPage />);

    const card = await waitFor(() => cardEl());
    const stage = card.parentElement!.closest("div[style]") as HTMLElement;

    pointer(card, "pointerdown", 200, 200, pointerType);
    pointer(stage, "pointermove", 320, 260, pointerType);
    pointer(stage, "pointerup", 320, 260, pointerType);

    await waitFor(() => {
      const o = persisted();
      expect(o.x).toBe(220);
      expect(o.y).toBe(160);
    });
  });

  it("resizes a selected object and clamps to the minimum size", async () => {
    seed();
    renderApp(<SecondBrainPage />);

    const card = await waitFor(() => cardEl());
    const stage = card.parentElement!.closest("div[style]") as HTMLElement;

    // Selecting happens on pointer down; release without moving.
    pointer(card, "pointerdown", 150, 150, pointerType);
    pointer(stage, "pointerup", 150, 150, pointerType);

    const handle = await waitFor(() => {
      const h = card.querySelector(".cursor-se-resize");
      if (!h) throw new Error("resize handle not visible after selection");
      return h as HTMLElement;
    });

    pointer(handle, "pointerdown", 150, 150, pointerType);
    pointer(stage, "pointermove", 250, 230, pointerType);
    pointer(stage, "pointerup", 250, 230, pointerType);

    await waitFor(() => {
      const o = persisted();
      expect(o.w).toBe(320);
      expect(o.h).toBe(230);
    });

    // Shrink far past the floor — must clamp, never invert.
    pointer(handle, "pointerdown", 250, 230, pointerType);
    pointer(stage, "pointermove", -900, -900, pointerType);
    pointer(stage, "pointerup", -900, -900, pointerType);

    await waitFor(() => {
      const o = persisted();
      expect(o.w).toBe(120);
      expect(o.h).toBe(90);
    });
  });

  it("keeps the touch-action lock so canvas gestures do not scroll the page", async () => {
    seed();
    renderApp(<SecondBrainPage />);
    await waitFor(() => cardEl());
    const stage = document.querySelector('div[style*="touch-action"]') as HTMLElement | null;
    expect(stage?.style.touchAction).toBe("none");
  });
});
