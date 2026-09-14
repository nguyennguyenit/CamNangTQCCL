import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const baseline = JSON.parse(
  await readFile(new URL("../../data/website-display.json", import.meta.url), "utf8"),
);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function websiteDisplayFixture(overrides, { dropValuesFor = [] } = {}) {
  const document = structuredClone(baseline);
  const bodies = Object.fromEntries(
    Object.entries(overrides).map(([path, value]) => [path, typeof value === "string" ? value : JSON.stringify(value)]),
  );
  for (const [path, body] of Object.entries(bodies)) {
    if (!(path in document.sourceHashes)) throw new Error(`Website display fixture cannot add an unpinned source: ${path}`);
    document.sourceHashes[path] = sha256(body);
  }
  if (dropValuesFor.length) {
    document.values = Object.fromEntries(Object.entries(document.values).filter(([key]) => {
      const [entityId] = JSON.parse(key);
      return !dropValuesFor.some((path) => entityId.startsWith(`data:${path}:`));
    }));
  }
  document.generationId = `site-localization:${sha256(JSON.stringify({
    sourceHashes: document.sourceHashes,
    values: document.values,
  }))}`;
  const body = JSON.stringify(document);
  return {
    body,
    pin: {
      generationId: document.generationId,
      sha256: sha256(body),
    },
  };
}

export function replaceWebsiteDisplayPin(html, pin) {
  return html.replace(
    /(<script[^>]*id="website-display-publication"[^>]*>)[\s\S]*?(<\/script>)/,
    (_, start, end) => start + JSON.stringify(pin) + end,
  );
}
