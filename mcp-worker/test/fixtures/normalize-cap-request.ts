/**
 * Dựng request normalize có độ dài `arguments` đúng bằng trần byte (hoặc hơn 1 byte) bằng padding ASCII ở
 * `displayName`, rồi gói JSON-RPC với escape ASCII toàn bộ như client thật. Không import module Node để dùng được cả
 * trong workerd.
 */

export interface CapEntry {
  canonicalId: string;
  kind: "hero" | "tactic";
  displayName: string;
}

const encoder = new TextEncoder();
const MAX_DISPLAY_NAME = 256;

export function utf8Bytes(value: unknown): number {
  return encoder.encode(JSON.stringify(value)).byteLength;
}

/** `targetBytes` = số byte UTF-8 của `JSON.stringify({ observations })` sau padding. */
export function buildCapObservations(entries: readonly CapEntry[], targetBytes: number) {
  const observations = entries.map((entry, index) => ({
    observationId: `c${index}`,
    entityKind: entry.kind,
    canonicalId: entry.canonicalId,
    displayName: entry.displayName,
    evidence: { sourceScope: "currentTurnImage" as const, batchId: "cap-request" },
  }));
  let remaining = targetBytes - utf8Bytes({ observations });
  if (remaining < 0) throw new Error("entries already exceed the target");
  for (const observation of observations) {
    const pad = Math.min(remaining, MAX_DISPLAY_NAME - observation.displayName.length);
    observation.displayName += "x".repeat(pad);
    remaining -= pad;
  }
  if (remaining !== 0) throw new Error("not enough padding capacity to reach the target");
  return observations;
}

/** Client thật escape mọi ký tự ngoài ASCII thành `\uXXXX` (mỗi ký tự BMP thành 6 byte). */
export function escapeNonAscii(json: string): string {
  return json.replace(/[\u007f-\uffff]/gu, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

export function rpcBody(observations: unknown[]): string {
  return escapeNonAscii(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "tqccl_normalize_entities", arguments: { observations }, _meta: { progressToken: "cap-request" } },
    }),
  );
}
