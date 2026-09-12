import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "track_order",
  title: "Track an order",
  description:
    "Get the current delivery status and timeline of one of the signed-in customer's orders by order number.",
  inputSchema: {
    order_number: z.number().int().positive().describe("The order number shown in the app."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ order_number }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("orders")
      .select(
        "order_number, restaurant, status, total, delivery_fee, payment_status, items, customer_address, created_at, accepted_at, picked_up_at, arrived_at, delivered_at, cancelled_at, cancel_reason",
      )
      .eq("customer_id", ctx.getUserId())
      .eq("order_number", order_number)
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data)
      return {
        content: [{ type: "text", text: `No order #${order_number} found on your account.` }],
        isError: true,
      };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { order: data },
    };
  },
});
