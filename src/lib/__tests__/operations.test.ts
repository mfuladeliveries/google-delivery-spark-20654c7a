import { describe, expect, it } from "vitest";
import { estimatedRemainingMinutes, sortDriverOrders, summarizeOperations } from "../operations";

describe("operations helpers", () => {
  it("prioritises deliveries already heading to customers", () => {
    const orders = sortDriverOrders([
      { status: "driver_assigned", created_at: "2026-09-12T08:00:00Z", id: 1 },
      { status: "out_for_delivery", created_at: "2026-09-12T08:10:00Z", id: 2 },
    ]);
    expect(orders[0].id).toBe(2);
  });

  it("adds an ETA penalty when a driver has multiple active jobs", () => {
    expect(estimatedRemainingMinutes("out_for_delivery", 3)).toBe(28);
  });

  it("flags stuck and no-driver orders", () => {
    const now = new Date("2026-09-12T10:00:00Z").getTime();
    const result = summarizeOperations([
      { status: "ready", created_at: "2026-09-12T08:00:00Z", driver_id: null, payment_status: "paid" },
      { status: "out_for_delivery", created_at: "2026-09-12T09:50:00Z", driver_id: "d1", payment_status: "paid" },
    ], now);
    expect(result.stuck).toBe(1);
    expect(result.noDriver).toBe(1);
    expect(result.active).toBe(2);
  });
});
