"""Bounded SGSDeck source acquisition and parser helpers.

Network fetch/update and offline cache reads are intentionally separate. Site
builds and catalog queries never call this module's network path.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import tempfile
import urllib.request
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from typing import Callable, Iterable, Mapping, Optional, Set, Tuple
from urllib.parse import unquote, urlparse


ALLOWED_HOST = "sgsdeck.com"
CATEGORIES = {"generals", "tactics", "equipment", "advisors", "troop-mods", "buildings"}
ALLOWED_PATHS = {
    "/generals",
    "/tactics",
    "/equipment",
    "/advisors",
    "/troop-mods",
    "/buildings",
}
MAX_RESPONSE_BYTES = 4 * 1024 * 1024
_FLIGHT_PATTERN = re.compile(r"self\.__next_f\.push\((.*?)\)</script>", re.DOTALL)
_SAFE_KEY = re.compile(r"^[a-z0-9][a-z0-9-]{0,79}$")
_VOID_ELEMENTS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
_GENERAL_DETAIL_FIELDS = {
    "baseCommand", "baseForce", "baseWisdom", "basePolitics", "baseCharm", "baseSpeed",
    "growCommand", "growForce", "growWisdom", "growPolitics", "growCharm", "growSpeed",
    "adaptShield", "adaptBow", "adaptCavalry", "adaptSpear", "adaptInfantry",
    "adaptSiege", "adaptNavy", "innateTacticId", "inheritedTacticName", "role",
    "isCollectible", "collectibleBonus", "isDynamicOpen", "advisorSkillId",
    "exclusiveTitle", "civilRole", "civilSpecialty", "civilTacticBonus",
    "civilBonusDesc", "civilInnatePoints", "releaseSeason", "redRules",
}


class AllowlistedRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Reject an off-site redirect before urllib follows it."""

    def __init__(self, category: str):
        super().__init__()
        self.category = category

    def redirect_request(self, request, file_pointer, code, message, headers, new_url):
        validate_source_url(new_url, self.category)
        return super().redirect_request(
            request, file_pointer, code, message, headers, new_url
        )


def _stable_fallback(name: str) -> str:
    slug = re.sub(r"[^\w]+", "-", name.strip().casefold(), flags=re.UNICODE).strip("-")
    if not slug:
        raise ValueError("SGSDeck source name cannot produce a stable slug")
    return slug


def _next_flight_payload(html: str) -> str:
    chunks = []
    for match in _FLIGHT_PATTERN.finditer(html):
        try:
            value = json.loads(match.group(1))
        except json.JSONDecodeError:
            continue
        if isinstance(value, list) and len(value) > 1 and isinstance(value[1], str):
            chunks.append(value[1])
    if not chunks:
        raise ValueError("SGSDeck page has no readable Next flight payload")
    return "".join(chunks)


def _balanced_json(payload: str, start: int, opening: str = "["):
    closing = "]" if opening == "[" else "}"
    depth = 0
    quoted = False
    escaped = False
    for index in range(start, len(payload)):
        char = payload[index]
        if quoted:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                quoted = False
            continue
        if char == '"':
            quoted = True
        elif char == opening:
            depth += 1
        elif char == closing:
            depth -= 1
            if depth == 0:
                return json.loads(payload[start:index + 1])
    raise ValueError("SGSDeck hydration JSON is truncated")


def _prop_array(payload: str, key: str):
    marker = f'"{key}":['
    marker_at = payload.rfind(marker)
    if marker_at < 0:
        raise ValueError(f"SGSDeck hydration property is missing: {key}")
    return _balanced_json(payload, payload.find("[", marker_at + len(key) + 2))


def _prop_string(payload: str, key: str) -> Optional[str]:
    matches = list(re.finditer(rf'"{re.escape(key)}":"((?:\\.|[^"\\])*)"', payload))
    if not matches:
        return None
    return json.loads('"' + matches[-1].group(1) + '"')


