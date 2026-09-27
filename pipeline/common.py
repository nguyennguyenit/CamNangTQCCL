"""Helpers shared by pipeline modules: canonical JSON and SHA-256 hex.

`build_unified_lookup.py`, `lookup_translations.py`, `sgsdeck_identity.py` and
`unified_lookup_identity.py` keep their own copies on purpose: their bytes are recorded in the
Lookup generation evidence (`executionHashes`), so editing them republishes the site generation.
"""

from __future__ import annotations

import hashlib
import json


def canonical_json(value) -> str:
    """Sorted keys, compact separators, non-ASCII kept; NaN/Infinity are rejected."""
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
