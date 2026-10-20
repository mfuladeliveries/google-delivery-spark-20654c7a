import { act } from "react";
import { createRoot } from "react-dom/client";
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
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => { root.render(<AuthProvider><State /></AuthProvider>); });
    await act(async () => { await new Promise(resolve => window.setTimeout(resolve, 10)); });
    expect(container.textContent).toBe("customer");
    expect(mock.queriedWhileLocked).toBe(false);
    await act(async () => root.unmount());
  });
});