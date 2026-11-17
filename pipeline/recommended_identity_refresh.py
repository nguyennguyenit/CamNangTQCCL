"""Làm mới identity map Đội chuẩn từ từ điển dự án mà không xoá hay đổi entry đã review.

``recommended_identity`` dựng lại toàn bộ descriptor từ từ điển; cách đó đổi ``stableId`` khi cột
``chinese`` của từ điển đổi dạng chữ (giản thể -> phồn thể) và làm mất mọi entry
``translation-reviewed``. Lệnh này chỉ cộng thêm:

- Hàng từ điển chưa có identity ``reviewed`` nào -> entry ``reviewed`` mới, ``stableId`` theo đúng
  công thức của descriptor (sha256 cột ``chinese``), alias = ``chinese``/``hanViet``/``viet`` + ``aliases``.
- Hàng đã có đúng một identity -> chỉ thêm alias còn thiếu (ghi ``aliasEvidence``), không đổi
  ``stableId``, ``displayNameVi`` hay alias cũ.
- Hàng chạm hai identity, alias trùng hàng từ điển khác, hoặc alias mà bản duyệt hiển thị
  (``translation-reviewed``) đã gán cho một identity khác -> bỏ qua và liệt kê trong báo cáo.

Entry ``translation-reviewed`` giữ nguyên. ``evidenceInputs`` ghi hash từ điển vừa đọc.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
from pathlib import Path

from pipeline.common import canonical_json
from pipeline.recommended_identity import alias_key

_KINDS = ("hero", "tactic", "book")


def _row_aliases(row):
    values = [row.get("chinese"), row.get("hanViet"), row.get("viet"), *(row.get("aliases") or [])]
    seen, out = set(), []
    for value in values:
        if isinstance(value, str) and value.strip() and value not in seen:
            seen.add(value)
            out.append(value)
    return out


def _hero_variant(aliases):
    return next((name for name in ("40Y", "SP", "CO") if any(alias.startswith(name) for alias in aliases)), "base")


def refresh_descriptor(descriptor, dictionaries):
    """``dictionaries``: [(kind, file name, rows bytes)]. Trả (descriptor mới, báo cáo)."""
    result = copy.deepcopy(descriptor)
    entries = result["entries"]
    owner = {}
    by_id = {}
    for entry in entries:
        if entry.get("reviewStatus") != "reviewed" or not entry.get("stableId"):
            continue
        by_id[entry["stableId"]] = entry
        for alias in entry.get("aliases", []):
            owner.setdefault((entry["kind"], alias_key(alias)), set()).add(entry["stableId"])
    # Bản duyệt hiển thị: alias nguồn -> tên Việt đã duyệt (không phải bằng chứng danh tính).
    display = {}
    for entry in entries:
        if entry.get("reviewStatus") == "translation-reviewed" and entry.get("kind") in _KINDS:
            for alias in entry.get("aliases", []):
                display[(entry["kind"], alias_key(alias))] = entry.get("displayNameVi")

    inputs = dict(result.get("evidenceInputs") or {})
    rows = []
    for kind, name, body in dictionaries:
        inputs[name] = "sha256:" + hashlib.sha256(body).hexdigest()
        for index, row in enumerate(json.loads(body)):
            if row.get("chinese") and _row_aliases(row):
                rows.append((kind, f"{name}#{index}", row))
    claims = {}
    for kind, ref, row in rows:
        for alias in _row_aliases(row):
            claims.setdefault((kind, alias_key(alias)), set()).add(ref)

    report = {"added": [], "extended": [], "skipped": []}
    added = []
    for kind, ref, row in rows:
        aliases = _row_aliases(row)
        matched = set().union(*(owner.get((kind, alias_key(alias)), set()) for alias in aliases))
        if len(matched) > 1:
            report["skipped"].append({"evidenceRef": ref, "reason": "matches-several-identities", "stableIds": sorted(matched)})
            continue
        target = next(iter(matched)) if matched else f"{kind}:" + hashlib.sha256(row["chinese"].encode()).hexdigest()[:24]
        if not matched and target in by_id:
            report["skipped"].append({"evidenceRef": ref, "reason": "stable-id-collision", "stableId": target})
            continue
        fresh = []
        for alias in aliases:
            key = (kind, alias_key(alias))
            if key in owner:
                continue
            if len(claims[key]) > 1:
                report["skipped"].append({"evidenceRef": ref, "alias": alias, "reason": "alias-shared-by-dictionary-rows"})
                continue
            shown = display.get(key)
            shown_owner = owner.get((kind, alias_key(shown)), set()) if shown else set()
            if shown_owner - {target}:
                report["skipped"].append({"evidenceRef": ref, "alias": alias, "reason": "display-review-names-other-identity",
                                          "displayNameVi": shown})
                continue
            fresh.append(alias)
        if not fresh:
            continue
        if matched:
            entry = by_id[target]
            entry["aliases"] = sorted(set(entry["aliases"]) | set(fresh))
            evidence = entry.setdefault("aliasEvidence", {})
            for alias in fresh:
                evidence[alias] = sorted(set(evidence.get(alias, [])) | {ref})
            report["extended"].append({"stableId": target, "aliases": sorted(fresh), "evidenceRef": ref})
        else:
            entry = {
                "kind": kind,
                "stableId": target,
                "variant": _hero_variant(aliases) if kind == "hero" else None,
                "aliases": sorted(set(fresh)),
                "displayNameVi": row.get("viet") or row.get("hanViet"),
                "reviewStatus": "reviewed",
                "evidenceRef": ref,
            }
            if kind == "hero":
                entry["faction"] = row.get("faction")
            by_id[target] = entry
            added.append(entry)
            report["added"].append({"stableId": target, "displayNameVi": entry["displayNameVi"], "evidenceRef": ref})
        for alias in fresh:
            owner.setdefault((kind, alias_key(alias)), set()).add(target)

    entries.extend(sorted(added, key=lambda item: (item["kind"], item["stableId"])))
    result["evidenceInputs"] = inputs
    body = {key: value for key, value in result.items() if key != "mappingHash"}
    result["mappingHash"] = "sha256:" + hashlib.sha256(canonical_json(body).encode()).hexdigest()
    return result, report


def main(argv=None):
    parser = argparse.ArgumentParser(prog="python3 -m pipeline.recommended_identity_refresh", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--identity-map", type=Path, default=Path("pipeline/recommended-identity-map.json"))
    parser.add_argument("--heroes", type=Path, default=Path("data/heroes-dict.json"))
    parser.add_argument("--tactics", type=Path, default=Path("data/tactics.json"))
    parser.add_argument("--books", type=Path, default=Path("data/books-dict.json"))
    parser.add_argument("--check", action="store_true", help="chỉ báo cáo, không ghi identity map")
    args = parser.parse_args(argv)
    descriptor = json.loads(args.identity_map.read_bytes())
    dictionaries = [(kind, path.name, path.read_bytes())
                    for kind, path in zip(_KINDS, (args.heroes, args.tactics, args.books))]
    refreshed, report = refresh_descriptor(descriptor, dictionaries)
    if not args.check:
        args.identity_map.write_text(json.dumps(refreshed, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
                                     encoding="utf-8")
    print(json.dumps({"added": len(report["added"]), "extended": len(report["extended"]),
                      "skipped": report["skipped"]}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
