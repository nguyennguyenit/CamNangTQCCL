const MIME_TYPES = {
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  data: "application/json; charset=utf-8",
};

function entry(kind, routeParam, publicationClass = "runtime") {
  return Object.freeze({
    kind,
    routeParam,
    sourceBasename: `${routeParam}.${kind === "data" ? "json" : kind}`,
    publicationClass,
    mimeType: MIME_TYPES[kind],
  });
}

export const PUBLIC_ARTIFACTS = Object.freeze([
  entry("js", "analyze-map"),
  entry("js", "analyze"),
  entry("js", "app"),
  entry("js", "config"),
  entry("js", "derive-team-faction"),
  entry("js", "filters"),
  entry("js", "hanviet"),
  entry("js", "hero-detail"),
  entry("js", "hero-identity"),
  entry("js", "hero-list"),
  entry("js", "khaihoang-detail"),
  entry("js", "legacy-routes"),
  entry("js", "lookup-data"),
  entry("js", "lookup-detail"),
  entry("js", "match-dict"),
  entry("js", "unified-lookup"),
  entry("js", "meta-cu"),
  entry("js", "mobile-section-menu"),
  entry("js", "recruit-tracker-store"),
  entry("js", "recruit-tracker"),
  entry("js", "recommended-reference-render"),
  entry("js", "recommended-reference-state"),
  entry("js", "render"),
  entry("js", "roster-recommend-ui"),
  entry("js", "roster-scan-map"),
  entry("js", "roster-scan-state"),
  entry("js", "season-context"),
  entry("js", "season-ui-state"),
  entry("js", "site-chrome"),
  entry("js", "tactics"),
  entry("js", "team-detail-navigation"),
  entry("js", "team-detail"),
  entry("js", "team-filter-section"),
  entry("js", "team-pk"),
  entry("js", "team-recommend-engine"),
  entry("js", "website-display"),
  entry("css", "styles"),
  entry("data", "books-dict"),
  entry("data", "coexist"),
  entry("data", "facets", "legacy-public/build-input"),
  entry("data", "heroes-dict"),
  entry("data", "khaihoang"),
  entry("data", "lookup-catalog"),
  entry("data", "lookup-manifest"),
  entry("data", "season-content-links"),
  entry("data", "season-evidence"),
  entry("data", "season-registry"),
  entry("data", "season-team-configs"),
  entry("data", "season-team-evaluations"),
  entry("data", "tactics-generic", "legacy-public/build-input"),
  entry("data", "tactics"),
  entry("data", "team-tier"),
  entry("data", "teams"),
  entry("data", "website-display"),
]);

export function validatePublicArtifactManifest(manifest = PUBLIC_ARTIFACTS) {
  const seenRoutes = new Set();
  const seenSources = new Set();
  for (const artifact of manifest) {
    if (!["js", "css", "data"].includes(artifact?.kind)) {
      throw new Error(`Unsupported public artifact kind: ${artifact?.kind}`);
    }
    if (!artifact.routeParam || artifact.routeParam.includes(".") || artifact.routeParam.includes("/")) {
      throw new Error(`Public artifact routeParam must be extensionless: ${artifact.routeParam}`);
    }
    if (
      !artifact.sourceBasename
      || artifact.sourceBasename !== artifact.sourceBasename.split(/[\\/]/).at(-1)
      || artifact.sourceBasename.includes("..")
    ) {
      throw new Error(`Public artifact source must be an exact basename: ${artifact.sourceBasename}`);
    }
    const expectedExtension = artifact.kind === "data" ? ".json" : `.${artifact.kind}`;
    if (!artifact.sourceBasename.endsWith(expectedExtension)) {
      throw new Error(`Public artifact source extension mismatch: ${artifact.sourceBasename}`);
    }
    const routeKey = `${artifact.kind}/${artifact.routeParam}`;
    const sourceKey = `${artifact.kind}/${artifact.sourceBasename}`;
    if (seenRoutes.has(routeKey) || seenSources.has(sourceKey)) {
      throw new Error(`Duplicate public artifact mapping: ${routeKey}`);
    }
    seenRoutes.add(routeKey);
    seenSources.add(sourceKey);
  }
  return manifest;
}

export function artifactEntriesFor(kind, manifest = PUBLIC_ARTIFACTS) {
  validatePublicArtifactManifest(manifest);
  return manifest.filter((artifact) => artifact.kind === kind);
}
