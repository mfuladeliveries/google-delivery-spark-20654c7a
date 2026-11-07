/**
 * Shared validation for delivery addresses. The house/unit number is part of
 * the single address field (not a separate input) and must come first, so
 * drivers can find the exact door — e.g. "12A Oak Street, Mfuleni".
 */

export const ADDRESS_REQUIRED_MESSAGE =
  "Please enter your delivery address.";

export const ADDRESS_HOUSE_NUMBER_MESSAGE =
  'Start your address with your house or unit number, e.g. "12A Oak Street, Mfuleni".';

/**
 * Matches a leading house/unit number: "12", "12A", "B-4" style is covered by
 * the optional prefixes ("Unit 3", "Flat 2", "No. 5", "#7") followed by digits.
 */
const LEADING_HOUSE_NUMBER_PATTERN =
  /^(?:unit\s+|flat\s+|no\.?\s*|#\s*)?\d+[a-zA-Z]?(?:[-/]\d+[a-zA-Z]?)?(?=[\s,]|$)/i;

/** Returns the leading house/unit number in an address, or null when absent. */
export function leadingHouseNumber(address: string | null | undefined): string | null {
  const match = (address ?? "").trim().match(LEADING_HOUSE_NUMBER_PATTERN);
  return match ? match[0].trim() : null;
}

/** Returns the error message for the given full address, or null when valid. */
export function addressHouseNumberError(address: string | null | undefined): string | null {
  const trimmed = (address ?? "").trim();
  if (!trimmed) return ADDRESS_REQUIRED_MESSAGE;
  if (!leadingHouseNumber(trimmed)) return ADDRESS_HOUSE_NUMBER_MESSAGE;
  return null;
}

/**
 * Combines what the customer typed with a geocoded suggestion: when the typed
 * text starts with a house number and the suggestion does not, the typed
 * number is prepended so selecting a suggestion never drops the house number.
 */
export function mergeHouseNumber(typed: string, suggestion: string): string {
  const cleanSuggestion = suggestion.trim();
  if (leadingHouseNumber(cleanSuggestion)) return cleanSuggestion;
  const typedNumber = leadingHouseNumber(typed);
  return typedNumber ? `${typedNumber} ${cleanSuggestion}` : cleanSuggestion;
}
