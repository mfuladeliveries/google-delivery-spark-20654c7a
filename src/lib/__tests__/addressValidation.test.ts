import { describe, it, expect } from "vitest";
import {
  houseUnitValidationError,
  HOUSE_UNIT_REQUIRED_MESSAGE,
  HOUSE_UNIT_FORMAT_MESSAGE,
} from "@/lib/addressValidation";

describe("houseUnitValidationError", () => {
  it("requires a house/unit number (not optional)", () => {
    expect(houseUnitValidationError("")).toBe(HOUSE_UNIT_REQUIRED_MESSAGE);
    expect(houseUnitValidationError("   ")).toBe(HOUSE_UNIT_REQUIRED_MESSAGE);
    expect(houseUnitValidationError(null)).toBe(HOUSE_UNIT_REQUIRED_MESSAGE);
    expect(houseUnitValidationError(undefined)).toBe(HOUSE_UNIT_REQUIRED_MESSAGE);
  });

  it("accepts normal SA house/unit numbers", () => {
    expect(houseUnitValidationError("12A")).toBeNull();
    expect(houseUnitValidationError("Unit 3")).toBeNull();
    expect(houseUnitValidationError("B-4")).toBeNull();
    expect(houseUnitValidationError("#7 Flat")).toBeNull();
  });

  it("rejects invalid characters", () => {
    expect(houseUnitValidationError("12, Oak Street")).toBe(HOUSE_UNIT_FORMAT_MESSAGE);
    expect(houseUnitValidationError("Unit <3>")).toBe(HOUSE_UNIT_FORMAT_MESSAGE);
  });
});
