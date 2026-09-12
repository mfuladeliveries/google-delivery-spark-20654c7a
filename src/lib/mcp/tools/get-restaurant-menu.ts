import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_restaurant_menu",
  title: "Get restaurant menu",
  description: "Get the available menu items and prices for one restaurant by its id.",
  inputSchema: {
    restaurant_id: z.string().uuid().describe("Restaurant id from list_restaurants."),
    category: z.string().trim().optional().describe("Optional menu category filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ restaurant_id, category }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("menu_items")
      .select("id, name, description, category, price, is_available, is_popular")
      .eq("restaurant_id", restaurant_id)
      .eq("is_available", true)
      .order("category", { ascending: true });
    if (category) query = query.ilike("category", category);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { items: data ?? [] },
    };
  },
});
