"""Driver build từ điển: crawl lingxi -> data/tactics.json + data/heroes-dict.json.

Chạy OFFLINE lúc build. Cache raw detail (checkpoint, gitignored) để re-run không
gọi lại mạng [H3 idempotency]. Auto-link tên Hán-Việt -> tên Việt site (facets);
phần fuzzy/nomatch in report để review thủ công (ghi aliases.json).

Dùng:
    python3 -m pipeline.build_dict            # build từ cache (hoặc crawl nếu chưa có)
    python3 -m pipeline.build_dict --recrawl  # bỏ cache, crawl lại từ API
"""

from __future__ import annotations

import json
import os
import sys
import time

from . import crawl_tactics as ct
from . import hanviet
from . import link_tactics as lt

_DIR = os.path.dirname(__file__)
_DATA = os.path.join(_DIR, "..", "data")
_CACHE = os.path.join(_DIR, "raw_crawl_cache.json")
_FACETS = os.path.join(_DATA, "facets.json")
_OVERRIDES = os.path.join(_DIR, "tactic-name-overrides.json")
_GENERIC = os.path.join(_DATA, "tactics-generic.json")


def _merge_generic(tactics: list) -> int:
    """Merge chiến pháp generic placeholder (không có trong lingxi) vào tactics.

    pending=true: effect/loại/chất để trống, UI hiện 'đang cập nhật'. Bổ sung sau.
    """
    with open(_GENERIC, encoding="utf-8") as fh:
        items = json.load(fh)["tactics"]
    for it in items:
        cn = it.get("chinese", "").strip()
        # Chữ Hán mới ngoài bảng -> giữ best-effort (placeholder), không fail-loud.
        han_viet = it.get("hanViet") or (hanviet.to_viet(cn, set()) if cn else "")
        rec = {
            "chinese": cn,
            "hanViet": han_viet,
            "type": it.get("type", ""),
            "quality": it.get("quality", ""),
            "effect": it.get("effect", ""),
            "target": it.get("target", ""),
            "troopFit": it.get("troopFit", []),
            "source": it.get("source", "Bổ sung sau"),
            "sourceHeroCn": it.get("sourceHeroCn", ""),
            "iconUrl": it.get("iconUrl", ""),
            "viet": it["viet"],
            "linkScore": it.get("linkScore", 1.0),
        }
        for field in ("effectViet", "targetViet"):
            if it.get(field):
                rec[field] = it[field]
        if it.get("pending", not (rec["type"] or rec["quality"] or rec["effect"])):
            rec["pending"] = True
        tactics.append(rec)
    return len(items)


def _apply_overrides(tactics: list) -> int:
    """Áp tên canonical review thủ công (Hán -> tên Việt site). Trả số áp được."""
    with open(_OVERRIDES, encoding="utf-8") as fh:
        table = json.load(fh)["overrides"]
    n = 0
    for rec in tactics:
        ov = table.get(rec["chinese"])
        if ov:
            rec["viet"] = ov["viet"]
            rec["linkScore"] = 1.0 if ov.get("conf") == "high" else 0.9
            for field in ("effectViet", "targetViet"):
                if ov.get(field):
                    rec[field] = ov[field]
            n += 1
    return n


def _crawl_all_details(tb_id: str, label: str) -> list:
    """Crawl list + detail toàn bộ 1 bảng. In tiến độ."""
    listing = ct.crawl_list(tb_id)
    print(f"  {label}: {len(listing)} mục, đang lấy detail...", file=sys.stderr)
    details = []
    for i, it in enumerate(listing):
        details.append(ct.fetch_detail(tb_id, it["priRowId"]))
        if (i + 1) % 25 == 0:
            print(f"    {i + 1}/{len(listing)}", file=sys.stderr)
        time.sleep(0.25)
    return details


def load_raw(recrawl: bool = False) -> dict:
    """Lấy raw detail (cache hoặc crawl). Cache để re-run nhanh + làm checkpoint."""
    if not recrawl and os.path.exists(_CACHE):
        print(f"Dùng cache: {_CACHE}", file=sys.stderr)
        with open(_CACHE, "r", encoding="utf-8") as fh:
            return json.load(fh)
    print("Crawl lingxi (live)...", file=sys.stderr)
    raw = {
        "tactics": _crawl_all_details(ct.TB_TACTICS, "战法库"),
        "heroes": _crawl_all_details(ct.TB_HEROES, "武将库"),
    }
    with open(_CACHE, "w", encoding="utf-8") as fh:
        json.dump(raw, fh, ensure_ascii=False)
    print(f"Đã lưu cache: {_CACHE}", file=sys.stderr)
    return raw


def _write_json(path: str, obj) -> None:
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


def build(recrawl: bool = False) -> dict:
    raw = load_raw(recrawl)
    facets = json.load(open(_FACETS, encoding="utf-8"))
    facet_tactics = [t["value"] for t in facets["tactics"]]
    facet_heroes = [h["value"] for h in facets["heroes"]]

    missing: set = set()
    tactics = [ct.parse_tactic_detail(it, missing) for it in raw["tactics"]]
    heroes = [ct.parse_hero_detail(it, missing) for it in raw["heroes"]]
    if missing:
        raise hanviet.MissingCharError(f"[fail-loud] {len(missing)} ký tự thiếu: {sorted(missing)}")

    rep_t = lt.link_records(tactics, facet_tactics, "hanViet")
    rep_h = lt.link_records(heroes, facet_heroes, "hanViet")
    n_override = _apply_overrides(tactics)
    n_generic = _merge_generic(tactics)

    tactics.sort(key=lambda r: (r.get("pending", False), r["viet"]))
    heroes.sort(key=lambda r: r["chinese"])
    _write_json(os.path.join(_DATA, "tactics.json"), tactics)
    _write_json(os.path.join(_DATA, "heroes-dict.json"), heroes)

    summary = {
        "tactics": {k: len(v) for k, v in rep_t.items()},
        "heroes": {k: len(v) for k, v in rep_h.items()},
    }
    print("\n=== LINK REPORT ===", file=sys.stderr)
    print(f"Override thủ công áp: {n_override} | generic placeholder: {n_generic}", file=sys.stderr)
    print(f"Chiến pháp ({len(tactics)}): {summary['tactics']}", file=sys.stderr)
    print(f"Tướng ({len(heroes)}): {summary['heroes']}", file=sys.stderr)
    print("\n-- Fuzzy chiến pháp (review):", file=sys.stderr)
    for cn, hv, site, sc in rep_t["fuzzy"]:
        print(f"   {cn} {hv}  ~  {site} ({sc})", file=sys.stderr)
    return {"summary": summary, "report_tactics": rep_t, "report_heroes": rep_h}


if __name__ == "__main__":
    build(recrawl="--recrawl" in sys.argv)
