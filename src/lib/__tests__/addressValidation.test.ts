import { describe, it, expect } from "vitest";
import {
  addressHouseNumberError,
  leadingHouseNumber,
  mergeHouseNumber,
  ADDRESS_REQUIRED_MESSAGE,
  ADDRESS_HOUSE_NUMBER_MESSAGE,
} from "@/lib/addressValidation";

describe("addressHouseNumberError", () => {
  it("requires an address", () => {
    expect(addressHouseNumberError("")).toBe(ADDRESS_REQUIRED_MESSAGE);
    expect(addressHouseNumberError("   ")).toBe(ADDRESS_REQUIRED_MESSAGE);
    expect(addressHouseNumberError(null)).toBe(ADDRESS_REQUIRED_MESSAGE);
    expect(addressHouseNumberError(undefined)).toBe(ADDRESS_REQUIRED_MESSAGE);
  });

  it("accepts addresses that start with a house/unit number", () => {
    expect(addressHouseNumberError("12A Oak Street, Mfuleni")).toBeNull();
    expect(addressHouseNumberError("Unit 3 Oak Street, Mfuleni")).toBeNull();
    expect(addressHouseNumberError("B-4 is not leading digits")).toBe(ADDRESS_HOUSE_NUMBER_MESSAGE);
    expect(addressHouseNumberError("#7 Flat, Delft")).toBeNull();
  });

  it("rejects addresses without a leading house number", () => {
    expect(addressHouseNumberError("Oak Street, Mfuleni")).toBe(ADDRESS_HOUSE_NUMBER_MESSAGE);
    expect(addressHouseNumberError("Mfuleni")).toBe(ADDRESS_HOUSE_NUMBER_MESSAGE);
  });
});

describe("leadingHouseNumber", () => {
  it("extracts the leading number token", () => {
    expect(leadingHouseNumber("12A Oak Street")).toBe("12A");
    expect(leadingHouseNumber("Unit 3 Oak Street")).toBe("Unit 3");
    expect(leadingHouseNumber("Oak Street")).toBeNull();
  });
});

describe("mergeHouseNumber", () => {
  it("prepends the typed house number to a suggestion without one", () => {
    expect(mergeHouseNumber("12A Oak", "Oak Street, Mfuleni")).toBe("12A Oak Street, Mfuleni");
  });

  it("keeps the suggestion when it already starts with a number", () => {
    expect(mergeHouseNumber("12A Oak", "5 Oak Street, Mfuleni")).toBe("5 Oak Street, Mfuleni");
  });

  it("returns the suggestion unchanged when nothing was typed", () => {
    expect(mergeHouseNumber("", "Oak Street, Mfuleni")).toBe("Oak Street, Mfuleni");
  });
});
