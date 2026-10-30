import { createHash } from "crypto";

/**
 * Paynow Zimbabwe hash: concatenate field values (excluding hash) in message
 * order, append the integration key, SHA512, uppercase.
 * Documented in Paynow's initiate/status hash generation guide.
 */
export function paynowHash(values: Iterable<string>, integrationKey: string) {
  const concat = `${Array.from(values).join("")}${integrationKey}`;
  return createHash("sha512").update(concat, "utf8").digest("hex").toUpperCase();
}

export function parseFormPairs(rawBody: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (const part of String(rawBody || "").split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    const key = decodeURIComponent((eq >= 0 ? part.slice(0, eq) : part).replace(/\+/g, " "));
    const value = decodeURIComponent((eq >= 0 ? part.slice(eq + 1) : "").replace(/\+/g, " "));
    pairs.push([key, value]);
  }
  return pairs;
}

export function paynowHashFromPairs(pairs: Array<[string, string]>, integrationKey: string) {
  const values = pairs.filter(([key]) => key.toLowerCase() !== "hash").map(([, value]) => value);
  return paynowHash(values, integrationKey);
}

export function verifyPaynowHash(pairs: Array<[string, string]>, integrationKey: string) {
  const provided = pairs.find(([key]) => key.toLowerCase() === "hash")?.[1] || "";
  if (!provided) return false;
  const expected = paynowHashFromPairs(pairs, integrationKey);
  if (provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return mismatch === 0;
}

export function toPaynowQuery(fields: Array<[string, string]>) {
  return fields
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}
