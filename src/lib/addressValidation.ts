/**
 * Shared validation for the house/unit number collected with every delivery
 * address. The number is required (not optional) so drivers can find the
 * exact door, and its format is constrained to characters that make sense
 * for SA addresses ("12A", "Unit 3", "B-4").
 */

export const HOUSE_UNIT_REQUIRED_MESSAGE =
  "Please enter your house or unit number — drivers need it to find you.";

export const HOUSE_UNIT_FORMAT_MESSAGE =
  'House/unit number can only contain letters, numbers, spaces, and - / # (e.g. "12A", "Unit 3", "B-4").';

const HOUSE_UNIT_PATTERN = /^[A-Za-z0-9\s\-/#]{1,20}$/;

/** Returns the error message for the given house/unit number, or null when valid. */
export function houseUnitValidationError(unit: string | null | undefined): string | null {
  const trimmed = (unit ?? "").trim();
  if (!trimmed) return HOUSE_UNIT_REQUIRED_MESSAGE;
  if (!HOUSE_UNIT_PATTERN.test(trimmed)) return HOUSE_UNIT_FORMAT_MESSAGE;
  return null;
}