def parse_general_detail(html: str):
    """Extract the source general's game fields, excluding prose and images."""
    payload = _next_flight_payload(html)
    marker = '"general":{'
    marker_at = payload.rfind(marker)
    if marker_at < 0:
        raise ValueError("SGSDeck general detail is missing its general object")
    raw = _balanced_json(payload, payload.find("{", marker_at), opening="{")
    source_id = str(raw.get("id") or "").strip()
    name = str(raw.get("nameZh") or "").strip()
    if not source_id or not name:
        raise ValueError("SGSDeck general detail is missing source identity")
    source_updated_at = raw.get("updatedAt")
    if isinstance(source_updated_at, str) and source_updated_at.startswith("$D"):
        source_updated_at = source_updated_at[2:]
    if source_updated_at is not None:
        _validate_timestamp(source_updated_at)
    return {
        "sourceId": source_id,
        "nameZh": name,
        "attributes": {key: raw.get(key) for key in sorted(_GENERAL_DETAIL_FIELDS)},
        "sourceUpdatedAt": source_updated_at,
    }


def parse_equipment_specials(html: str):
    """Extract equipment special traits as source-owned child records."""
    specials = _prop_array(_next_flight_payload(html), "specials")
    result = []
    for raw in specials:
        source_id = str(raw.get("id") or "").strip()
        name = str(raw.get("nameZh") or "").strip()
        if not source_id or not name:
            raise ValueError("SGSDeck equipment special is missing source identity")
        result.append({
            "sourceId": source_id,
            "nameZh": name,
            "tier": raw.get("tier"),
            "slot": raw.get("slot"),
            "description": raw.get("description"),
            "exclusiveEquipmentName": raw.get("exclusiveEquipmentName"),
            "exclusiveGeneralName": raw.get("exclusiveGeneralName"),
            "acquisitionSources": raw.get("acquisitionSources") or [],
        })
    return result


class _BuildingLevelParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_table = False
        self.in_row = False
        self.cell_tag = None
        self.cell_text = []
        self.current_row = []
        self.headers = []
        self.rows = []

    def handle_starttag(self, tag, attrs):
        if tag == "table" and not self.in_table:
            self.in_table = True
        elif self.in_table and tag == "tr":
            self.in_row = True
            self.current_row = []
        elif self.in_row and tag in {"th", "td"}:
            self.cell_tag = tag
            self.cell_text = []

    def handle_data(self, data):
        if self.cell_tag:
            self.cell_text.append(data)

    def handle_endtag(self, tag):
        if tag == self.cell_tag:
            self.current_row.append("".join(self.cell_text).strip())
            self.cell_tag = None
            self.cell_text = []
        elif tag == "tr" and self.in_row:
            if self.current_row:
                if not self.headers:
                    self.headers = self.current_row
                else:
                    self.rows.append(self.current_row)
            self.in_row = False
        elif tag == "table" and self.in_table:
            self.in_table = False


def _resource_number(value: str):
    compact = value.replace(",", "").strip()
    if compact in {"", "—", "-"}:
        return None
    if not compact.isdigit():
        raise ValueError(f"invalid SGSDeck building resource value: {value}")
    return int(compact)


def parse_building_levels(html: str):
    parser = _BuildingLevelParser()
    parser.feed(html)
    expected = ["等級", "木材", "鐵礦", "石材", "時間", "效果"]
    if parser.headers != expected:
        raise ValueError(f"unexpected SGSDeck building table headers: {parser.headers}")
    levels = []
    for cells in parser.rows:
        if len(cells) != len(expected):
            raise ValueError("SGSDeck building level row has an unexpected shape")
        match = re.fullmatch(r"Lv\s*(\d+)", cells[0])
        if not match:
            raise ValueError(f"invalid SGSDeck building level: {cells[0]}")
        levels.append({
            "level": int(match.group(1)),
            "costs": {
                "wood": _resource_number(cells[1]),
                "iron": _resource_number(cells[2]),
                "stone": _resource_number(cells[3]),
            },
            "duration": None if cells[4] in {"", "—", "-"} else cells[4],
            "effect": None if cells[5] in {"", "—", "-"} else cells[5],
        })
    if not levels:
        raise ValueError("SGSDeck building detail contains no levels")
    return levels


