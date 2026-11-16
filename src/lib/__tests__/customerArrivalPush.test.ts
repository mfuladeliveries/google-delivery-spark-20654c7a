import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

async function arrivalPush(visible: boolean) {
  const handlers: Record<string, (event: unknown) => void> = {};
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const postMessage = vi.fn();
  const self = {
    addEventListener: (name: string, handler: (event: unknown) => void) => { handlers[name] = handler; },
    registration: { showNotification },
    clients: { matchAll: vi.fn().mockResolvedValue([{ visibilityState: visible ? "visible" : "hidden", postMessage }]) },
  };
  runInNewContext(readFileSync("public/push-handler.js", "utf8"), { self });
  let pending: Promise<unknown> | undefined;
  handlers.push({ data: { json: () => ({ title: "Driver outside", tag: "arrival-order-1", data: { kind: "customer_arrived", order_id: "order-1", recipient_user_id: "customer-1" } }) }, waitUntil: (promise: Promise<unknown>) => { pending = promise; } });
  await pending;
  return { showNotification, postMessage };
}

describe("customer arrival sound delivery", () => {
  it("enables the phone notification sound when the app is closed", async () => {
    const { showNotification, postMessage } = await arrivalPush(false);
    expect(showNotification.mock.calls[0][1].silent).toBe(false);
    expect(postMessage).not.toHaveBeenCalled();
  });
  it("forwards arrival to the open app for ringing without a second system sound", async () => {
    const { showNotification, postMessage } = await arrivalPush(true);
    expect(postMessage).toHaveBeenCalledOnce();
    expect(postMessage.mock.calls[0][0]).toMatchObject({ type: "customer-arrival", order_id: "order-1", recipient_user_id: "customer-1" });
    expect(showNotification.mock.calls[0][1].silent).toBe(true);
  });
});