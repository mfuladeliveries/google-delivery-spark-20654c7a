import { describe, expect, it } from "vitest";
import { dailyCreditTotal, sumCreditUsage, usageInRange, type DailyCreditUsage } from "../creditUsage";

const row: DailyCreditUsage = {
  recorded_date: "2026-10-20", backend_credits: 1.858060800, function_credits: 0.049990000,
  storage_credits: 0.000043808, traffic_credits: 0.014254134, is_partial_day: false,
  result_partial: false, recorded_to_exclusive: "2026-10-21T00:00:00Z", retrieved_at: "2026-10-21T23:04:19Z",
};
describe("daily running credit snapshots", () => {
  it("totals backend, functions, storage and traffic without build credits", () => {
    expect(dailyCreditTotal({ ...row, build_credits: 14 } as DailyCreditUsage)).toBeCloseTo(1.922348742, 9);
  });
  it("keeps the four requested categories separate", () => {
    expect(sumCreditUsage([row])).toEqual({ backend_credits: 1.8580608, function_credits: 0.04999,
      storage_credits: 0.000043808, traffic_credits: 0.014254134 });
  });
  it("filters by UTC recording date, includes both boundaries and preserves partial days", () => {
    const partial = { ...row, recorded_date: "2026-10-21", is_partial_day: true };
    expect(usageInRange([partial, row], "2026-10-20", "2026-10-21")).toEqual([row, partial]);
    expect(usageInRange([row, partial], "2026-10-21", "2026-10-21")).toEqual([partial]);
  });
});