class _DetailLinkParser(HTMLParser):
    def __init__(self, category: str):
        super().__init__()
        self.category = category
        self.paths = []

    def handle_starttag(self, tag, attrs):
        if tag != "a":
            return
        href = dict(attrs).get("href", "")
        parsed = urlparse(href)
        path = parsed.path
        if parsed.scheme or parsed.netloc or not path.startswith(f"/{self.category}/"):
            return
        if self.category == "buildings" and path == "/buildings/calc":
            return
        if path not in self.paths:
            self.paths.append(path)


def discover_detail_urls(category: str, html: str):
    if category not in {"generals", "buildings"}:
        raise ValueError(f"SGSDeck detail discovery is unsupported for {category}")
    parser = _DetailLinkParser(category)
    parser.feed(html)
    urls = [f"https://{ALLOWED_HOST}{path}" for path in parser.paths]
    for url in urls:
        validate_source_url(url, category)
    return urls


def _variant(record: Mapping) -> str:
    name = str(record.get("nameZh", "")).strip()
    if name.upper().startswith("40Y"):
        return "40y"
    if record.get("isCO") or record.get("isMusou") or name.upper().startswith("CO ") or name.startswith("無雙"):
        return "co"
    if record.get("isSp") or name.upper().startswith("SP "):
        return "sp"
    return "base"


def _structured_records(category: str, records, source_season=None):
    normalized = []
    for raw in records:
        source_id = str(raw.get("id") or raw.get("slug") or _stable_fallback(raw["nameZh"]))
        attributes = {key: value for key, value in raw.items() if key not in {"id", "slug", "nameZh"}}
        if category == "generals":
            attributes["variant"] = _variant(raw)
        normalized.append({
            "sourceId": source_id,
            "nameZh": raw["nameZh"],
            "attributes": attributes,
            "sourceSeason": source_season,
            "sourceSlug": raw.get("slug"),
        })
    return normalized


class _RenderedCardParser(HTMLParser):
    def __init__(self, category: str):
        super().__init__()
        self.category = category
        self.depth = 0
        self.href = None
        self.text = []
        self.records = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "li" and self.depth == 0:
            self.depth = 1
            self.href = None
            self.text = []
            return
        if self.depth and tag not in _VOID_ELEMENTS:
            self.depth += 1
            if tag == "a" and values.get("href"):
                self.href = values["href"]

    def handle_startendtag(self, tag, attrs):
        # HTMLParser's default calls both handlers, which would close the card
        # depth for void tags such as <img />.
        self.handle_starttag(tag, attrs)

    def handle_data(self, data):
        if self.depth:
            value = " ".join(data.split())
            if value:
                self.text.append(value)

    def handle_endtag(self, tag):
        if not self.depth:
            return
        self.depth -= 1
        if self.depth:
            return
        if self.category == "equipment" and self.text:
            name = self.text[0]
            quality = self.text[1] if len(self.text) > 1 else None
            slot = self.text[2] if len(self.text) > 2 else None
            self.records.append({
                "sourceId": _stable_fallback(name),
                "nameZh": name,
                "attributes": {"quality": quality, "slot": slot},
                "sourceSeason": None,
                "missingFields": [
                    field for field, value in (("quality", quality), ("slot", slot))
                    if value is None
                ],
            })
        elif self.category == "buildings" and self.href and self.href.startswith("/buildings/"):
            slug = self.href.removeprefix("/buildings/").split("?", 1)[0]
            if slug and slug != "calc" and self.text:
                level = next((int(value) for index, value in enumerate(self.text)
                              if index > 0 and value.isdigit()), None)
                self.records.append({
                    "sourceId": slug,
                    "nameZh": self.text[0],
                    "attributes": {
                        "maxLevel": level,
                        "summary": next((value for value in self.text[1:] if len(value) > 8), None),
                        "mainCityOnly": "限主城" in self.text,
                    },
                    "sourceSeason": None,
                })


