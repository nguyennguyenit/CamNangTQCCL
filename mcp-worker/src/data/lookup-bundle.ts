import { validateLookupBundle } from "../../../js/lookup-data.js";

/** Sidecars the website publishes next to the raw dictionaries. */
export const LOOKUP_CATALOG_FILE = "lookup-catalog.json";
export const LOOKUP_MANIFEST_FILE = "lookup-manifest.json";

/** The three payloads a lookup generation is verified over. */
export const LOOKUP_PAYLOAD_FILES = [
  "heroes-dict.json",
  "tactics.json",
  LOOKUP_CATALOG_FILE,
] as const;

export type LookupPayloadName = (typeof LOOKUP_PAYLOAD_FILES)[number];
export type LookupPayloads = Readonly<Record<LookupPayloadName, Uint8Array>>;

const textDecoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });

/**
 * Verify a raw lookup generation with the same gate the website uses
 * (`js/lookup-data.js`): raw-byte SHA-256 per payload, canonical generation ID,
 * strict record shapes and resolvable cross IDs. The MCP ingress deliberately
 * reuses that verifier instead of accepting a second, looser format.
 *
 * Returns exactly the byte objects that passed verification, so a snapshot is
 * always built from the verified generation rather than a re-read of the root.
 */
export async function verifyLookupPayloads(
  manifestBytes: Uint8Array,
  payloads: LookupPayloads,
): Promise<LookupPayloads> {
  const manifest: unknown = JSON.parse(textDecoder.decode(manifestBytes));
  const bundle = await validateLookupBundle(manifest, payloads);
  return bundle.rawFiles as LookupPayloads;
}
