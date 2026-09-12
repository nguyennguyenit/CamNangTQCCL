# Shared seasonal contract — Kongming decision 2026-09-12

Scope: concrete schema/API interpretation of accepted phase 2, no fabricated production records.

Registry/evidence top-level arrays; schemaVersion:1 each record. Registry scenario evidenceRefs; evidence.reviewStatus and claim={kind:scenario-attribution|ruleset-applicability|source-observation,scenarioId:null|string,rulesetId:null|string}. Reviewed scenario attribution cannot authorize a ruleset. Phase1 builder owns exact validation.

Config canonical references are existing canonical ID strings resolved through dictionaries, not prefix-only checks. Exactly three heroSlots, each two tacticSlots and three bookSlots; empty bookRefs means unresolved. Preserve statFocusRaw.

requirement={id,kind:advisor|proficiency|order|troop-mod|other,mandatory:boolean,reviewStatus:pending|reviewed,descriptionRaw,evidenceRefs[]}. effectBundle={id,labelRaw,effectsRaw,requirementIds[],evidenceRefs[]}. IDs unique within config; refs resolve. Do not store supported/status as readiness authority. Runtime derives requirementResult={requirementId,supported,status:met|unmet|unknown,reason}. Existing inventory cannot establish those special capabilities, therefore mandatory requirements currently yield unsupported/unknown and block executable portfolio. Optional conditions remain display metadata. No parsing prose/slashes into executable combinations.

Non-null sourceScore includes scoredSelection={schemaVersion:1,configId,scenarioId,rulesetId,unitType,heroSlots:[{heroRef,tacticRefs:[id,id],bookRefs:[id,id,id]}],requirementIds:[],effectBundleIds:[]}. Exactly three ordered heroes; unique sorted requirement/bundle IDs; selection must belong to config/slots and include mandatory conditions. Complete source selection required, no guessed book refs.

configFingerprint SHA256 semantic projection of schemaVersion/config ID/teamId/scenarioId/rulesetId/unitTypes/heroSlots/requirements/effectBundles. selectionFingerprint SHA256 exact scoredSelection. Canonical bytes recursively sorted object keys, array order intact, UTF8 literal Unicode, no normalization/whitespace/newline. Projection excludes floating scores/provenance/review prose and accepts safe integer numbers only. Supply Python/JS golden vectors.

API proposed: validateSeasonBundle(data) async validates + freezes; projectSeasonCandidates(model,context,policy) sync validates pair, filters review/applicability/mandatory requirements/tier before cap500, returns teams/teamTier/diagnostics. candidateKey=config.id separate canonical team.id. One effective tier row/config; unresolved conflicting default yields null. resolveSelectionScore(model,configId,actualSelection) sync compares canonical selection against already validated score selection. Card source score can remain attributed; recommendation/replacement changed/unknown dimensions yield null.

No-context branch unchanged. Resolve source-owned and legacy-locator coexist using explicit discriminator; no legacy bytes rewritten. Unknown scope stays out of seasonal results. Five sidecar names from accepted plan, no sixth artifact. Public files registered alongside creation, never relax exact manifest.
