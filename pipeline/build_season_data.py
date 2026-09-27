"""Validate and build isolated seasonal sidecars; never rebuild legacy data.

Inputs and outputs are arrays with schemaVersion on each record. A reviewed
scenario claim authorizes attribution only; applicability needs a reviewed
ruleset claim for the exact pair. Source numbers and dates never infer scope.
"""
import argparse
import contextlib
import copy
from datetime import date, datetime
import json
import os
from pathlib import Path
import re
import tempfile
import unicodedata
from urllib.parse import urlsplit

from pipeline.promote_unified_lookup import JOURNAL_STATES, LOCK_RELATIVE, TRANSACTIONS_RELATIVE

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_VERSION = 1
# Giao dịch Tra cứu chưa kết thúc (chưa committed/rolled-back) -> từ điển đang đổi.
OPEN_JOURNAL_STATES = JOURNAL_STATES - {"committed", "rolled-back"}

def lookup_generation(output_dir):
    manifest_path = Path(output_dir) / "lookup-manifest.json"
    if not manifest_path.exists():
        return "legacy"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    generation = manifest.get("generationId")
    if not isinstance(generation, str) or not generation.startswith("lookup:"):
        raise ValueError("lookup generation is invalid")
    return generation


@contextlib.contextmanager
def dictionary_exclusion(root):
    """Giữ khoá promotion của repo ``root`` (cùng khoá với promote_unified_lookup)."""
    root = Path(root)
    for journal_path in sorted((root / TRANSACTIONS_RELATIVE).glob("*/journal.json")):
        state = json.loads(journal_path.read_text(encoding="utf-8")).get("state")
        if state in OPEN_JOURNAL_STATES:
            raise RuntimeError(f"lookup transaction {journal_path.parent.name} is {state}; recover it first")
    lock = root / LOCK_RELATIVE
    lock.parent.mkdir(parents=True, exist_ok=True)
    try:
        descriptor = os.open(lock, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError as error:
        raise RuntimeError("lookup dictionaries are locked") from error
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        json.dump({"pid": os.getpid(), "transaction": f"season-writer-{os.getpid()}"}, handle)
        handle.write("\n")
    try:
        yield
    finally:
        lock.unlink()


def record(value, required, optional=()):
    if not isinstance(value, dict) or not set(required) <= value.keys() or value.keys() - set(required) - set(optional):
        raise ValueError("record has missing or unknown fields")
    return value


def text(value, maximum=512):
    if (not isinstance(value, str) or not value or value != value.strip()
            or len(value) > maximum or any(unicodedata.category(char).startswith("C") for char in value)):
        raise ValueError("invalid bounded text")
    return value


def identifier(value):
    return text(value, 128)


def array(value):
    if not isinstance(value, list):
        raise ValueError("expected array")
    return value


def unique_records(value):
    result = {}
    for item in array(value):
        if not isinstance(item, dict):
            raise ValueError("expected record")
        key = identifier(item.get("id"))
        if key in result:
            raise ValueError("duplicate ID")
        result[key] = item
    return result


def review_status(value):
    if value not in ("pending", "reviewed"):
        raise ValueError("invalid reviewStatus")


def version(value):
    if type(value) is not int or value != SCHEMA_VERSION:
        raise ValueError("invalid schemaVersion")


def source_season(value):
    if value is None:
        return
    record(value, (), ("label", "number", "scenarioName"))
    if not value:
        raise ValueError("empty sourceSeason must be null")
    for key in ("label", "scenarioName"):
        if key in value:
            text(value[key])
    if "number" in value and (type(value["number"]) is not int or not 0 <= value["number"] <= 10000):
        raise ValueError("invalid sourceSeason.number")


def source_url(value):
    url = text(value, 2048)
    parsed = urlsplit(url)
    if (parsed.scheme not in ("https", "http") or not parsed.hostname
            or parsed.username is not None or parsed.password is not None
            or any(char.isspace() for char in url)):
        raise ValueError("invalid provenance URL")
    parsed.port
    return url


def provenance(value):
    record(value, ("provider", "region", "sourceUrl", "fetchedAt"), ("sourceUpdatedAt",))
    text(value["provider"], 128)
    text(value["region"], 32)
    source_url(value['sourceUrl'])
    for key in ("fetchedAt", "sourceUpdatedAt"):
        if key not in value:
            continue
        stamp = text(value[key], 40)
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", stamp):
            date.fromisoformat(stamp)
        elif re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})", stamp):
            datetime.fromisoformat(stamp.replace("Z", "+00:00"))
        else:
            raise ValueError("invalid provenance date")


def evidence_refs(value, evidence, reviewed=False):
    refs = array(value)
    seen = set()
    for ref in refs:
        identifier(ref)
        if ref in seen or ref not in evidence:
            raise ValueError("duplicate or dangling evidence reference")
        seen.add(ref)
        if reviewed and evidence[ref]["reviewStatus"] != "reviewed":
            raise ValueError("reviewed evidence required")
    if reviewed and not refs:
        raise ValueError("reviewed evidence required")
    return [evidence[ref] for ref in refs]


