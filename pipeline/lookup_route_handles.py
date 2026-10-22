"""Freeze one URL slug per Tra cứu (lookup) corpus item: `/tra-cuu/<group>/<slug>/`.

The corpus is the one `buildLookupCorpus` (js/unified-lookup.js) assembles from data/heroes-dict.json,
data/tactics.json, data/lookup-catalog.json and data/books-dict.json. Those are plain JSON files, so the
ids are read straight from them (every book row carries its frozen `id`, written by hand in
pipeline/books-han-viet-map.json and copied by pipeline/build_books_dict.py) instead of spawning node; the slug rule below mirrors `lookupSlug` there and tests/test_lookup_route_handles.py pins it.
`equipment-special:*` records are not routes (they live inside their equipment page).

Assignment is one-time: `--write` slugs every id missing from the ledger from its Vietnamese name (collision
inside a group gets `-2`, `-3`, … in corpus order) and never touches a slug that is already frozen, even if
the name changed. An id that vanished from the corpus is moved to `retired` (`{group: {id: slug}}`): its slug
stays reserved so it is never issued again, the TS loader ignores `retired`, and the id gets the same slug back
if it returns. `handlesSha256` covers `handles` and `retired`, so `--write` refuses a hand-edited ledger.
`--check` only validates the ledger against the current corpus and never re-derives a slug.

Both modes also own `public/_redirects` (Cloudflare Pages): one 301 per locale from the retired slug of every
tactic merged into a survivor (`lookup.formerIds` of data/tactics.json) to the survivor's live slug. `--write`
regenerates it from the ledger it just wrote; `--check` fails when the committed file is stale. A retired id no
survivor lists keeps its static 404.
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
DEFAULT_REDIRECTS_PATH = REPO_ROOT / "public" / "_redirects"
DEFAULT_RECOMMENDED_ROOT = REPO_ROOT / "src" / "data" / "recommended-reference"
REDIRECTS_HEADER = "# Sinh bởi python3 -m pipeline.lookup_route_handles --write; không sửa tay."
# Locale prefixes of the tactic detail route (src/lib/lookup-detail-routes.ts); zh group slugs equal vi ones.
REDIRECT_LOCALE_PREFIXES = ("", "/zh")

LEDGER_NOTE = (
    "Slug URL gán một lần cho mỗi id, tên đổi không đổi slug. Id binh thư ghi cố định trong "
    "pipeline/books-han-viet-map.json (viết tay, không suy từ tên Việt); id binh thư mới do người thêm viết."
)
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


BOOK_ID_SHAPE = re.compile(r"book:[a-z0-9]+(?:-[a-z0-9]+)*")


def _book_id(row: dict) -> str:
    """The frozen `id` of a books-dict row; a row without a valid one fails closed (never slugged from a name)."""
    value = row.get("id") if isinstance(row, dict) else None
    if not isinstance(value, str) or not BOOK_ID_SHAPE.fullmatch(value):
        raise LookupRouteHandleError(f"books-dict.json row has no valid frozen `id` (book:<slug>): {value!r}")
    return value


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
    groups["books"] = [(_book_id(row), _name(row)) for row in (books if isinstance(books, list) else [])]
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


def former_owner_map(data_dir) -> dict[str, str]:
    """`{retired tactic id: survivor id}` from `lookup.formerIds` of data/tactics.json; missing keys are data errors."""
    owners: dict[str, str] = {}
    for row in _load(Path(data_dir) / "tactics.json"):
        for former in row["lookup"]["formerIds"]:
            if former in owners:
                raise LookupRouteHandleError(f"{former} is a former id of both {owners[former]} and {row['id']}")
            owners[former] = row["id"]
    return owners


def season_redirect_lines(recommended_root) -> list[str]:
    """`/doi-chuan/<slug>/ /doi-chuan/ 301` per locale for the current season of the pinned Recommended registry.

    A root without `current.json` (a fixture, a checkout without the data) has no season rule; a registry whose default
    season has no usable `displayCode` is a data error.
    """
    if recommended_root is None:
        return []
    root = Path(recommended_root)
    current = root / "current.json"
    if not current.exists():
        return []
    generation = json.loads(current.read_bytes())["generationId"]
    registry = json.loads((root / generation / "seasons.json").read_bytes())
    default_id = registry.get("defaultSourceSeasonId")
    option = next((item for item in registry.get("seasonOptions", []) if item.get("sourceSeasonId") == default_id), None)
    if option is None:
        return []
    slug = str(option.get("displayCode") or "").lower()
    if not SLUG_SHAPE.fullmatch(slug):
        raise LookupRouteHandleError(f"default season {default_id} has no usable page slug: {option.get('displayCode')!r}")
    return [f"{prefix}/doi-chuan/{slug}/ {prefix}/doi-chuan/ 301" for prefix in REDIRECT_LOCALE_PREFIXES]


def redirects_bytes(former_map: dict[str, str], ledger: dict, season_lines=()) -> bytes:
    """Cloudflare Pages `_redirects`: per merged tactic, `old new 301` for each locale, sorted by retired id; then the season rule."""
    retired, live = ledger["retired"]["tactics"], ledger["handles"]["tactics"]
    lines = [REDIRECTS_HEADER]
    for retired_id in sorted(former_map):
        survivor_id = former_map[retired_id]
        if retired_id not in retired:
            raise LookupRouteHandleError(f"former id {retired_id} of {survivor_id} has no retired slug in the ledger")
        if survivor_id not in live:
            raise LookupRouteHandleError(f"survivor {survivor_id} of {retired_id} has no live slug in the ledger")
        for prefix in REDIRECT_LOCALE_PREFIXES:
            lines.append(f"{prefix}/tra-cuu/chien-phap/{retired[retired_id]}/ {prefix}/tra-cuu/chien-phap/{live[survivor_id]}/ 301")
    lines.extend(season_lines)
    return ("\n".join(lines) + "\n").encode("utf-8")


def write_ledger(*, data_dir, ledger_path, redirects_path=DEFAULT_REDIRECTS_PATH, recommended_root=None, out=print) -> int:
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
    redirects_path = Path(redirects_path)
    redirects = redirects_bytes(former_owner_map(data_dir), ledger, season_redirect_lines(recommended_root))
    if not redirects_path.exists() or redirects_path.read_bytes() != redirects:
        redirects_path.write_bytes(redirects)
    rules = redirects.count(b"\n") - 1
    out(f"redirects: {rules} rules -> {redirects_path}")
    return 0


def check_ledger(*, data_dir, ledger_path, redirects_path=DEFAULT_REDIRECTS_PATH, recommended_root=None, out=print) -> int:
    corpus = load_corpus(data_dir)
    ledger = _read_ledger(Path(ledger_path))
    problems = ledger_problems(ledger, corpus)
    if problems:
        raise LookupRouteHandleError("ledger failed validation:\n" + "\n".join(problems[:40]))
    redirects_path = Path(redirects_path)
    redirects = redirects_bytes(former_owner_map(data_dir), ledger, season_redirect_lines(recommended_root))
    if not redirects_path.exists() or redirects_path.read_bytes() != redirects:
        raise LookupRouteHandleError(f"{redirects_path} is stale; run --write")
    total = sum(len(items) for items in corpus["groups"].values())
    rules = redirects.count(b"\n") - 1
    out(f"ledger ok: {total} lookup ids frozen (generation {corpus['generationId'][:19]}), {rules} redirect rules")
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="python3 -m pipeline.lookup_route_handles", description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true", help="append slugs for ids missing from the ledger; frozen slugs never change")
    mode.add_argument("--check", action="store_true", help="validate the ledger against the corpus without deriving slugs")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--ledger", type=Path, default=DEFAULT_LEDGER_PATH)
    parser.add_argument("--redirects", type=Path, default=DEFAULT_REDIRECTS_PATH)
    parser.add_argument("--recommended-root", type=Path, default=DEFAULT_RECOMMENDED_ROOT, help="pinned Recommended generation root (season-page redirect)")
    args = parser.parse_args(argv)
    try:
        if args.write:
            return write_ledger(data_dir=args.data_dir, ledger_path=args.ledger, redirects_path=args.redirects, recommended_root=args.recommended_root)
        return check_ledger(data_dir=args.data_dir, ledger_path=args.ledger, redirects_path=args.redirects, recommended_root=args.recommended_root)
    except (LookupRouteHandleError, OSError, ValueError, KeyError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
