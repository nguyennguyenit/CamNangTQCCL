"""Trợ lý seasonal (suggest-only): parse FILE HTML nguồn tier TQ lưu sẵn -> in
gợi ý {tên đội TQ, tier, team id gợi ý} để người duyệt tay vào team-tier-map.json.

[Audit A4] KHÔNG live-fetch (zhihu/taptap chặn anti-bot/JS-render -> 403/login
wall). Người tải trang tay trên browser -> lưu .html -> chạy tool offline.
KHÔNG auto-ghi map, KHÔNG vào runtime. Fail mềm (in cảnh báo, không raise chặn).

Map team id = khớp composition tướng (Hán -> Việt qua heroes-dict) với teams.json
— đáng tin hơn so khớp tên đội cross-language. Chỉ là GỢI Ý, người duyệt quyết.

Dùng:
    python3 -m pipeline.suggest_team_tier path/to/saved-tier-list.html
"""

from __future__ import annotations

import json
import os
import re
import sys
from html.parser import HTMLParser
from typing import Optional

_DIR = os.path.dirname(__file__)
_DATA = os.path.join(_DIR, "..", "data")

# Tier token đầu chuỗi (heading): T0 / T0.5 / T1 / T1.5 / T2 / T3.
_TIER_RE = re.compile(r"^T([0-3])(\.5)?\b")
_HERO_SEP = re.compile(r"[/、,，]")
_NAME_SEP = re.compile(r"[-–—:：|]")
_CJK = re.compile(r"[一-鿿]")


# Tag chứa tier-header (xếp hạng) vs tag chứa 1 đội (item danh sách/bảng).
_HEAD_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6", "strong", "b"}
_ITEM_TAGS = {"li", "td", "th"}


class _TaggedChunks(HTMLParser):
    """Gom (kind, text) theo thứ tự: kind = head | item (bỏ text ngoài 2 nhóm,
    tránh false positive từ <p> giải thích)."""

    def __init__(self) -> None:
        super().__init__()
        self.chunks: list[tuple[str, str]] = []
        self._stack: list[str] = []

    def handle_starttag(self, tag, attrs):
        self._stack.append(tag)

    def handle_endtag(self, tag):
        if tag in self._stack:
            # pop tới đúng tag (chịu lỗi HTML không cân bằng nhẹ).
            while self._stack and self._stack.pop() != tag:
                pass

    def handle_data(self, data: str) -> None:
        text = data.strip()
        if not text:
            return
        if any(t in _ITEM_TAGS for t in self._stack):
            self.chunks.append(("item", text))
        elif any(t in _HEAD_TAGS for t in self._stack):
            self.chunks.append(("head", text))


def parse_team_tier_suggestions(html: str) -> list[dict]:
    """HTML -> [{team, tier, heroesCn[]}]. Hàm thuần (test bằng fixture).

    Heading (h*/strong) bắt đầu bằng 'T<digit>' -> set tier hiện tại. Item
    (li/td) sau đó -> 1 đội: phần trước dấu phân tách là tên đội, phần sau tách
    thành danh sách tướng.
    """
    parser = _TaggedChunks()
    parser.feed(html)
    out: list[dict] = []
    cur_tier: Optional[str] = None
    for kind, text in parser.chunks:
        m = _TIER_RE.match(text)
        if kind == "head" and m and not _CJK.match(text):
            cur_tier = "T" + m.group(1) + (m.group(2) or "")
            continue
        if kind == "item" and cur_tier and _CJK.search(text):
            parts = _NAME_SEP.split(text, 1)
            team = parts[0].strip()
            heroes = []
            if len(parts) > 1:
                heroes = [h.strip() for h in _HERO_SEP.split(parts[1]) if h.strip()]
            out.append({"team": team, "tier": cur_tier, "heroesCn": heroes})
    return out


def guess_team_id(sug: dict, teams: list, heroes_dict: list) -> dict:
    """Khớp 1 gợi ý -> team id bằng composition tướng (Hán->Việt). Trả best match
    {teamId, score, teamName} (score = số tướng khớp). Không khớp -> teamId None."""
    cn_to_viet = {h["chinese"]: h["hanViet"] for h in heroes_dict}
    want = {cn_to_viet.get(cn) for cn in sug.get("heroesCn", [])}
    want.discard(None)
    best_id, best_score, best_name = None, 0, None
    for t in teams:
        names = {h.get("baseName") for h in t.get("heroes", [])}
        score = len(want & names)
        if score > best_score:
            best_id, best_score, best_name = t["id"], score, t.get("nickname") or t.get("name")
    return {"teamId": best_id, "score": best_score, "teamName": best_name}


def main(path: str) -> None:
    if not os.path.exists(path):
        print(f"[cảnh báo] không thấy file: {path}", file=sys.stderr)
        return
    with open(path, encoding="utf-8") as fh:
        html = fh.read()
    with open(os.path.join(_DATA, "teams.json"), encoding="utf-8") as fh:
        teams = json.load(fh)
    with open(os.path.join(_DATA, "heroes-dict.json"), encoding="utf-8") as fh:
        heroes_dict = json.load(fh)

    suggestions = parse_team_tier_suggestions(html)
    if not suggestions:
        print("[cảnh báo] không trích được đội nào — có thể HTML đổi cấu trúc, sửa parser.", file=sys.stderr)
        return

    print("# GỢI Ý tier (suggest-only, PHẢI duyệt tay vào pipeline/team-tier-map.json)")
    print(f"# {'tenDoiTQ':<14} {'tier':<6} {'teamIdGoiY':<16} {'khopTuong':<9} teamName")
    for s in suggestions:
        g = guess_team_id(s, teams, heroes_dict)
        tid = g["teamId"] if g["score"] >= 2 else "?"  # <2 tướng khớp: không chắc
        print(f"  {s['team']:<14} {s['tier']:<6} {tid:<16} {g['score']}/3       {g['teamName'] or ''}")
    print("\n# Lưu ý: chỉ là gợi ý. Kiểm tướng + tier trước khi chép vào map. Tier ngoài "
          "{T0,T0.5,T1,T1.5,T2,T3} sẽ bị build_team_tier fail-loud.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Dùng: python3 -m pipeline.suggest_team_tier path/to/saved-tier-list.html", file=sys.stderr)
        sys.exit(1)
    main(sys.argv[1])