def _flight_equipment_records(html: str):
    """Parse keyed equipment cards from the inert React Flight model."""
    try:
        payload = _next_flight_payload(html)
    except ValueError:
        return None
    decoder = json.JSONDecoder()
    references = {}
    for match in re.finditer(r"(?m)^([0-9a-z]+):", payload):
        try:
            references[match.group(1)], _ = decoder.raw_decode(payload, match.end())
        except json.JSONDecodeError:
            continue

    def child_text(value, resolving=frozenset()):
        if isinstance(value, str):
            reference = re.fullmatch(r"\$L([0-9a-z]+)", value)
            if reference:
                key = reference.group(1)
                if key in resolving:
                    raise ValueError(f"cyclic SGSDeck Flight reference: {key}")
                if key not in references:
                    raise ValueError(f"missing SGSDeck Flight reference: {key}")
                return child_text(references[key], resolving | {key})
            return [] if value.startswith("$") else [value]
        if isinstance(value, list):
            if len(value) >= 4 and value[0] == "$" and isinstance(value[3], dict):
                return child_text(value[3].get("children"), resolving)
            result = []
            for child in value:
                result.extend(child_text(child, resolving))
            return result
        if isinstance(value, dict):
            return child_text(value.get("children"), resolving)
        return []

    records = []
    seen = {}
    marker = '["$","li","'
    position = 0
    while True:
        start = payload.find(marker, position)
        if start < 0:
            break
        try:
            card, position = decoder.raw_decode(payload, start)
        except json.JSONDecodeError as error:
            raise ValueError("invalid SGSDeck equipment Flight card") from error
        source_id = card[2]
        if source_id in seen:
            if seen[source_id] != card:
                raise ValueError(f"conflicting SGSDeck equipment Flight ID: {source_id}")
            continue
        seen[source_id] = card
        values = child_text(card[3].get("children"))
        if len(values) != 3 or not all(isinstance(value, str) and value.strip() for value in values):
            raise ValueError(f"ambiguous SGSDeck equipment Flight card: {source_id}")
        name, quality, slot = (value.strip() for value in values)
        records.append({
            "sourceId": source_id,
            "nameZh": name,
            "attributes": {"quality": quality, "slot": slot},
            "sourceSeason": None,
            "missingFields": [],
        })
    return records


def parse_category_page(category: str, html: str):
    """Parse one public category page into source-owned records."""
    if category in {"generals", "tactics", "advisors", "troop-mods"}:
        payload = _next_flight_payload(html)
        key = "tactics" if category == "troop-mods" else category
        season = None
        if category == "troop-mods":
            season = {
                "label": _prop_string(payload, "seasonCode"),
                "number": None,
                "scenarioName": _prop_string(payload, "seasonName"),
            }
        return _structured_records(category, _prop_array(payload, key), season)
    if category not in {"equipment", "buildings"}:
        raise ValueError(f"unsupported SGSDeck category: {category}")
    if category == "equipment":
        flight_records = _flight_equipment_records(html)
        if flight_records is not None:
            if not flight_records:
                raise ValueError("SGSDeck equipment Flight payload contains no keyed cards")
            return flight_records
    parser = _RenderedCardParser(category)
    parser.feed(html)
    if not parser.records:
        raise ValueError(f"SGSDeck {category} page contains no parseable records")
    return parser.records


