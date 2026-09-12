import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listRestaurantsTool from "./tools/list-restaurants";
import getRestaurantMenuTool from "./tools/get-restaurant-menu";
import listMyOrdersTool from "./tools/list-my-orders";
import trackOrderTool from "./tools/track-order";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "mfula-deliveries",
  title: "Mfula Deliveries",
  version: "0.1.0",
  instructions:
    "Tools for Mfula Deliveries, a food delivery app in Mfuleni, Cape Town. Use `list_restaurants` to find open restaurants, `get_restaurant_menu` for their items and prices, `list_my_orders` for the signed-in customer's order history, and `track_order` for the live status of a specific order number. All tools act as the signed-in customer.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listRestaurantsTool, getRestaurantMenuTool, listMyOrdersTool, trackOrderTool],
});
