import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

const mock = vi.hoisted(() => ({ locked: false, queriedWhileLocked: false }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "customer" } } } }),
      onAuthStateChange: (callback: (event: string, session: unknown) => unknown) => {
        mock.locked = true;
        const result = callback("SIGNED_IN", { user: { id: "customer" } });
        if (result instanceof Promise) result.finally(() => { mock.locked = false; });
        else mock.locked = false;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
    from: () => {
      if (mock.locked) mock.queriedWhileLocked = true;
      return { select: () => ({ eq: async () => ({ data: [{ role: "customer" }] }) }) };
    },
  },
}));

function State() {
  const { role, loading } = useAuth();
  return <span>{loading ? "waiting" : role}</span>;
}

describe("signed-in session loading", () => {
  beforeEach(() => { mock.locked = false; mock.queriedWhileLocked = false; });
  it("loads customer roles without querying under the auth callback lock", async () => {
    await act(async () => { render(<AuthProvider><State /></AuthProvider>); });
    await waitFor(() => expect(screen.getByText("customer")).toBeInTheDocument());
    expect(mock.queriedWhileLocked).toBe(false);
  });
});