def validate_source_url(url: str, category: Optional[str] = None) -> None:
    if not isinstance(url, str):
        raise ValueError("SGSDeck source URL must be a string")
    if any(char.isspace() or ord(char) < 32 for char in url) or "\\" in url:
        raise ValueError(f"SGSDeck source URL is outside the allowlist: {url}")
    parsed = urlparse(url)
    try:
        port = parsed.port
    except ValueError as error:
        raise ValueError(f"SGSDeck source URL is outside the allowlist: {url}") from error
    if (parsed.scheme != "https" or parsed.hostname != ALLOWED_HOST
            or parsed.username is not None or parsed.password is not None
            or port is not None or parsed.params or parsed.fragment):
        raise ValueError(f"SGSDeck source URL is outside the allowlist: {url}")
    if re.search(r"%(?![0-9A-Fa-f]{2})", parsed.path):
        raise ValueError(f"SGSDeck source URL is outside the allowlist: {url}")
    segments = parsed.path.split("/")
    is_root = parsed.path in ALLOWED_PATHS
    is_detail = len(segments) == 3 and segments[1] in {"generals", "buildings"} and bool(segments[2])
    if not (is_root or is_detail):
        raise ValueError(f"SGSDeck source URL is outside the allowlist: {url}")
    if is_detail:
        try:
            decoded = unquote(segments[2], errors="strict")
        except UnicodeDecodeError as error:
            raise ValueError(f"SGSDeck source URL is outside the allowlist: {url}") from error
        if (decoded in {".", ".."} or "/" in decoded or "\\" in decoded
                or any(char.isspace() or ord(char) < 32 for char in decoded)):
            raise ValueError(f"SGSDeck source URL is outside the allowlist: {url}")
        if segments[1] == "buildings" and decoded == "calc":
            raise ValueError(f"SGSDeck source URL is outside the allowlist: {url}")
    if parsed.query and not (parsed.path == "/equipment" and parsed.query == "tab=specials"):
        raise ValueError(f"SGSDeck source URL is outside the allowlist: {url}")
    if category and not (parsed.path == f"/{category}" or parsed.path.startswith(f"/{category}/")):
        raise ValueError(f"SGSDeck source URL does not match category {category}: {url}")


def _validate_resource_identity(category, key):
    if category not in CATEGORIES:
        raise ValueError(f"unsupported SGSDeck category: {category}")
    if not isinstance(key, str) or not _SAFE_KEY.fullmatch(key):
        raise ValueError(f"unsafe SGSDeck resource key: {key}")


def _validate_resource_url(category: str, key: str, url: str) -> None:
    validate_source_url(url, category)
    parsed = urlparse(url)
    if key in {"list", "normalized-source"}:
        valid = parsed.path == f"/{category}" and not parsed.query
    elif key == "specials":
        valid = category == "equipment" and url == "https://sgsdeck.com/equipment?tab=specials"
    elif key.startswith("detail-"):
        valid = category in {"generals", "buildings"} and parsed.path.startswith(f"/{category}/") and not parsed.query
    else:
        valid = False
    if not valid:
        raise ValueError(f"SGSDeck resource URL does not match {category}/{key}: {url}")


def _validate_timestamp(value):
    if not isinstance(value, str):
        raise ValueError("SGSDeck fetchedAt must be an ISO timestamp")
    try:
        parsed = datetime.fromisoformat(
            value[:-1] + "+00:00" if value.endswith("Z") else value
        )
    except ValueError as error:
        raise ValueError("SGSDeck fetchedAt must be an ISO timestamp") from error
    if parsed.tzinfo is None:
        raise ValueError("SGSDeck fetchedAt must include a timezone")


