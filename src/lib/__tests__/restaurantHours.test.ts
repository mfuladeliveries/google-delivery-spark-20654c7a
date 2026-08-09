import { describe, it, expect } from "vitest";
import { isRestaurantOpen, formatOpensAt } from "@/lib/restaurantHours";

const at = (h: number, m = 0) => new Date(2026, 0, 15, h, m, 0);

describe("isRestaurantOpen", () => {
  it("is open inside normal hours", () => {
    expect(isRestaurantOpen("09:00:00", "17:00:00", at(12))).toBe(true);
  });

  it("is closed before opening and after closing", () => {
    expect(isRestaurantOpen("09:00:00", "17:00:00", at(8, 59))).toBe(false);
    expect(isRestaurantOpen("09:00:00", "17:00:00", at(17, 1))).toBe(false);
  });

  it("is open exactly at opening time", () => {
    expect(isRestaurantOpen("09:00:00", "17:00:00", at(9))).toBe(true);
  });

  it("is closed exactly at closing time", () => {
    expect(isRestaurantOpen("09:00:00", "17:00:00", at(17))).toBe(false);
  });

  it("supports overnight hours crossing midnight", () => {
    expect(isRestaurantOpen("18:00:00", "02:00:00", at(23))).toBe(true);
    expect(isRestaurantOpen("18:00:00", "02:00:00", at(1))).toBe(true);
    expect(isRestaurantOpen("18:00:00", "02:00:00", at(2))).toBe(false);
    expect(isRestaurantOpen("18:00:00", "02:00:00", at(12))).toBe(false);
  });

  it("assumes always open when hours are missing", () => {
    expect(isRestaurantOpen(null, null, at(3))).toBe(true);
    expect(isRestaurantOpen(undefined, "17:00:00", at(3))).toBe(true);
    expect(isRestaurantOpen("09:00:00", undefined, at(3))).toBe(true);
  });

  it("assumes always open for unparseable times", () => {
    expect(isRestaurantOpen("abc", "def", at(3))).toBe(true);
  });

  it("accepts HH:MM without seconds", () => {
    expect(isRestaurantOpen("09:00", "17:00", at(10))).toBe(true);
  });
});

describe("formatOpensAt", () => {
  it("formats morning times", () => {
    expect(formatOpensAt("09:30:00")).toBe("9:30 AM");
  });

  it("formats afternoon times", () => {
    expect(formatOpensAt("17:05:00")).toBe("5:05 PM");
  });

  it("formats midnight and noon", () => {
    expect(formatOpensAt("00:00:00")).toBe("12:00 AM");
    expect(formatOpensAt("12:00:00")).toBe("12:00 PM");
  });

  it("returns empty string for null/undefined", () => {
    expect(formatOpensAt(null)).toBe("");
    expect(formatOpensAt(undefined)).toBe("");
    expect(formatOpensAt("")).toBe("");
  });
});
