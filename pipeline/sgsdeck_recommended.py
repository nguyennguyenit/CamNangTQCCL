"""Offline Recommended list/detail evidence, separate from the six catalogs."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import tempfile
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qsl, unquote, urljoin, urlparse

MAX_SOURCE_BYTES = 4 * 1024 * 1024


class Node:
    def __init__(self, tag="root", attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []

    def walk(self, tag=None):
        if tag is None or self.tag == tag:
            yield self
        for child in self.children:
            if isinstance(child, Node):
                yield from child.walk(tag)

    @property
    def text(self):
        return "".join(child.text if isinstance(child, Node) else child for child in self.children).strip()


class RenderedPage(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        if not isinstance(html, str) or len(html.encode("utf-8")) > MAX_SOURCE_BYTES:
            raise ValueError("Recommended source exceeds its text bound")
        self.root = Node()
        self.stack = [self.root]
        self.feed(html)
        self.resolve_streamed_fields()

    def resolve_streamed_fields(self):
        """Rejoin rendered P/S placeholders without executing source scripts."""
        chunks = {}
        for node in self.root.walk():
            identifier = node.attrs.get("id", "")
            if identifier.startswith("S:"):
                if identifier in chunks:
                    raise ValueError("Duplicate rendered source chunk")
                chunks[identifier] = node
        consumed = set()

        def expand(node, active):
            children = []
            for child in node.children:
                if isinstance(child, Node):
                    identifier = child.attrs.get("id", "")
                    if child.tag == "template" and identifier.startswith("P:"):
                        target = chunks.get("S:" + identifier[2:])
                        if target is None or target in active or target in consumed:
                            raise ValueError("Incomplete or conflicting rendered source field")
                        consumed.add(target)
                        expand(target, active | {target})
                        children.extend(target.children)
                        continue
                    expand(child, active | {child})
                children.append(child)
            node.children = children

        def remove_consumed(node):
            node.children = [child for child in node.children if not isinstance(child, Node) or child not in consumed]
            for child in node.children:
                if isinstance(child, Node):
                    remove_consumed(child)

        expand(self.root, {self.root})
        remove_consumed(self.root)

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break

    def handle_data(self, data):
        if self.stack[-1].tag not in {"script", "style"}:
            self.stack[-1].children.append(data)


def validate_source_url(url):
    if not isinstance(url, str) or any(ord(c) < 33 for c in url):
        raise ValueError("Invalid Recommended URL")
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.netloc != "sgsdeck.com" or parsed.fragment:
        raise ValueError("Recommended source must use its public HTTPS origin")
    path = unquote(parsed.path)
    if not re.fullmatch(r"/recommended(?:/[^/?#\\\\]{1,128})?", path) or "/../" in path or path.endswith("/.."):
        raise ValueError("URL is outside Recommended")
    query = parse_qsl(parsed.query, keep_blank_values=True, strict_parsing=True) if parsed.query else []
    if len({key for key, _ in query}) != len(query) or any(key not in {"season", "category"} or not value or len(value) > 128 for key, value in query):
        raise ValueError("Unsupported Recommended query")
    if path != "/recommended" and query:
        raise ValueError("Detail query is unsupported")
    return url


def _number(text):
    if not text:
        return None
    if not re.fullmatch(r"\d+(?:\.\d+)?", text):
        raise ValueError("Source score must be a finite non-negative number")
    number = float(text)
    if not math.isfinite(number):
        raise ValueError("Source score must be finite")
    return int(number) if number.is_integer() else number


def parse_recommended_list(html, requested_scope=None):
    root = RenderedPage(html).root
    count = re.search(r"(\d+)\s*套[^。]*?配置", root.text)
    season = next((node.attrs.get("value") for node in root.walk("input") if node.attrs.get("name") == "season"), None)
    category = next((node.attrs.get("value") for node in root.walk("input") if node.attrs.get("name") == "category"), None)
    if count is None or not season or not category or len(season) > 128 or next(root.walk("h1"), Node()).text != "推薦隊伍 Tier List":
        raise ValueError("Recommended list structure changed")
    tiers = {}
    for section in root.walk("section"):
        heading = next((child for child in section.children if isinstance(child, Node) and child.tag == "div"), None)
        if heading is None:
            continue
        label = next((node.text for node in heading.walk("span") if re.fullmatch(r"T(?:0|0\.5|1|1\.5|2|3)|功能隊", node.text)), None)
        if label is not None:
            for link in section.walk("a"):
                href = link.attrs.get("href", "")
                if href in tiers:
                    raise ValueError("Conflicting Recommended tier grouping")
                tiers[href] = label
    records = []
    for link in root.walk("a"):
        href = link.attrs.get("href", "")
        if not href.startswith("/recommended/"):
            continue
        title = next(link.walk("h3"), None)
        if title is None:
            continue
        score = next((node.text for node in link.walk("span") if node.attrs.get("title", "").startswith("來源評分")), "")
        heroes = [node.text for node in link.walk("span") if "rounded-full" in node.attrs.get("class", "")]
        if len(heroes) > 3 and len(heroes) % 3:
            raise ValueError("Recommended list alternative holder structure changed")
        hero_sets = [heroes[index:index + 3] for index in range(0, len(heroes), 3)]
        url = validate_source_url(urljoin("https://sgsdeck.com", href))
        records.append({"sourceConfigId": href.rsplit("/", 1)[-1], "sourceUrl": url, "nameZh": title.text, "value": _number(score), "heroNames": hero_sets[0] if hero_sets else [], "alternativeHeroSetsRaw": hero_sets[1:], "tierRaw": tiers.get(href), "factionRaw": next((node.text.removeprefix("陣營：").strip() for node in link.walk("p") if node.text.startswith("陣營：")), None)})
    if len(records) != int(count.group(1)) or len({row["sourceConfigId"] for row in records}) != len(records):
        raise ValueError("Recommended list count or identity changed")
    result = {"expectedCount": int(count.group(1)) if count else 0, "sourceSeason": {"label": season}, "sourceCategoryId": category, "records": records}
    if requested_scope:
        requested_season = requested_scope.get("sourceSeasonId", requested_scope.get("season"))
        requested_category = requested_scope.get("sourceCategoryId", requested_scope.get("category"))
        if season != requested_season or category != requested_category:
            raise ValueError("Recommended list does not match requested scope")
    return result


def _field(card, label):
    for node in card.walk("div"):
        children = [child for child in node.children if isinstance(child, Node)]
        if children and children[0].tag == "span" and children[0].text == label:
            return children[1:]
    return []


def _recommended_holder_cards(root):
    return [
        card for card in root.walk("div")
        if {"sm:p-5", "p-4", "space-y-2"}.issubset(card.attrs.get("class", "").split())
        and next((node.text for node in card.walk("p") if "text-xl" in node.attrs.get("class", "")), "")
    ]


def _display_notes(root, cards):
    paragraphs = [
        node for node in root.walk("p")
        if "text-xl" not in node.attrs.get("class", "") and node.text
    ]
    owners = {}
    for card_index, card in enumerate(cards):
        owner = "primary" if card_index < 3 else "alternative"
        holder_index = card_index if card_index < 3 else card_index - 3
        for paragraph in card.walk("p"):
            if "text-xl" not in paragraph.attrs.get("class", "") and paragraph.text:
                owners[id(paragraph)] = (owner, holder_index)
    blocks = []
    for occurrence, paragraph in enumerate(paragraphs):
        owner, holder_index = owners.get(id(paragraph), ("team", None))
        block = {
            "id": f"p-{occurrence + 1}",
            "textRaw": paragraph.text,
            "owner": owner,
        }
        if holder_index is not None:
            block["holderIndex"] = holder_index
        blocks.append(block)
    return {"schemaVersion": 1, "blocks": blocks}


def _parse_recommended_detail_root(root, url):
    title = next(root.walk("h1"), Node()).text
    canonical = [node.attrs.get("href") for node in root.walk("link") if node.attrs.get("rel") == "canonical"]
    if len(canonical) != 1 or unquote(canonical[0]) != unquote(url) or not title:
        raise ValueError("Recommended detail identity mismatch")
    header = next((node for node in root.walk("header") if next(node.walk("h1"), None)), Node())
    score = next((node.text for node in header.walk("span") if "font-mono" in node.attrs.get("class", "")), "")
    label = next((node.text.split(" · ")[0] for node in header.walk("span") if " · " in node.text), "")
    if label.startswith("OG-"):
        label = "og-" + label[3:]
    else:
        label = label.lower()
    if not label:
        raise ValueError("Recommended detail has no source season")
    heroes = []
    cards = _recommended_holder_cards(root)
    for card in cards:
        hero = next((node.text for node in card.walk("p") if "text-xl" in node.attrs.get("class", "")), "")
        tactics = [re.sub(r"\[[A-Z]\]", "", "".join(node.text for node in _field(card, f"戰法 {index}"))).strip() for index in (1, 2)]
        books = [book.text for node in _field(card, "兵書") for book in node.walk("button")]
        role = next((node.text for node in card.walk("span") if re.fullmatch(r"主將|副將 \d+", node.text)), "")
        notes = "\n".join(node.text for node in card.walk("p") if "text-xl" not in node.attrs.get("class", ""))
        heroes.append({"roleRaw": role, "nameRaw": hero, "tacticSlotsRaw": tactics, "bookSlotsRaw": books, "statFocusRaw": "".join(node.text for node in _field(card, "加點")), "notesRaw": notes})
    expected_roles = ["主將"] + [f"副將 {index}" for index in range(1, len(heroes))]
    if len(heroes) < 2 or [hero["roleRaw"] for hero in heroes] != expected_roles:
        raise ValueError("Recommended detail must preserve source holder order")
    if any(not all(hero["tacticSlotsRaw"]) or len(hero["bookSlotsRaw"]) > 3 for hero in heroes):
        raise ValueError("Recommended detail slot structure changed")
    for hero in heroes:
        hero["bookSlotsRaw"] += [""] * (3 - len(hero["bookSlotsRaw"]))
    alternatives = heroes[3:]
    heroes = heroes[:3]
    if len(heroes) == 2:
        heroes.append({"roleRaw": "副將 2", "nameRaw": "", "tacticSlotsRaw": ["", ""],
                       "bookSlotsRaw": ["", "", ""], "statFocusRaw": "", "notesRaw": "",
                       "slotState": "source-empty"})
    unit_types = [node.text[1:] for node in root.walk("span") if node.text in {"#弓", "#騎", "#盾", "#槍", "#器械"}]
    return {"sourceConfigId": url.rsplit("/", 1)[-1], "sourceUrl": url, "nameZh": title, "value": _number(score), "sourceSeason": {"label": label}, "heroes": heroes, "alternativeHoldersRaw": alternatives, "unitTypesRaw": unit_types, "notesRaw": "\n".join(node.text for node in root.walk("p") if "text-xl" not in node.attrs.get("class", ""))}


def parse_recommended_detail(html, url):
    validate_source_url(url)
    return _parse_recommended_detail_root(RenderedPage(html).root, url)


def parse_recommended_detail_with_display_notes(html, url):
    """Return unchanged raw detail plus a display-only paragraph ownership projection."""
    validate_source_url(url)
    root = RenderedPage(html).root
    raw = _parse_recommended_detail_root(root, url)
    return raw, _display_notes(root, _recommended_holder_cards(root))


def join_recommended_evidence(listing, details):
    by_id = {row["sourceConfigId"]: row for row in listing["records"]}
    seen = set()
    for detail in details:
        identifier = detail["sourceConfigId"]
        row = by_id.get(identifier)
        if identifier in seen or row is None:
            raise ValueError("Duplicate or unlisted Recommended detail")
        seen.add(identifier)
        if any(detail[key] != row[key] for key in ["sourceUrl", "nameZh", "value"]) or detail["sourceSeason"] != listing["sourceSeason"]:
            raise ValueError("Recommended list/detail mismatch")
        if row["heroNames"] and row["heroNames"] != [hero["nameRaw"] for hero in detail["heroes"] if hero["nameRaw"]]:
            raise ValueError("Recommended holder mismatch")
    details = [{**detail, "tierRaw": by_id[detail["sourceConfigId"]].get("tierRaw"), "factionRaw": by_id[detail["sourceConfigId"]].get("factionRaw")} for detail in details]
    return {"schemaVersion": 1, "provider": "sgsdeck", "inventory": {"expected": listing["expectedCount"], "extracted": len(details), "missingDetails": listing["expectedCount"] - len(details)}, "sourceSeason": listing["sourceSeason"], "records": details}


def build_recommended_evidence(cache_dir, output):
    root = Path(cache_dir)
    items = json.loads((root / "manifest.json").read_text())
    if not isinstance(items, list) or not 1 <= len(items) <= 501:
        raise ValueError("Invalid Recommended cache inventory")
    listing, details, seen = None, [], set()
    for item in items:
        validate_source_url(item["url"])
        if item["url"] in seen:
            raise ValueError("Duplicate Recommended cache URL")
        seen.add(item["url"])
        path = item["path"]
        if not isinstance(path, str) or not re.fullmatch(r"[a-z0-9-]+\.html", path):
            raise ValueError("Invalid cache path")
        file = root / path
        if file.is_symlink() or not file.is_file() or file.stat().st_size > MAX_SOURCE_BYTES:
            raise ValueError("Invalid cache file")
        body = file.read_bytes()
        digest = hashlib.sha256(body).hexdigest()
        if digest != item["sha256"]:
            raise ValueError("Recommended cache checksum mismatch")
        try:
            datetime.fromisoformat(item["fetchedAt"].replace("Z", "+00:00"))
            html = body.decode("utf-8")
        except (ValueError, TypeError) as error:
            raise ValueError("Invalid Recommended cache metadata") from error
        if urlparse(item["url"]).path == "/recommended":
            if listing is not None:
                raise ValueError("One selected scope per evidence build is required")
            listing = parse_recommended_list(html)
            listing["sourceSnapshotHash"] = "sha256:" + digest
        else:
            detail = parse_recommended_detail(html, item["url"])
            detail.update({"sourceSnapshotHash": "sha256:" + digest, "provenance": {"provider": "sgsdeck", "region": "TW", "sourceUrl": item["url"], "fetchedAt": item["fetchedAt"]}, "canonicalRef": None, "reviewStatus": "pending"})
            details.append(detail)
    if listing is None:
        raise ValueError("Recommended cache is missing its list")
    result = join_recommended_evidence(listing, details)
    if result["inventory"]["missingDetails"]:
        raise ValueError("Recommended scope is incomplete; canonical evidence requires every listed detail")
    result["listSnapshotHash"] = listing["sourceSnapshotHash"]
    output = Path(output)
    if output.is_symlink():
        raise ValueError("Evidence output cannot be a symlink")
    if output.exists():
        previous = json.loads(output.read_text())
        if previous.get("sourceSeason") == result["sourceSeason"]:
            old_ids = {row["sourceConfigId"] for row in previous["records"]}
            if not old_ids.issubset({row["sourceConfigId"] for row in result["records"]}):
                raise ValueError("Recommended detail coverage shrank")
    output.parent.mkdir(parents=True, exist_ok=True)
    encoded = (json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + "\n").encode()
    with tempfile.TemporaryDirectory(prefix=".recommended-", dir=output.parent) as staging:
        candidate = Path(staging) / output.name
        candidate.write_bytes(encoded)
        os.replace(candidate, output)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("sgsdeck-recommended-evidence.json"))
    args = parser.parse_args()
    build_recommended_evidence(args.cache, args.output)


if __name__ == "__main__":
    main()
