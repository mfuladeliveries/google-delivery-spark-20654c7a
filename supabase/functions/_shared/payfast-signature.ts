import { Md5 } from "https://deno.land/std@0.224.0/crypto/md5.ts";

export function pfEncode(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

export function md5(input: string): string {
  return new Md5().update(input).toString();
}

export function buildPayfastSignature(
  fields: Record<string, string>,
  passphrase: string,
): string {
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

  return md5(queryString);
}