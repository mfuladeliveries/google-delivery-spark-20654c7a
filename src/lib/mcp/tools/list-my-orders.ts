import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_orders",
  title: "List my orders",
  description: "List the signed-in customer's recent Mfula Deliveries orders, newest first.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Maximum results (default 10)."),
    status: z.string().trim().optional().describe("Optional order status filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("orders")
      .select(
        "id, order_number, restaurant, status, total, delivery_fee, payment_method, payment_status, created_at, delivered_at",
      )
      .eq("customer_id", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(limit ?? 10);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { orders: data ?? [] },
    };
  },
});
