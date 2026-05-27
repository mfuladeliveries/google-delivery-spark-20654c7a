// Google Maps proxy via the Lovable connector gateway.
// Supports: forward geocoding, reverse geocoding, Places (New) autocomplete,
// and Places (New) place details. Server-side so it works on every domain,
// including custom domains, without exposing the browser key.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

interface ForwardBody {
  action: "forward";
  query: string;
  region?: string;
}
interface ReverseBody {
  action: "reverse";
  lat: number;
  lng: number;
}
interface AutocompleteBody {
  action: "autocomplete";
  input: string;
  sessionToken?: string;
  region?: string;
}
interface DetailsBody {
  action: "details";
  placeId: string;
  sessionToken?: string;
}
type Body = ForwardBody | ReverseBody | AutocompleteBody | DetailsBody;

function ok(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function bad(msg: string, status = 400) {
  return ok({ error: msg }, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!LOVABLE_API_KEY) return bad("LOVABLE_API_KEY is not configured", 500);
  if (!GOOGLE_MAPS_API_KEY) return bad("GOOGLE_MAPS_API_KEY is not configured", 500);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return bad("Invalid JSON body");
  }

  async function safeJson(r: Response): Promise<any> {
    const text = await r.text();
    try {
      return JSON.parse(text);
    } catch {
      console.warn("maps-geocode upstream non-JSON", r.status, text.slice(0, 200));
      return null;
    }
  }

  const baseHeaders = {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
  };

  try {
    if (body.action === "forward") {
      const q = (body.query ?? "").toString().trim();
      if (!q) return bad("query is required");
      const region = (body.region ?? "za").toLowerCase();
      const url = `${GATEWAY}/maps/api/geocode/json?address=${encodeURIComponent(q)}&region=${region}`;
      const r = await fetch(url, { headers: baseHeaders });
      const data = await r.json();
      if (data.status !== "OK" || !data.results?.length) {
        return ok({ results: [] });
      }
      return ok({
        results: data.results.map((res: any) => ({
          address: res.formatted_address,
          lat: res.geometry?.location?.lat,
          lng: res.geometry?.location?.lng,
          place_id: res.place_id,
        })),
      });
    }

    if (body.action === "reverse") {
      const { lat, lng } = body;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return bad("lat/lng required");
      const url = `${GATEWAY}/maps/api/geocode/json?latlng=${lat},${lng}`;
      const r = await fetch(url, { headers: baseHeaders });
      const data = await r.json();
      if (data.status !== "OK" || !data.results?.length) return ok({ address: null });
      const top = data.results[0];
      // Pull suburb/city/postal from components
      const comp = top.address_components ?? [];
      const find = (t: string) =>
        comp.find((c: any) => Array.isArray(c.types) && c.types.includes(t))?.long_name ?? null;
      return ok({
        address: top.formatted_address,
        place_id: top.place_id,
        suburb: find("sublocality") ?? find("sublocality_level_1") ?? find("neighborhood"),
        city: find("locality") ?? find("administrative_area_level_2"),
        province: find("administrative_area_level_1"),
        postal_code: find("postal_code"),
      });
    }

    if (body.action === "autocomplete") {
      const input = (body.input ?? "").toString().trim();
      if (input.length < 2) return ok({ suggestions: [] });
      const region = (body.region ?? "za").toLowerCase();
      const r = await fetch(`${GATEWAY}/places/v1/places:autocomplete`, {
        method: "POST",
        headers: { ...baseHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          includedRegionCodes: [region],
          ...(body.sessionToken ? { sessionToken: body.sessionToken } : {}),
        }),
      });
      const data = await r.json();
      const suggestions = (data.suggestions ?? [])
        .map((s: any) => s.placePrediction)
        .filter(Boolean)
        .map((p: any) => ({
          place_id: p.placeId,
          text: p.text?.text ?? "",
          main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
          secondary: p.structuredFormat?.secondaryText?.text ?? "",
        }));
      return ok({ suggestions });
    }

    if (body.action === "details") {
      const id = (body.placeId ?? "").toString().trim();
      if (!id) return bad("placeId required");
      const url = `${GATEWAY}/places/v1/places/${encodeURIComponent(id)}${body.sessionToken ? `?sessionToken=${encodeURIComponent(body.sessionToken)}` : ""}`;
      const r = await fetch(url, {
        headers: {
          ...baseHeaders,
          "X-Goog-FieldMask": "id,formattedAddress,location",
        },
      });
      const data = await r.json();
      const lat = data?.location?.latitude;
      const lng = data?.location?.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return ok({ address: null });
      }
      return ok({ address: data.formattedAddress ?? "", lat, lng, place_id: data.id });
    }

    return bad("Unknown action");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("maps-geocode error:", msg);
    return bad(msg, 500);
  }
});
