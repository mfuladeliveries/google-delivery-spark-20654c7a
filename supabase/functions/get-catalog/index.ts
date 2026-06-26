// Public catalog endpoint — returns restaurants + active delivery areas in a
// single CDN-cacheable response. Replaces per-page direct PostgREST reads.
//
// Cache strategy: short browser TTL + longer shared/CDN TTL with SWR so the
// edge layer serves most requests without touching Postgres. Admin mutations
// to restaurants/menus/areas bump `app_settings.catalog_version`; clients can
// pass `?v=<n>` to bust the cache when they detect a newer version.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const CACHE_HEADERS = {
  // Browser keeps it for 60s, CDN keeps it for 5min, allows stale-while-revalidate
  "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const [restaurantsRes, areasRes] = await Promise.all([
      supabase
        .from("restaurants")
        .select(
          "id, name, cuisine, image_url, rating, total_reviews, delivery_time, lat, lng, is_active, is_open, opens_at, closes_at, area_id, address:location, description, min_order",
        )
        .order("name"),
      supabase
        .from("delivery_areas")
        .select(
          "id, name, suburb, lat, lng, radius_km, delivery_fee, base_fee, price_per_km, min_fee, max_fee, is_active",
        )
        .eq("is_active", true)
        .not("lat", "is", null)
        .not("lng", "is", null),
    ]);

    if (restaurantsRes.error) throw restaurantsRes.error;
    if (areasRes.error) throw areasRes.error;

    return new Response(
      JSON.stringify({
        restaurants: restaurantsRes.data ?? [],
        delivery_areas: areasRes.data ?? [],
        generated_at: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, ...CACHE_HEADERS, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("get-catalog error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to load catalog" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
