"""Resumable stdlib acquisition for public SGSDeck Recommended pages."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, unquote, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

from pipeline.sgsdeck_recommended import (
    MAX_SOURCE_BYTES,
    RenderedPage,
    parse_recommended_detail,
    parse_recommended_list,
    validate_source_url,
)

CATEGORIES = ("開荒", "交戰", "器械")
MAX_URLS = 10000
MAX_CACHE_BYTES = 1024 * 1024 * 1024
class SafeRecommendedRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validate_source_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


SAFE_OPENER = build_opener(SafeRecommendedRedirect)



def canonical_json(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def safe_scope_key(season, category):
    raw = canonical_json([season, category]).encode()
    return "s-" + hashlib.sha256(raw).hexdigest()


def discover_scopes(html):
    root = RenderedPage(html).root
    options = []
    seen = set()
    for node in root.walk():
        if node.attrs.get("role") != "option":
            continue
        text = node.attrs.get("aria-label", node.text).strip()
        match = re.match(r"(OG-\S+|PK-S\d+|S\d+)\s+([^（]+)(?:（(?:(\d+)\s*套)?[^）]*）)?$", text)
        if not match:
            continue
        label, remainder, count = match.groups()
        identifier = label.lower()
        if identifier in seen:
            raise ValueError("Duplicate source season")
        seen.add(identifier)
        unavailable = "尚未收錄" in text
        options.append({"sourceSeasonId": identifier, "label": label,
                        "nameRaw": remainder.replace("預先收錄", "").strip(),
                        "status": "uncollected" if unavailable else "available",
                        "advertisedCountRaw": int(count) if count else 0 if unavailable else None,
                        "sourceOrder": len(options)})
    if not options:
        raise ValueError("Rendered source season picker is required")
    scopes = []
    for season in options:
        for category in CATEGORIES:
            source_id = season["sourceSeasonId"] + "|" + category
            scopes.append({"sourceScopeId": source_id, "safeScopeKey": safe_scope_key(season["sourceSeasonId"], category),
                           "sourceSeasonId": season["sourceSeasonId"], "sourceCategoryId": category,
                           "requestedQuery": {"season": season["sourceSeasonId"], "category": category},
                           "state": "uncollected-season" if season["status"] == "uncollected" else "pending"})
    payload = {"schemaVersion": 2, "seasonOptions": options, "scopes": scopes}
    payload["inventoryHash"] = "sha256:" + hashlib.sha256(canonical_json(payload).encode()).hexdigest()
    return payload


def _atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + "\n").encode()
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as handle:
        handle.write(encoded)
        temporary = Path(handle.name)
    os.replace(temporary, path)


def _read_manifest(cache):
    path = cache / "manifest.json"
    return json.loads(path.read_text()) if path.exists() else {"schemaVersion": 2, "pages": {}, "scopes": []}


def _store_page(cache, manifest, url, body, transport, fetched_at=None):
    validate_source_url(url)
    if len(body) > MAX_SOURCE_BYTES:
        raise ValueError("Recommended source exceeds page bound")
    digest = hashlib.sha256(body).hexdigest()
    filename = digest + ".html"
    (cache / filename).write_bytes(body)
    manifest.setdefault("pages", {})[url] = {"originalUrl": url, "finalUrl": url, "status": 200,
        "fetchedAt": fetched_at or datetime.now(timezone.utc).isoformat(), "sha256": digest,
        "path": filename, "transport": transport}


def fetch_page(url, timeout=30):
    validate_source_url(url)
    parsed = urlparse(url)
    request_url = parsed._replace(path=quote(unquote(parsed.path), safe="/%-")).geturl()
    delays = (0, 2, 4)
    for attempt, delay in enumerate(delays):
        if delay:
            time.sleep(delay)
        try:
            request = Request(request_url, headers={"User-Agent": "CamNangTQCCL Recommended maintainer/1"})
            with SAFE_OPENER.open(request, timeout=timeout) as response:
                final = response.geturl()
                validate_source_url(final)
                if unquote(urlparse(final).path) != unquote(parsed.path) or urlparse(final).query != parsed.query:
                    raise ValueError("Recommended redirect changed source identity")
                body = response.read(MAX_SOURCE_BYTES + 1)
                if len(body) > MAX_SOURCE_BYTES:
                    raise ValueError("Recommended source exceeds page bound")
                return url, response.status, body
        except HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise
        except (TimeoutError, URLError):
            if attempt == 2:
                raise
    raise RuntimeError("unreachable")


def record_rendered_page(inventory, cache, capture):
    cache = Path(cache)
    data = json.loads(Path(capture).read_text()) if isinstance(capture, (str, Path)) else capture
    if data.get("status") != 200 or data.get("requestedScopeId") not in {s["sourceScopeId"] for s in inventory["scopes"]}:
        raise ValueError("Rendered capture does not belong to the frozen inventory")
    source = Path(data["htmlFile"])
    if source.is_symlink() or not source.is_file():
        raise ValueError("Invalid rendered capture file")
    body = source.read_bytes()
    if hashlib.sha256(body).hexdigest() != data["sha256"]:
        raise ValueError("Rendered capture checksum mismatch")
    manifest = _read_manifest(cache)
    _store_page(cache, manifest, data["finalUrl"], body, "browser-rendered", data["fetchedAt"])
    _atomic_json(cache / "manifest.json", manifest)
    return manifest


def crawl_scope(inventory, cache, scope, minimum_interval=1):
    cache = Path(cache)
    cache.mkdir(parents=True, exist_ok=True)
    manifest = _read_manifest(cache)
    cached_inventory_hash = manifest.get("inventoryHash")
    if cached_inventory_hash and cached_inventory_hash != inventory["inventoryHash"]:
        raise ValueError("Recommended resume inventory changed")
    manifest["inventoryHash"] = inventory["inventoryHash"]
    manifest["seasonOptions"] = inventory["seasonOptions"]
    scope_states = {item["sourceScopeId"]: item for item in manifest.setdefault("scopes", [])}
    state = scope_states.get(scope["sourceScopeId"])
    if state is None:
        state = dict(scope)
        manifest["scopes"].append(state)
    query = scope["requestedQuery"]
    list_url = "https://sgsdeck.com/recommended?season=" + quote(query["season"]) + "&category=" + quote(query["category"])

    def load(url):
        cached = manifest.get("pages", {}).get(url)
        if cached:
            body = (cache / cached["path"]).read_bytes()
            if hashlib.sha256(body).hexdigest() != cached["sha256"]:
                raise ValueError("Cached Recommended checksum mismatch")
            return body
        if len(manifest.get("pages", {})) >= MAX_URLS:
            raise ValueError("Recommended URL cap reached")
        started = time.monotonic()
        final, status, body = fetch_page(url)
        if final != url or status != 200:
            raise ValueError("Recommended response identity changed")
        _store_page(cache, manifest, url, body, "python-http")
        _atomic_json(cache / "manifest.json", manifest)
        remaining = minimum_interval - (time.monotonic() - started)
        if remaining > 0:
            time.sleep(remaining)
        return body

    try:
        listing_body = load(list_url)
        listing = parse_recommended_list(listing_body.decode("utf-8"), requested_scope=query)
        if listing["sourceSeason"]["label"] != query["season"]:
            raise ValueError("Returned Recommended scope differs from request")
        detail_urls = [row["sourceUrl"] for row in listing["records"]]
        for row in listing["records"]:
            detail = parse_recommended_detail(load(row["sourceUrl"]).decode("utf-8"), row["sourceUrl"])
            if detail["sourceConfigId"] != row["sourceConfigId"]:
                raise ValueError("Recommended detail identity changed")
        state.update({
            "state": "empty-category" if not detail_urls else "complete",
            "reason": None,
            "listUrl": list_url,
            "listSha256": hashlib.sha256(listing_body).hexdigest(),
            "orderedDetailUrls": detail_urls,
            "advertisedCountRaw": listing["expectedCount"],
            "advertisedCountMeaning": "scope",
            "observedCardCount": len(detail_urls),
            "missingUrls": [],
        })
    except Exception as error:
        state.update({"state": "blocked", "reason": str(error)})
        _atomic_json(cache / "manifest.json", manifest)
        raise
    if sum((cache / page["path"]).stat().st_size for page in manifest["pages"].values()) > MAX_CACHE_BYTES:
        state.update({"state": "blocked", "reason": "Recommended cache cap reached"})
        _atomic_json(cache / "manifest.json", manifest)
        raise ValueError("Recommended cache cap reached")
    _atomic_json(cache / "manifest.json", manifest)
    return manifest


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--freeze-inventory", type=Path, metavar="PICKER_HTML",
                        help="write <cache>/scope-inventory.json from a rendered season-picker page")
    parser.add_argument("--all-source-scopes", action="store_true")
    parser.add_argument("--import-rendered-page", type=Path)
    args = parser.parse_args(argv)
    inventory_path = args.cache / "scope-inventory.json"
    if args.freeze_inventory:
        _atomic_json(inventory_path, discover_scopes(args.freeze_inventory.read_text(encoding="utf-8")))
        return
    if not inventory_path.exists():
        raise SystemExit(
            "scope-inventory.json is required; save the rendered picker page and run "
            "--freeze-inventory <picker.html> first"
        )
    inventory = json.loads(inventory_path.read_text())
    if args.import_rendered_page:
        record_rendered_page(inventory, args.cache, args.import_rendered_page)
    elif args.all_source_scopes:
        # Cache manifest là điểm tiếp tục: trang đã lưu được đọc lại, không tải lại.
        for scope in inventory["scopes"]:
            if scope["state"] != "uncollected-season":
                crawl_scope(inventory, args.cache, scope)


if __name__ == "__main__":
    main()
