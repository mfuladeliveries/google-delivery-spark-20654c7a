import { describe, it, expect } from "vitest";
import { generateDeliveryPin, hashDeliveryPin } from "@/lib/deliveryPin";

describe("generateDeliveryPin", () => {
  it("always returns exactly 6 digits in range", () => {
    for (let i = 0; i < 500; i++) {
      const pin = generateDeliveryPin();
      expect(pin).toMatch(/^\d{6}$/);
      const n = Number(pin);
      expect(n).toBeGreaterThanOrEqual(100000);
      expect(n).toBeLessThanOrEqual(999999);
    }
  });

  it("produces varying values", () => {
    const pins = new Set(Array.from({ length: 50 }, () => generateDeliveryPin()));
    expect(pins.size).toBeGreaterThan(1);
  });
});

describe("hashDeliveryPin", () => {
  it("is deterministic for the same PIN", async () => {
    const a = await hashDeliveryPin("123456");
    const b = await hashDeliveryPin("123456");
    expect(a).toBe(b);
  });

  it("returns a 64-char hex SHA-256 digest", async () => {
    const h = await hashDeliveryPin("123456");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    // Known SHA-256 of "123456"
    expect(h).toBe("8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92");
  });

  it("does not match a different PIN", async () => {
    expect(await hashDeliveryPin("123456")).not.toBe(await hashDeliveryPin("123457"));
  });

  it("hashes a freshly generated PIN consistently", async () => {
    const pin = generateDeliveryPin();
    expect(await hashDeliveryPin(pin)).toBe(await hashDeliveryPin(pin));
  });
});
