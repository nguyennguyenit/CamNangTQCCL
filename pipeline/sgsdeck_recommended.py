"""Offline Recommended list/detail evidence, separate from the six catalogs."""
from __future__ import annotations

import math
import re
from html.parser import HTMLParser
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
        # Thẻ danh sách 2026-11 không còn điểm; điểm chỉ lấy từ trang chi tiết.
        rosters = [node for node in link.walk("ul") if node.attrs.get("aria-label") == "陣容"]
        if len(rosters) != 1:
            raise ValueError("Recommended list holder structure changed")
        heroes = [node.text for node in rosters[0].walk("li")]
        if len(heroes) < 2 or (len(heroes) > 3 and len(heroes) % 3):
            raise ValueError("Recommended list alternative holder structure changed")
        hero_sets = [heroes[index:index + 3] for index in range(0, len(heroes), 3)]
        factions = [node.text for node in link.walk("p") if node.text]
        if len(factions) > 1:
            raise ValueError("Recommended list faction structure changed")
        url = validate_source_url(urljoin("https://sgsdeck.com", href))
        records.append({"sourceConfigId": href.rsplit("/", 1)[-1], "sourceUrl": url, "nameZh": title.text, "heroNames": hero_sets[0], "alternativeHeroSetsRaw": hero_sets[1:], "tierRaw": tiers.get(href), "factionRaw": factions[0] if factions else None})
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


# Nhãn hàng trong thẻ tướng. 特技 (trang bị) và 替代 (chiến pháp thay thế từng tướng)
# chưa thuộc schema nên không đọc; nhãn lạ làm trang nguồn bị chặn thay vì rơi im lặng.
HOLDER_ROW_LABELS = {"戰法 1", "戰法 2", "兵書", "加點"}
HOLDER_ROW_LABELS_NOT_CAPTURED = {"特技", "替代"}
# Layout 開荒 theo cấp: 「20 級前」 một chiến pháp, rồi 「20 級後」 và một hàng không nhãn
# là hai ô chiến pháp sau cấp 20.
PHASE_ROW_LABELS = ("20 級前", "20 級後", "")


def _holder_rows(card):
    rows = []
    for node in card.walk("div"):
        children = [child for child in node.children if isinstance(child, Node)]
        if (len(children) > 1 and children[0].tag == "span"
                and "text-text-muted" in children[0].attrs.get("class", "").split()):
            rows.append((children[0].text, children[1:]))
    return rows


def _tactic_text(nodes):
    return re.sub(r"\[[A-Z]\]", "", "".join(node.text for node in nodes)).strip()


def _holder_tactics(card):
    """Two source tactic slots plus the optional pre-level-20 tactic of the 開荒 layout."""
    rows = [(label, nodes) for label, nodes in _holder_rows(card) if not re.fullmatch(r"主將|副將 \d+", label)]
    labels = [label for label, _ in rows]
    for label in labels:
        if label not in HOLDER_ROW_LABELS and label not in HOLDER_ROW_LABELS_NOT_CAPTURED and label not in PHASE_ROW_LABELS:
            raise ValueError("Recommended holder row label is unsupported: " + repr(label))
    if not any(label in PHASE_ROW_LABELS for label in labels):
        return [_tactic_text(_field(card, f"戰法 {index}")) for index in (1, 2)], None
    start = labels.index(PHASE_ROW_LABELS[0]) if PHASE_ROW_LABELS[0] in labels else -1
    phased = rows[start:start + len(PHASE_ROW_LABELS)] if start >= 0 else []
    if ([label for label, _ in phased] != list(PHASE_ROW_LABELS)
            or sum(label in PHASE_ROW_LABELS for label in labels) != len(PHASE_ROW_LABELS)
            or "戰法 1" in labels or "戰法 2" in labels
            or any(len([button for node in nodes for button in node.walk("button")]) != 1 for _, nodes in phased)):
        raise ValueError("Recommended holder level-phase structure changed")
    before, after, continued = (_tactic_text(nodes) for _, nodes in phased)
    return [after, continued], before


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
    score_labels = [node for node in header.walk("span") if node.attrs.get("title", "").startswith("資料來源的評分")]
    if len(score_labels) > 1:
        raise ValueError("Recommended detail score structure changed")
    score = next((node.text for label_node in score_labels for node in label_node.walk("span") if "tabular" in node.attrs.get("class", "").split()), "")
    factions = [node.text.removeprefix("陣營：").strip() for node in header.walk("span") if node.text.startswith("陣營：")]
    if len(factions) > 1 or any(not faction for faction in factions):
        raise ValueError("Recommended detail faction structure changed")
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
        tactics, before_level_20 = _holder_tactics(card)
        hero = next((node.text for node in card.walk("p") if "text-xl" in node.attrs.get("class", "")), "")
        books = [book.text for node in _field(card, "兵書") for book in node.walk("button")]
        role = next((node.text for node in card.walk("span") if re.fullmatch(r"主將|副將 \d+", node.text)), "")
        notes = "\n".join(node.text for node in card.walk("p") if "text-xl" not in node.attrs.get("class", ""))
        holder = {"roleRaw": role, "nameRaw": hero, "tacticSlotsRaw": tactics, "bookSlotsRaw": books, "statFocusRaw": "".join(node.text for node in _field(card, "加點")), "notesRaw": notes}
        if before_level_20 is not None:
            if not before_level_20:
                raise ValueError("Recommended detail slot structure changed")
            holder["tacticBeforeLevel20Raw"] = before_level_20
        heroes.append(holder)
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
    return {"sourceConfigId": url.rsplit("/", 1)[-1], "sourceUrl": url, "nameZh": title, "value": _number(score), "factionRaw": factions[0] if factions else None, "sourceSeason": {"label": label}, "heroes": heroes, "alternativeHoldersRaw": alternatives, "unitTypesRaw": unit_types, "notesRaw": "\n".join(node.text for node in root.walk("p") if "text-xl" not in node.attrs.get("class", ""))}


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
        if any(detail[key] != row[key] for key in ["sourceUrl", "nameZh"]) or detail["sourceSeason"] != listing["sourceSeason"]:
            raise ValueError("Recommended list/detail mismatch")
        if row["heroNames"] != [hero["nameRaw"] for hero in detail["heroes"] if hero["nameRaw"]]:
            raise ValueError("Recommended holder mismatch")
        if row["factionRaw"] and detail["factionRaw"] and row["factionRaw"] != detail["factionRaw"]:
            raise ValueError("Recommended list/detail faction mismatch")
    # Điểm và phe lấy từ trang chi tiết (thẻ danh sách không còn điểm, phe có thể vắng).
    details = [{**detail, "tierRaw": by_id[detail["sourceConfigId"]].get("tierRaw"), "factionRaw": detail["factionRaw"] or by_id[detail["sourceConfigId"]].get("factionRaw")} for detail in details]
    return {"schemaVersion": 1, "provider": "sgsdeck", "inventory": {"expected": listing["expectedCount"], "extracted": len(details), "missingDetails": listing["expectedCount"] - len(details)}, "sourceSeason": listing["sourceSeason"], "records": details}
