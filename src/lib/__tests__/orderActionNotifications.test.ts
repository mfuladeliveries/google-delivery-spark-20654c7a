import { describe, it, expect } from "vitest";
import { orderActionKind, deliverOrderActionOnce, canAnnounceCustomerArrival } from "../../../supabase/functions/push-notify/orderActions";

describe("order action notifications", () => {
  it.each(["driver_assigned", "picking_up", "out_for_delivery", "customer_arrived", "cancelled", "offer_pending", "dispatch_broadcast"])("sends %s only once despite concurrent repeated requests", async (status) => {
    const reservations = new Set<string>();
    let sent = 0;
    const claim = async () => {
      const key = `order:recipient:${orderActionKind(status)}`;
      if (reservations.has(key)) return false;
      reservations.add(key);
      return true;
    };
    await Promise.all(Array.from({ length: 10 }, () => deliverOrderActionOnce(claim, async () => { sent++; })));
    expect(sent).toBe(1);
  });
  it("keeps assignment, departure and cancellation separate", () => {
    expect(orderActionKind("driver_assigned")).toBe("customer_driver_assigned");
    expect(orderActionKind("picking_up")).toBe("customer_picking_up");
    expect(orderActionKind("out_for_delivery")).toBe("customer_out_for_delivery");
    expect(orderActionKind("customer_arrived")).toBe("customer_driver_arrived");
    expect(orderActionKind("cancelled")).toBe("customer_cancelled");
    expect(orderActionKind("rejected")).toBe("customer_cancelled");
  });
  it("allows only the assigned driver to announce arrival during delivery", () => {
    const order = { status: "out_for_delivery", driver_id: "assigned-driver" };
    expect(canAnnounceCustomerArrival(order, "assigned-driver", false)).toBe(true);
    expect(canAnnounceCustomerArrival(order, "another-driver", false)).toBe(false);
    expect(canAnnounceCustomerArrival(order, "customer", false)).toBe(false);
    expect(canAnnounceCustomerArrival({ ...order, status: "delivered" }, "assigned-driver", false)).toBe(false);
    expect(canAnnounceCustomerArrival({ ...order, status: "picking_up" }, "assigned-driver", false)).toBe(false);
    expect(canAnnounceCustomerArrival({ ...order, driver_id: null }, null, true)).toBe(false);
  });
  it("does not resend after an ambiguous delivery failure", async () => {
    let reserved = false;
    let attempts = 0;
    const claim = async () => { if (reserved) return false; reserved = true; return true; };
    await expect(deliverOrderActionOnce(claim, async () => { attempts++; throw new Error("timeout"); })).rejects.toThrow("timeout");
    await deliverOrderActionOnce(claim, async () => { attempts++; });
    expect(attempts).toBe(1);
  });
});