def require_claim(proofs, kind, scenario_id, ruleset_id=None, mapping=None):
    for proof in proofs:
        claim = proof["claim"]
        if claim != {"kind": kind, "scenarioId": scenario_id, "rulesetId": ruleset_id}:
            continue
        if mapping is not None:
            if any(proof["provenance"][key] != mapping["provenance"][key] for key in ("provider", "region", "sourceUrl")):
                continue
            if proof.get("sourceSeason") != mapping["sourceSeason"]:
                continue
        return
    raise ValueError(f"reviewed {kind} evidence for exact scope required")


def validate_evidence(evidence, scenarios, rulesets):
    for proof in evidence.values():
        record(proof, ("schemaVersion", "id", "provenance", "canonicalRef", "note", "reviewStatus", "claim"), ("sourceSeason", "snapshotHash", "configFingerprint"))
        version(proof["schemaVersion"])
        provenance(proof["provenance"])
        source_season(proof.get("sourceSeason"))
        text(proof["note"], 4096)
        review_status(proof["reviewStatus"])
        if "snapshotHash" in proof and not re.fullmatch(r"sha256:[a-f0-9]{64}", text(proof["snapshotHash"], 71)):
            raise ValueError("invalid snapshotHash")
        canonical = proof["canonicalRef"]
        if canonical is not None:
            record(canonical, ("kind", "id"))
            identifier(canonical["kind"])
            identifier(canonical["id"])
            if proof["reviewStatus"] != "reviewed":
                raise ValueError("canonicalRef requires reviewed evidence")
        claim = record(proof["claim"], ("kind", "scenarioId", "rulesetId"))
        kind, scenario_id, ruleset_id = claim["kind"], claim["scenarioId"], claim["rulesetId"]
        if 'configFingerprint' in proof:
            from .season_validation import sha256
            sha256(proof['configFingerprint'])
            if kind != 'ruleset-applicability':
                raise ValueError('config fingerprint requires applicability claim')
        if kind not in ("scenario-attribution", "ruleset-applicability", "source-observation"):
            raise ValueError("invalid evidence claim kind")
        if scenario_id is not None and identifier(scenario_id) not in scenarios:
            raise ValueError("dangling evidence scenario")
        if ruleset_id is not None and (scenario_id, identifier(ruleset_id)) not in rulesets:
            raise ValueError("dangling evidence ruleset")
        if kind == "scenario-attribution" and (scenario_id is None or ruleset_id is not None):
            raise ValueError("scenario-attribution cannot establish ruleset")
        if kind == "ruleset-applicability" and (scenario_id is None or ruleset_id is None):
            raise ValueError("ruleset-applicability requires exact pair")
        if kind == "source-observation" and (scenario_id is not None or ruleset_id is not None):
            raise ValueError("source-observation cannot establish scope")


def validate_registry(registry, evidence):
    """Validate both arrays completely, returning indexes for scoped consumers."""
    scenarios, proofs = unique_records(registry), unique_records(evidence)
    rulesets = {}
    for scenario in scenarios.values():
        record(scenario, ("schemaVersion", "id", "labelVi", "aliases", "region", "kind", "rulesets", "sourceMappings", "reviewStatus", "evidenceRefs"))
        version(scenario["schemaVersion"])
        text(scenario["labelVi"])
        aliases = [text(alias) for alias in array(scenario["aliases"])]
        if len(set(aliases)) != len(aliases):
            raise ValueError("duplicate alias")
        if scenario["region"] != "VN" or scenario["kind"] not in ("introductory", "scenario"):
            raise ValueError("invalid scenario region or kind")
        review_status(scenario["reviewStatus"])
        for rule in unique_records(scenario["rulesets"]).values():
            record(rule, ("id", "label", "reviewStatus", "evidenceRefs"))
            text(rule["label"])
            review_status(rule["reviewStatus"])
            rulesets[(scenario["id"], rule["id"])] = rule
    validate_evidence(proofs, scenarios, rulesets)
    for scenario in scenarios.values():
        scenario_id = scenario["id"]
        reviewed = scenario["reviewStatus"] == "reviewed"
        refs = evidence_refs(scenario["evidenceRefs"], proofs, reviewed)
        if reviewed:
            require_claim(refs, "scenario-attribution", scenario_id)
        for rule in scenario["rulesets"]:
            rule_reviewed = rule["reviewStatus"] == "reviewed"
            refs = evidence_refs(rule["evidenceRefs"], proofs, rule_reviewed)
            if rule_reviewed:
                if not reviewed:
                    raise ValueError("reviewed ruleset requires reviewed scenario")
                require_claim(refs, "ruleset-applicability", scenario_id, rule["id"])
        for mapping in array(scenario["sourceMappings"]):
            record(mapping, ("sourceSeason", "provenance", "rulesetId", "reviewStatus", "evidenceRefs"))
            source_season(mapping["sourceSeason"])
            provenance(mapping["provenance"])
            review_status(mapping["reviewStatus"])
            rule_id = mapping["rulesetId"]
            if rule_id is not None and (scenario_id, identifier(rule_id)) not in rulesets:
                raise ValueError("dangling source mapping ruleset")
            mapping_reviewed = mapping["reviewStatus"] == "reviewed"
            refs = evidence_refs(mapping["evidenceRefs"], proofs, mapping_reviewed)
            if mapping_reviewed:
                if not reviewed or (rule_id is not None and rulesets[(scenario_id, rule_id)]["reviewStatus"] != "reviewed"):
                    raise ValueError("reviewed mapping requires reviewed scope")
                kind = "scenario-attribution" if rule_id is None else "ruleset-applicability"
                require_claim(refs, kind, scenario_id, rule_id, mapping)
    return scenarios, proofs


