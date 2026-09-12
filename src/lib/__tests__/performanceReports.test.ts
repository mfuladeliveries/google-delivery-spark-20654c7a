import { describe, expect, it } from "vitest";
import { summarizeDriver, summarizeOrders } from "@/lib/performanceReports";

describe("performance reports", () => {
  const orders = [
    { id:"1", total:150, subtotal:100, status:"delivered", created_at:"2026-09-12T10:00:00Z", delivered_at:"2026-09-12T10:40:00Z" },
    { id:"2", total:200, subtotal:160, status:"cancelled", created_at:"2026-09-12T11:00:00Z" },
  ];
  it("summarizes restaurant performance", () => {
    const s=summarizeOrders(orders);
    expect(s.totalOrders).toBe(2); expect(s.delivered).toBe(1); expect(s.revenue).toBe(100); expect(s.completionRate).toBe(50); expect(s.avgDeliveryMinutes).toBe(40);
  });
  it("adds driver earnings", () => { expect(summarizeDriver(orders,[50,50]).earnings).toBe(100); });
});
