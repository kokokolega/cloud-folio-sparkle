import { ReactElement } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";

export const MOBILE = { width: 390, height: 844 };
export const DESKTOP = { width: 1440, height: 900 };

/** Emulate a device viewport (jsdom does not resize on its own). */
export function setViewport({ width, height }: { width: number; height: number }) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: height });
  window.dispatchEvent(new Event("resize"));
}

/** Minimal chainable Supabase mock: every builder method returns itself and awaits to `result`. */
export function makeSupabaseMock(overrides: Record<string, unknown> = {}) {
  const rpc = vi.fn(async () => ({ data: [{ id: "grp-1", name: "Design Team" }], error: null }));

  const builder = (result: { data: unknown; error: unknown }) => {
    const chain: any = {};
    const methods = [
      "select", "insert", "update", "delete", "upsert", "eq", "in", "is", "neq",
      "order", "limit", "range", "single", "maybeSingle", "filter", "match", "or",
    ];
    for (const m of methods) chain[m] = vi.fn(() => chain);
    chain.single = vi.fn(async () => result);
    chain.maybeSingle = vi.fn(async () => result);
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
    return chain;
  };

  return {
    rpc,
    from: vi.fn(() => builder({ data: [], error: null })),
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })),
    removeChannel: vi.fn(),
    storage: { from: vi.fn(() => ({ upload: vi.fn(), getPublicUrl: () => ({ data: { publicUrl: "" } }) })) },
    auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
    functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
    ...overrides,
  };
}

export function renderApp(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Pointer gesture helpers that work for both mouse (desktop) and touch (mobile). */
export function pointer(el: Element, type: string, x: number, y: number, pointerType: "mouse" | "touch") {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperty(ev, "pointerId", { value: 1 });
  Object.defineProperty(ev, "pointerType", { value: pointerType });
  Object.defineProperty(ev, "isPrimary", { value: true });
  el.dispatchEvent(ev);
}
