"""Strict private Vietnamese translation ledger for unified lookup builds."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path


HASH = re.compile(r"^[0-9a-f]{64}$")
CJK = re.compile(
    "[\u2e80-\u2e99\u2e9b-\u2ef3\u2f00-\u2fd5\u3005\u3007"
    "\u3021-\u3029\u3038-\u303b\u3400-\u4dbf\u4e00-\u9fff"
    "\uf900-\ufa6d\ufa70-\ufad9"
    "\U00016fe2-\U00016fe3\U00016ff0-\U00016ff6"
    "\U00020000-\U0002a6df\U0002a700-\U0002b81d\U0002b820-\U0002cead"
    "\U0002ceb0-\U0002ebe0\U0002ebf0-\U0002ee5d\U0002f800-\U0002fa1d"
    "\U00030000-\U0003134a\U00031350-\U00033479]"
)
LEDGER_KEYS = {"schemaVersion", "glossaryVersion", "entries"}
ENTRY_KEYS = {
    "entityId",
    "fieldPath",
    "inputFingerprint",
    "textVi",
    "status",
    "review",
}
REVIEW_KEYS = {"reviewer", "reviewedAt", "evidence", "semanticChecks"}


def canonical_json_bytes(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()


def translation_fingerprint(entity_id, field_path, chosen_input, glossary_version, context=None):
    payload = {
        "entityId": entity_id,
        "fieldPath": field_path,
        "chosenInput": chosen_input,
        "glossaryVersion": glossary_version,
        "context": context or {},
    }
    return hashlib.sha256(canonical_json_bytes(payload)).hexdigest()


def validate_translation_entries(ledger, expected=None):
    if not isinstance(ledger, dict) or set(ledger) != LEDGER_KEYS:
        raise ValueError("translation ledger must use the exact schema")
    if type(ledger["schemaVersion"]) is not int or ledger["schemaVersion"] != 1:
        raise ValueError("unsupported translation schemaVersion")
    glossary = ledger["glossaryVersion"]
    if not isinstance(glossary, str) or not glossary.strip():
        raise ValueError("glossaryVersion is required")
    if not isinstance(ledger["entries"], list):
        raise ValueError("translation entries must be an array")

    seen = set()
    for entry in ledger["entries"]:
        if not isinstance(entry, dict) or set(entry) != ENTRY_KEYS:
            raise ValueError("translation entry must use the exact schema")
        key = (entry["entityId"], entry["fieldPath"])
        if not all(isinstance(part, str) and part.strip() for part in key) or key in seen:
            raise ValueError(f"invalid or duplicate translation key: {key}")
        seen.add(key)
        fingerprint = entry["inputFingerprint"]
        if not isinstance(fingerprint, str) or not HASH.fullmatch(fingerprint) or set(fingerprint) == {"0"}:
            raise ValueError(f"invalid translation fingerprint: {key}")
        text = entry["textVi"]
        if not isinstance(text, str) or not text.strip() or CJK.search(text):
            raise ValueError(f"translation is not reviewed Vietnamese: {key}")
        if entry["status"] != "reviewed":
            raise ValueError(f"translation is not reviewed: {key}")
        review = entry["review"]
        if not isinstance(review, dict) or set(review) != REVIEW_KEYS:
            raise ValueError(f"translation review must use the exact schema: {key}")
        if not isinstance(review["reviewer"], str) or not review["reviewer"].strip():
            raise ValueError(f"translation reviewer is required: {key}")
        if not isinstance(review["reviewedAt"], str) or not review["reviewedAt"].strip():
            raise ValueError(f"translation review date is required: {key}")
        for field in ("evidence", "semanticChecks"):
            values = review[field]
            if not isinstance(values, list) or not values or not all(
                isinstance(value, str) and value.strip() for value in values
            ):
                raise ValueError(f"translation {field} is required: {key}")

    if expected is not None:
        if seen != set(expected):
            raise ValueError("translation ledger coverage does not match captured inputs")
        for entry in ledger["entries"]:
            key = (entry["entityId"], entry["fieldPath"])
            if entry["inputFingerprint"] != expected[key]:
                raise ValueError(f"stale translation fingerprint: {key}")
    return ledger


def load_translation_ledger(path):
    ledger = json.loads(Path(path).read_bytes())
    return validate_translation_entries(ledger)
