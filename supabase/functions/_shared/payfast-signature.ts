import { crypto } from "jsr:@std/crypto/crypto";
import { encodeHex } from "jsr:@std/encoding/hex";

export function pfEncode(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

export async function md5(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "MD5",
    new TextEncoder().encode(input),
  );

  return encodeHex(digest);
}

export async function buildPayfastSignature(
  fields: Record<string, string>,
  passphrase: string,
): Promise<string> {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (key === "signature") continue;
    if (value === null || value === undefined || value === "") continue;
    parts.push(`${key}=${pfEncode(String(value).trim())}`);
  }

  let queryString = parts.join("&");
  if (passphrase) {
    queryString += `&passphrase=${pfEncode(passphrase.trim())}`;
  }

  return await md5(queryString);
}