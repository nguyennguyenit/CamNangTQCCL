"""Freeze one URL slug per Tra cứu (lookup) corpus item: `/tra-cuu/<group>/<slug>/`.

The corpus is the one `buildLookupCorpus` (js/unified-lookup.js) assembles from data/heroes-dict.json,
data/tactics.json, data/lookup-catalog.json and data/books-dict.json. Those are plain JSON files, so the
ids are read straight from them (books through the `bookLookupId` rule of js/lookup-ids.js) instead of
spawning node; the slug rule below mirrors `lookupSlug` there and tests/test_lookup_route_handles.py pins it.
`equipment-special:*` records are not routes (they live inside their equipment page).

Assignment is one-time: `--write` slugs every id missing from the ledger from its Vietnamese name (collision
inside a group gets `-2`, `-3`, … in corpus order) and never touches a slug that is already frozen, even if
the name changed. An id that vanished from the corpus is moved to `retired` (`{group: {id: slug}}`): its slug
stays reserved so it is never issued again, the TS loader ignores `retired`, and the id gets the same slug back
if it returns. `handlesSha256` covers `handles` and `retired`, so `--write` refuses a hand-edited ledger.
`--check` only validates the ledger against the current corpus and never re-derives a slug.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

from pipeline.common import sha256_hex

LEDGER_SCHEMA_VERSION = 1
REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LEDGER_PATH = REPO_ROOT / "pipeline" / "lookup-route-handles.json"
DEFAULT_DATA_DIR = REPO_ROOT / "data"

LEDGER_NOTE = "Slug URL đã gán một lần theo id; không suy lại từ tên Việt, tên đổi không đổi slug."
LEDGER_KEYS = ("schemaVersion", "generationId", "booksSha256", "handlesSha256", "note", "handles", "retired")
# Group order = LOOKUP_GROUPS of js/unified-lookup.js; value = id kind prefix of every id in the group.
GROUP_KINDS = {
    "heroes": "hero",
    "tactics": "tactic",
    "equipment": "equipment",
    "advisors": "advisor",
    "troop-mods": "troop-mod",
    "buildings": "building",
    "books": "book",
}
GENERATION_ID = re.compile(r"lookup:[0-9a-f]{64}")
SLUG_SHAPE = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
NON_SLUG = re.compile(r"[^a-z0-9]+")


class LookupRouteHandleError(Exception):
    """A slug could not be derived, or the frozen ledger failed validation."""


def slug(value: object) -> str:
    """`lookupSlug` of js/lookup-ids.js: trim, lowercase, `đ` → `d`, strip diacritics, `[^a-z0-9]+` → `-`."""
    text = "" if value is None else str(value)
    folded = unicodedata.normalize("NFD", text.strip().lower().replace("đ", "d"))
    folded = "".join(ch for ch in folded if not "\u0300" <= ch <= "\u036f")
    return NON_SLUG.sub("-", folded).strip("-")


def _name(record: dict) -> str:
    """`entry()` of js/unified-lookup.js: viet ?? nameVi ?? hanViet, trimmed."""
    for key in ("viet", "nameVi", "hanViet"):
        if record.get(key) is not None:
            return str(record[key]).strip()
    return ""


def _book_id(row: dict) -> str | None:
    """`bookLookupId`: slug of viet ?? hanViet (JS `??` keeps an empty `viet`)."""
    value = row.get("viet") if row.get("viet") is not None else row.get("hanViet")
    text = slug(value)
    return f"book:{text}" if text else None


def _load(path: Path):
    return json.loads(path.read_bytes())


def load_corpus(data_dir) -> dict:
    """`{group: [(id, nameVi), …]}` in corpus order, plus the pins `generationId`/`booksSha256`."""
    data_dir = Path(data_dir)
    manifest = _load(data_dir / "lookup-manifest.json")
    catalog = _load(data_dir / "lookup-catalog.json")
    books_bytes = (data_dir / "books-dict.json").read_bytes()
    books = json.loads(books_bytes)
    sources = {
        "heroes": _load(data_dir / "heroes-dict.json"),
        "tactics": _load(data_dir / "tactics.json"),
        "equipment": catalog["equipment"],
        "advisors": catalog["advisors"],
        "troop-mods": catalog["troopMods"],
        "buildings": catalog["buildings"],
    }
    groups = {group: [(record["id"], _name(record)) for record in records] for group, records in sources.items()}
    book_rows = []
    for row in books if isinstance(books, list) else []:
        book_id = _book_id(row)
        if book_id:
            book_rows.append((book_id, _name(row)))
    groups["books"] = book_rows
    generation_id = manifest.get("generationId")
    if not isinstance(generation_id, str) or not GENERATION_ID.fullmatch(generation_id):
        raise LookupRouteHandleError("lookup-manifest.json generationId is not `lookup:<64-hex>`")
    for group in GROUP_KINDS:
        ids = [item[0] for item in groups[group]]
        if len(set(ids)) != len(ids):
            repeated = sorted({i for i in ids if ids.count(i) > 1})
            raise LookupRouteHandleError(f"corpus group {group} repeats ids: {', '.join(repeated)}")
    return {"groups": {group: groups[group] for group in GROUP_KINDS}, "generationId": generation_id, "booksSha256": sha256_hex(books_bytes)}


def handles_digest(handles: dict, retired: dict) -> str:
    canonical = json.dumps({"handles": handles, "retired": retired}, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return sha256_hex(canonical.encode("utf-8"))


def mint_handles(corpus: dict, existing: dict | None = None, retired: dict | None = None) -> tuple[dict, dict, list]:
    """Keep every frozen slug, give each new id a unique slug of its name; returns (handles, retired, collisions).

    Ids that left the corpus move to `retired` and keep reserving their slug; a retired id that is back in the
    corpus gets its old slug again."""
    existing = existing or {}
    retired = retired or {}
    handles = {}
    new_retired = {}
    collisions = []
    for group, items in corpus["groups"].items():
        frozen = {**retired.get(group, {}), **existing.get(group, {})}
        out = {item_id: frozen[item_id] for item_id, _ in items if item_id in frozen}
        new_retired[group] = {item_id: value for item_id, value in frozen.items() if item_id not in out}
        used = set(frozen.values())
        for item_id, name in items:
            if item_id in out:
                continue
            base = slug(name)
            if not base:
                raise LookupRouteHandleError(f"{item_id}: Vietnamese name {name!r} has no slug")
            candidate, n = base, 1
            while candidate in used:
                n += 1
                candidate = f"{base}-{n}"
            if n > 1:
                collisions.append({"group": group, "id": item_id, "base": base, "slug": candidate})
            used.add(candidate)
            out[item_id] = candidate
        handles[group] = out
    return handles, new_retired, collisions


def build_ledger(corpus: dict, handles: dict, retired: dict) -> dict:
    return {
        "schemaVersion": LEDGER_SCHEMA_VERSION,
        "generationId": corpus["generationId"],
        "booksSha256": corpus["booksSha256"],
        "handlesSha256": handles_digest(handles, retired),
        "note": LEDGER_NOTE,
        "handles": handles,
        "retired": retired,
    }


def ledger_bytes(ledger: dict) -> bytes:
    return (json.dumps(ledger, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")


def ledger_problems(ledger: object, corpus: dict, *, pins: bool = True, drift: bool = True) -> list[str]:
    """Every reason the ledger does not freeze exactly this corpus. Never derives a slug.

    `drift=False` leaves out what `--write` repairs on its own (new ids, vanished ids, returned retired ids)."""
    if not isinstance(ledger, dict) or set(ledger) != set(LEDGER_KEYS):
        return [f"ledger keys must be exactly {', '.join(sorted(LEDGER_KEYS))}"]
    problems = []
    if ledger["schemaVersion"] != LEDGER_SCHEMA_VERSION:
        problems.append(f"ledger schemaVersion must be {LEDGER_SCHEMA_VERSION}")
    handles, retired = ledger["handles"], ledger["retired"]
    for label, section in (("handles", handles), ("retired", retired)):
        if not isinstance(section, dict) or set(section) != set(GROUP_KINDS):
            return problems + [f"{label} groups must be exactly {', '.join(GROUP_KINDS)}"]
    if pins and drift:
        if ledger["generationId"] != corpus["generationId"]:
            problems.append("generationId does not match data/lookup-manifest.json (run --write to append new items)")
        if ledger["booksSha256"] != corpus["booksSha256"]:
            problems.append("booksSha256 does not match data/books-dict.json (run --write to append new items)")
    for group in GROUP_KINDS:
        group_handles, group_retired = handles[group], retired[group]
        if not isinstance(group_handles, dict) or not isinstance(group_retired, dict):
            problems.append(f"{group}: handles and retired must be objects")
            continue
        expected = {item_id for item_id, _ in corpus["groups"][group]}
        if drift:
            for item_id in sorted(expected - set(group_handles) - set(group_retired)):
                problems.append(f"{group}: corpus id {item_id} has no slug")
            for item_id in sorted(set(group_handles) - expected):
                problems.append(f"{group}: ledger id {item_id} is not in the corpus (run --write to retire it)")
            for item_id in sorted(set(group_retired) & expected):
                problems.append(f"{group}: retired id {item_id} is back in the corpus (run --write to restore it)")
        for item_id in sorted(set(group_handles) & set(group_retired)):
            problems.append(f"{group}: {item_id} is both live and retired")
        seen: dict[str, str] = {}
        for mapping in (group_handles, group_retired):
            for item_id in sorted(mapping):
                value = mapping[item_id]
                if not isinstance(value, str) or not SLUG_SHAPE.fullmatch(value):
                    problems.append(f"{group}: {item_id} slug {value!r} is not a lowercase ASCII slug")
                    continue
                if value in seen and seen[value] != item_id:
                    problems.append(f"{group}: slug {value!r} is shared by {seen[value]} and {item_id}")
                seen[value] = item_id
    if ledger["handlesSha256"] != handles_digest(handles, retired):
        problems.append("handlesSha256 does not match handles and retired (ledger was edited by hand)")
    return problems


def _read_ledger(path: Path):
    return json.loads(path.read_bytes())


def write_ledger(*, data_dir, ledger_path, out=print) -> int:
    corpus = load_corpus(data_dir)
    ledger_path = Path(ledger_path)
    existing = retired = None
    if ledger_path.exists():
        previous = _read_ledger(ledger_path)
        # The frozen part must be intact, hand edits included; only pins, new, vanished and returned ids may differ.
        problems = ledger_problems(previous, corpus, pins=False, drift=False)
        if problems:
            raise LookupRouteHandleError("existing ledger is not extendable:\n" + "\n".join(problems))
        existing, retired = previous["handles"], previous["retired"]
    handles, retired_out, collisions = mint_handles(corpus, existing, retired)
    ledger = build_ledger(corpus, handles, retired_out)
    problems = ledger_problems(ledger, corpus)
    if problems:
        raise LookupRouteHandleError("minted ledger failed validation:\n" + "\n".join(problems))
    payload = ledger_bytes(ledger)
    added = sum(len(v) for v in handles.values()) - sum(len(v) for v in (existing or {}).values())
    newly_retired = sum(len(v) for v in retired_out.values()) - sum(len(v) for v in (retired or {}).values())
    for item in collisions:
        out(f"collision {item['group']}: {item['id']} {item['base']} -> {item['slug']}")
    if not ledger_path.exists() or ledger_path.read_bytes() != payload:
        ledger_path.write_bytes(payload)
    out(f"ledger: {sum(len(v) for v in handles.values())} ids, {added} net new, {newly_retired} net retired, {len(collisions)} new collisions -> {ledger_path}")
    return 0


def check_ledger(*, data_dir, ledger_path, out=print) -> int:
    corpus = load_corpus(data_dir)
    problems = ledger_problems(_read_ledger(Path(ledger_path)), corpus)
    if problems:
        raise LookupRouteHandleError("ledger failed validation:\n" + "\n".join(problems[:40]))
    total = sum(len(items) for items in corpus["groups"].values())
    out(f"ledger ok: {total} lookup ids frozen (generation {corpus['generationId'][:19]})")
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="python3 -m pipeline.lookup_route_handles", description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true", help="append slugs for ids missing from the ledger; frozen slugs never change")
    mode.add_argument("--check", action="store_true", help="validate the ledger against the corpus without deriving slugs")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--ledger", type=Path, default=DEFAULT_LEDGER_PATH)
    args = parser.parse_args(argv)
    try:
        if args.write:
            return write_ledger(data_dir=args.data_dir, ledger_path=args.ledger)
        return check_ledger(data_dir=args.data_dir, ledger_path=args.ledger)
    except (LookupRouteHandleError, OSError, ValueError, KeyError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
