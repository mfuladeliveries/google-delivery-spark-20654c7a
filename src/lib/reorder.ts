/**
 * One-tap reorder helper.
 *
 * We persist the previous order's items into localStorage and let
 * RestaurantMenu pick them up after it loads its menu. This keeps
 * the actual MenuItem source of truth on the menu page (so prices,
 * availability, and option configs stay accurate) while letting the
 * customer skip the "tap each item again" loop.
 */

export const REORDER_HANDOFF_KEY = "mfula-reorder-handoff-v1";

export interface ReorderItemSeed {
  /** Menu item UUID (matches menu_items.id). */
  id: string;
  quantity: number;
}

export interface ReorderHandoff {
  restaurantId: string;
  items: ReorderItemSeed[];
  /** Epoch ms — used to expire stale handoffs. */
  ts: number;
}

/** TTL for an unconsumed handoff: 5 minutes. */
const HANDOFF_TTL_MS = 5 * 60 * 1000;

export function stashReorder(handoff: Omit<ReorderHandoff, "ts">) {
  try {
    const payload: ReorderHandoff = { ...handoff, ts: Date.now() };
    localStorage.setItem(REORDER_HANDOFF_KEY, JSON.stringify(payload));
  } catch {
    /* private mode / quota — silent */
  }
}

/** Pop a handoff if one exists, is fresh, and matches the current restaurant. */
export function popReorder(restaurantId: string): ReorderItemSeed[] | null {
  try {
    const raw = localStorage.getItem(REORDER_HANDOFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReorderHandoff;
    localStorage.removeItem(REORDER_HANDOFF_KEY);
    if (!parsed || parsed.restaurantId !== restaurantId) return null;
    if (Date.now() - parsed.ts > HANDOFF_TTL_MS) return null;
    return Array.isArray(parsed.items) ? parsed.items : null;
  } catch {
    return null;
  }
}
