// Mfula Deliveries — delivery zone configuration & detection.
// Keep this in sync with the public.detect_delivery_zone Postgres function.

export type ZoneId = 1 | 2;

export interface DeliveryZone {
  id: ZoneId;
  name: string;
  fee: number;
  areas: string[];
}

export const DELIVERY_ZONES: DeliveryZone[] = [
  {
    id: 1,
    name: "Zone 1 — Local",
    fee: 65,
    areas: ["Mfuleni", "Bluedowns", "Bosasa", "Bardale Village", "Belladonna"],
  },
  {
    id: 2,
    name: "Zone 2",
    fee: 75,
    areas: ["Eesteriver", "Summerville", "Blackheath"],
  },
];

const ZONE_KEYWORDS: Array<{ id: ZoneId; patterns: RegExp[] }> = [
  {
    id: 1,
    patterns: [
      /\bmfuleni\b/,
      /\bblue\s*downs\b/,
      /\bbluedowns\b/,
      /\bbosasa\b/,
      /\bbardale\b/,
      /\bbelladonna\b/,
    ],
  },
  {
    id: 2,
    patterns: [
      /\beesteriver\b/,
      /\beerste\s*river\b/,
      /\bsummerville\b/,
      /\bblackheath\b/,
    ],
  },
];

/** Detect a delivery zone from a free-text address. Returns null if no match. */
export const detectZone = (address: string | null | undefined): DeliveryZone | null => {
  if (!address) return null;
  const v = address.toLowerCase();
  for (const { id, patterns } of ZONE_KEYWORDS) {
    if (patterns.some((p) => p.test(v))) {
      return DELIVERY_ZONES.find((z) => z.id === id) ?? null;
    }
  }
  return null;
};

export const getZoneById = (id: ZoneId | null | undefined): DeliveryZone | null =>
  DELIVERY_ZONES.find((z) => z.id === id) ?? null;

/** Comma-joined list of every supported area, for messaging. */
export const ALL_DELIVERY_AREAS = DELIVERY_ZONES.flatMap((z) => z.areas).join(", ");
