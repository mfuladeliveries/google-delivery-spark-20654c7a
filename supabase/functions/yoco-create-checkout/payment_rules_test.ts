import { checkoutAction } from "../_shared/paymentRules.ts";

Deno.test("never replace an unknown or successful payment", () => {
  if (checkoutAction(undefined, false) !== "wait") throw new Error("Unknown payment must wait");
  if (checkoutAction("completed", true) !== "confirm") throw new Error("Successful payment must confirm");
  if (checkoutAction("created", true) !== "reuse") throw new Error("Existing checkout must be reused");
  if (checkoutAction("failed", true) !== "replace") throw new Error("Verified failure must allow retry");
});