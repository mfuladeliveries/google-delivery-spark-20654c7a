import { describe, it, expect, beforeEach } from "vitest";
import { stashReorder, popReorder, REORDER_HANDOFF_KEY } from "@/lib/reorder";

describe("reorder handoff", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips items for the same restaurant", () => {
    stashReorder({ restaurantId: "r1", items: [{ id: "m1", quantity: 2 }] });
    expect(popReorder("r1")).toEqual([{ id: "m1", quantity: 2 }]);
  });

  it("returns null when nothing was stashed", () => {
    expect(popReorder("r1")).toBeNull();
  });

  it("returns null for a different restaurant", () => {
    stashReorder({ restaurantId: "r1", items: [{ id: "m1", quantity: 1 }] });
    expect(popReorder("r2")).toBeNull();
  });

  it("is single-use — a second pop returns null", () => {
    stashReorder({ restaurantId: "r1", items: [{ id: "m1", quantity: 1 }] });
    expect(popReorder("r1")).not.toBeNull();
    expect(popReorder("r1")).toBeNull();
  });

  it("clears the handoff even when the restaurant does not match", () => {
    stashReorder({ restaurantId: "r1", items: [{ id: "m1", quantity: 1 }] });
    popReorder("r2");
    expect(localStorage.getItem(REORDER_HANDOFF_KEY)).toBeNull();
  });

  it("expires handoffs older than the TTL", () => {
    const stale = {
      restaurantId: "r1",
      items: [{ id: "m1", quantity: 1 }],
      ts: Date.now() - 6 * 60 * 1000,
    };
    localStorage.setItem(REORDER_HANDOFF_KEY, JSON.stringify(stale));
    expect(popReorder("r1")).toBeNull();
  });

  it("returns null for corrupt JSON instead of throwing", () => {
    localStorage.setItem(REORDER_HANDOFF_KEY, "{not json");
    expect(popReorder("r1")).toBeNull();
  });

  it("returns null when items is not an array", () => {
    localStorage.setItem(
      REORDER_HANDOFF_KEY,
      JSON.stringify({ restaurantId: "r1", items: "nope", ts: Date.now() }),
    );
    expect(popReorder("r1")).toBeNull();
  });

  it("supports an empty item list", () => {
    stashReorder({ restaurantId: "r1", items: [] });
    expect(popReorder("r1")).toEqual([]);
  });
});
