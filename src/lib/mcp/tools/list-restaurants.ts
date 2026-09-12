import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_restaurants",
  title: "List restaurants",
  description:
    "List restaurants available for delivery on Mfula Deliveries, optionally filtered by a name or cuisine search term.",
  inputSchema: {
    search: z.string().trim().optional().describe("Optional name or cuisine search term."),
    limit: z.number().int().min(1).max(50).optional().describe("Maximum results (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("restaurants")
      .select("id, name, cuisine, location, delivery_time, min_order, rating, is_active, is_open")
      .eq("is_active", true)
      .order("rating", { ascending: false })
      .limit(limit ?? 20);
    if (search) query = query.or(`name.ilike.%${search}%,cuisine.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { restaurants: data ?? [] },
    };
  },
});