def load_offline_cache(cache_dir: Path, required: Set[Tuple[str, str]]):
    """Load and checksum a complete cache without any network fallback."""
    cache_dir = Path(cache_dir)
    manifest_path = cache_dir / "manifest.json"
    if not manifest_path.is_file():
        raise ValueError(f"SGSDeck cache manifest is missing: {manifest_path}")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"SGSDeck cache manifest is corrupt: {manifest_path}") from error
    if manifest.get("schemaVersion") != 1 or manifest.get("provider") != "sgsdeck" or manifest.get("region") != "TW":
        raise ValueError("SGSDeck cache manifest has an invalid contract")
    _validate_timestamp(manifest.get("fetchedAt"))
    if not isinstance(manifest.get("resources"), list):
        raise ValueError("SGSDeck cache manifest resources must be a list")
    resources = {}
    for item in manifest.get("resources", []):
        key = (item.get("category"), item.get("key"))
        _validate_resource_identity(*key)
        _validate_resource_url(*key, item.get("url", ""))
        if not isinstance(item.get("sha256"), str) or not re.fullmatch(r"[0-9a-f]{64}", item["sha256"]):
            raise ValueError(f"invalid cache checksum metadata: {key}")
        if key in resources:
            raise ValueError(f"duplicate cache resource: {key}")
        path = cache_dir / str(item.get("file", ""))
        expected_stem = f"{key[0]}-{key[1]}"
        if (path.parent != cache_dir or path.stem != expected_stem
                or path.suffix not in {".html", ".json"}
                or not path.is_file() or path.is_symlink()):
            raise ValueError(f"cache resource is missing or unsafe: {path.name}")
        body = path.read_bytes()
        if hashlib.sha256(body).hexdigest() != item.get("sha256"):
            raise ValueError(f"cache resource checksum mismatch: {path.name}")
        resources[key] = {"metadata": item, "body": body}
    missing = sorted(required - set(resources))
    if missing:
        raise ValueError(f"missing required cache resource: {missing}")
    return manifest, resources


def fetch_cache(
    cache_dir: Path,
    specs: Iterable[Mapping[str, str]],
    fetched_at: str,
    opener: Callable = urllib.request.urlopen,
) -> None:
    """Fetch an explicitly bounded resource set and promote the cache atomically."""
    cache_dir = Path(cache_dir)
    _validate_timestamp(fetched_at)
    cache_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=f".{cache_dir.name}-", dir=cache_dir.parent))
    resources = []
    seen = set()
    try:
        for spec in specs:
            _validate_resource_identity(spec.get("category"), spec.get("key"))
            identity = (spec["category"], spec["key"])
            if identity in seen:
                raise ValueError(f"duplicate SGSDeck fetch resource: {identity}")
            seen.add(identity)
            url = spec["url"]
            _validate_resource_url(spec["category"], spec["key"], url)
            request = urllib.request.Request(url, headers={"User-Agent": "CamNangTQCCL-SGSDeck/1.0"})
            transport = opener
            if opener is urllib.request.urlopen:
                transport = urllib.request.build_opener(
                    AllowlistedRedirectHandler(spec["category"])
                ).open
            with transport(request, timeout=30) as response:
                body = response.read(MAX_RESPONSE_BYTES + 1)
                final_url = response.geturl()
            _validate_resource_url(spec["category"], spec["key"], final_url)
            if len(body) > MAX_RESPONSE_BYTES:
                raise ValueError(f"SGSDeck response exceeds {MAX_RESPONSE_BYTES} bytes: {url}")
            name = f"{spec['category']}-{spec['key']}.html"
            (staging / name).write_bytes(body)
            resources.append({
                "category": spec["category"],
                "key": spec["key"],
                "url": final_url,
                "file": name,
                "sha256": hashlib.sha256(body).hexdigest(),
            })
        manifest = {
            "schemaVersion": 1,
            "provider": "sgsdeck",
            "region": "TW",
            "fetchedAt": fetched_at,
            "resources": resources,
        }
        (staging / "manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        backup = cache_dir.with_name(cache_dir.name + ".previous")
        if backup.exists():
            shutil.rmtree(backup)
        if cache_dir.exists():
            os.replace(cache_dir, backup)
        try:
            os.replace(staging, cache_dir)
        except BaseException:
            if backup.exists() and not cache_dir.exists():
                os.replace(backup, cache_dir)
            raise
        if backup.exists():
            try:
                shutil.rmtree(backup)
            except OSError:
                pass
    finally:
        if staging.exists():
            shutil.rmtree(staging)
