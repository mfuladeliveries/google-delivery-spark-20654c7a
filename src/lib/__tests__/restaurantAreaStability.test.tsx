import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRestaurantArea } from "@/hooks/useRestaurantArea";
import { getCatalog } from "@/lib/catalog";
import { setSelectedAreaId } from "@/lib/restaurantAreas";
import type { Catalog } from "@/lib/catalog";
import type { DeliveryZone } from "@/lib/serviceArea";

vi.mock("@/lib/catalog", () => ({ getCatalog: vi.fn() }));

const zone = (id: string, lat: number): DeliveryZone => ({
  id, name: id, suburb: id, lat, lng: 18.644, radius_km: 2,
  delivery_fee: 55, base_fee: 55, price_per_km: 0,
  min_fee: null, max_fee: null, is_active: true,
});
const catalog: Catalog = {
  restaurants: [], delivery_areas: [zone("delft", -33.976), zone("other", -33.876)],
  generated_at: "2026-11-08",
};

describe("restaurant area stability", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(getCatalog).mockReset().mockResolvedValue(catalog);
  });

  it("keeps the detected Delft area during small GPS updates without reloading", async () => {
    const { result, rerender } = renderHook(({ lat }) => useRestaurantArea(lat, 18.644), {
      initialProps: { lat: -33.976 },
    });
    await waitFor(() => expect(result.current).toBe("delft"));
    rerender({ lat: -33.976001 });
    expect(result.current).toBe("delft");
    expect(getCatalog).toHaveBeenCalledTimes(1);
    rerender({ lat: -33.876 });
    expect(result.current).toBe("other");
    rerender({ lat: -32 });
    expect(result.current).toBeNull();
  });

  it("changes the selected area immediately without GPS detection overriding it", () => {
    setSelectedAreaId("delft");
    const { result } = renderHook(() => useRestaurantArea(-33.976, 18.644));
    expect(result.current).toBe("delft");
    act(() => setSelectedAreaId("other"));
    expect(result.current).toBe("other");
    expect(getCatalog).not.toHaveBeenCalled();
  });
});