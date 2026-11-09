import { beforeEach, describe, expect, it } from "vitest";
import { readHomeDeliveryAddress } from "@/lib/homeDeliveryAddress";

describe("home-page delivery address handoff", () => {
  beforeEach(() => sessionStorage.clear());

  it("keeps the full house number and street with the originally selected coordinates", () => {
    const selected = { address: "12A Oak Street, Mfuleni", lat: -33.976, lng: 18.644 };
    sessionStorage.setItem("mfula-manual-area-v1", JSON.stringify(selected));
    expect(readHomeDeliveryAddress()).toEqual(selected);
  });

  it("reads the latest home selection when checkout is reopened", () => {
    sessionStorage.setItem("mfula-manual-area-v1", JSON.stringify({ address: "12A Oak Street, Mfuleni", lat: -33.976, lng: 18.644 }));
    sessionStorage.setItem("mfula-manual-area-v1", JSON.stringify({ address: "7 Main Road, Delft", lat: -33.97, lng: 18.64 }));
    expect(readHomeDeliveryAddress()).toEqual({ address: "7 Main Road, Delft", lat: -33.97, lng: 18.64 });
  });

  it("does not treat unverified text without coordinates as a delivery selection", () => {
    sessionStorage.setItem("mfula-manual-area-v1", JSON.stringify({ address: "12A Oak Street, Mfuleni" }));
    expect(readHomeDeliveryAddress()).toBeNull();
  });

  it("clears the handoff when the customer removes the home selection", () => {
    sessionStorage.setItem("mfula-manual-area-v1", JSON.stringify({ address: "7 Main Road, Delft", lat: -33.97, lng: 18.64 }));
    sessionStorage.removeItem("mfula-manual-area-v1");
    expect(readHomeDeliveryAddress()).toBeNull();
  });
});