def build_season_data(registry, evidence, *, configs=None, evaluations=None, content_links=None, legacy_data=None, identity_catalog=None):
    """Pure candidate build. Consumers may validate further sidecars before write."""
    scenarios, proofs = validate_registry(registry, evidence)
    extended = any(value is not None for value in (configs, evaluations, content_links))
    if extended and any(value is None for value in (configs, evaluations, content_links)):
        raise ValueError('all three seasonal extension arrays are required together')
    if extended or any(proof['canonicalRef'] is not None for proof in evidence):
        from .season_validation import validate_bundle, validate_canonical_evidence
        if identity_catalog is None:
            identity_catalog = {name: json.loads((ROOT / 'data' / (name + '.json')).read_text(encoding='utf-8')) for name in ('heroes-dict', 'tactics', 'books-dict')}
        validate_canonical_evidence(proofs, identity_catalog)
        if extended:
            if legacy_data is None:
                legacy_data = {name: json.loads((ROOT / 'data' / (name + '.json')).read_text(encoding='utf-8')) for name in ('teams', 'coexist')}
            validate_bundle(configs, evaluations, content_links, scenarios, proofs, legacy_data, identity_catalog)
    payloads = {"season-registry.json": copy.deepcopy(registry), "season-evidence.json": copy.deepcopy(evidence)}
    for name, value in (("season-team-configs.json", configs), ("season-team-evaluations.json", evaluations), ("season-content-links.json", content_links)):
        if value is not None:
            payloads[name] = copy.deepcopy(value)
    return payloads


def encode_payloads(payloads):
    """Encode the complete validated set before the publication step does I/O."""
    return {name: (json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True, allow_nan=False) + "\n").encode("utf-8") for name, payload in payloads.items()}


def publish_season_data(registry, evidence, output_dir, *, root=ROOT, **options):
    """Validate and publish sidecars while the lookup generation is excluded.

    The exclusion is the promotion lock of repository ``root``, whatever ``output_dir`` is.
    """
    output_dir = Path(output_dir)
    with dictionary_exclusion(root):
        generation = lookup_generation(output_dir)
        payloads = build_season_data(registry, evidence, **options)
        encoded = encode_payloads(payloads)
        output_dir.mkdir(parents=True, exist_ok=True)
        for name in encoded:
            path = output_dir / name
            if path.is_symlink() or (path.exists() and not path.is_file()):
                raise ValueError("output must be a regular file")
        with tempfile.TemporaryDirectory(prefix=".season-candidate-", dir=output_dir) as staging:
            backups = {}
            for name, contents in encoded.items():
                (Path(staging) / name).write_bytes(contents)
                path = output_dir / name
                if path.exists():
                    backup = Path(staging) / (name + ".previous")
                    backup.write_bytes(path.read_bytes())
                    backups[name] = backup
            if lookup_generation(output_dir) != generation:
                raise ValueError("lookup generation changed during season publication")
            replaced = []
            try:
                for name in encoded:
                    os.replace(Path(staging) / name, output_dir / name)
                    replaced.append(name)
            except Exception:
                for name in reversed(replaced):
                    if name in backups:
                        os.replace(backups[name], output_dir / name)
                    else:
                        (output_dir / name).unlink()
                raise
    return payloads


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--registry", type=Path, default=ROOT / "pipeline/season-registry.json")
    parser.add_argument("--evidence", type=Path, default=ROOT / "pipeline/season-evidence.json")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "data")
    parser.add_argument("--configs", type=Path, default=ROOT / "pipeline/season-team-configs.json")
    parser.add_argument("--evaluations", type=Path, default=ROOT / "pipeline/season-team-evaluations.json")
    parser.add_argument("--content-links", type=Path, default=ROOT / "pipeline/season-content-links.json")
    args = parser.parse_args()
    registry = json.loads(args.registry.read_text(encoding="utf-8"))
    evidence = json.loads(args.evidence.read_text(encoding="utf-8"))
    options = {key: json.loads(path.read_text(encoding='utf-8')) for key, path in (
        ('configs', args.configs), ('evaluations', args.evaluations), ('content_links', args.content_links))}
    publish_season_data(registry, evidence, args.output_dir, **options)


if __name__ == "__main__":
    main()
