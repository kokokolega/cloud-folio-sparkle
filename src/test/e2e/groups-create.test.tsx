import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderApp, makeSupabaseMock, setViewport, MOBILE, DESKTOP } from "./harness";

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("./supabaseMock")).supabaseMock,
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "a@b.co" }, session: {}, signOut: vi.fn(), loading: false }),
  AuthProvider: ({ children }: any) => children,
}));
vi.mock("@/components/layout/DashboardLayout", () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="layout">{children}</div>,
}));
vi.mock("@/components/groups/GroupDetail", () => ({
  GroupDetail: ({ groupId }: any) => <div data-testid="group-detail">{groupId}</div>,
}));

import GroupsPage from "@/pages/GroupsPage";

describe("Groups — create flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.rpc.mockResolvedValue({ data: [{ id: "grp-1", name: "Design Team" }], error: null });
  });

  it.each([
    ["desktop", DESKTOP],
    ["mobile", MOBILE],
  ])("creates a group through the create_group RPC on %s", async (_label, viewport) => {
    setViewport(viewport);
    renderApp(<GroupsPage />);

    fireEvent.click((await screen.findAllByRole("button", { name: /new|create group/i }))[0]);

    const nameInput = await screen.findByPlaceholderText(/group name/i);
    fireEvent.change(nameInput, { target: { value: "Design Team" } });
    fireEvent.change(screen.getByPlaceholderText(/description/i), { target: { value: "Product crew" } });

    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(supabaseMock.rpc).toHaveBeenCalledWith("create_group", {
        _name: "Design Team",
        _description: "Product crew",
      });
    });

    // Successful creation must open the new group, not stay on the empty list.
    expect(await screen.findByTestId("group-detail")).toHaveTextContent("grp-1");
  });

  it("surfaces a failure instead of silently closing the dialog", async () => {
    setViewport(DESKTOP);
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: "permission denied" } });
    renderApp(<GroupsPage />);

    fireEvent.click((await screen.findAllByRole("button", { name: /new|create group/i }))[0]);
    fireEvent.change(await screen.findByPlaceholderText(/group name/i), { target: { value: "Nope" } });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => expect(supabaseMock.rpc).toHaveBeenCalled());
    expect(screen.queryByTestId("group-detail")).toBeNull();
    expect(screen.getByPlaceholderText(/group name/i)).toBeInTheDocument();
  });
});
