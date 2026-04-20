// Lightweight forward geocoding via OpenStreetMap Nominatim.
// No API key required. Respect their usage policy: include a UA / referer (browser does this automatically).
// Returns { lat, lng } or null on failure.

export async function geocodeAddress(query: string): Promise<{ lat: number; lng: number } | null> {
  const trimmed = query?.trim();
  if (!trimmed) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
