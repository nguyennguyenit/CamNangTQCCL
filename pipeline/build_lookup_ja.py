"""Dựng `data/lookup-ja.json`: tên Nhật có trạng thái và bản dịch máy tiếng Nhật cho 7 nhóm Tra cứu.

Chỉ dùng thư viện chuẩn. Đầu vào đã review và commit:

- `data/ja-kanji-variants.json` (bảng ký tự, đọc bằng `pipeline.shinjitai`),
- `pipeline/han-script-chars.json` (chữ riêng của giản/phồn thể, đọc bằng `pipeline.han_script`, cho `nameOriginalLang`),
- `pipeline/ja-name-overrides.json` (tên Nhật quan sát theo ID, dựng bằng `--import-observed`),
- `pipeline/ja-glossary.json` (thuật ngữ zh -> ja dùng khi dịch),
- `pipeline/ja-translations.json` (bản dịch máy khóa theo sha256 của chữ Trung nguồn, nạp bằng `--ingest`).

Lệnh:

    python3 -m pipeline.build_lookup_ja --check              (mặc định; exit 1 khi file lệch dữ liệu)
    python3 -m pipeline.build_lookup_ja --write
    python3 -m pipeline.build_lookup_ja --prune-orphans --write   (bỏ bản dịch mồ côi khi chữ nguồn vi/zh đổi, rồi ghi)
    python3 -m pipeline.build_lookup_ja --import-observed PATH   (ghi lại ja-name-overrides.json từ bảng quan sát)
    python3 -m pipeline.build_lookup_ja --export-todo DIR [--batch-size 40]   (xuất chuỗi chưa dịch theo lô)
    python3 -m pipeline.build_lookup_ja --ingest BATCH.json --model NAME      (nạp bản dịch một lô, kiểm số liệu)

Mục thiếu bản dịch không bị bịa: khóa vắng trong `texts`, trang tự hiện dòng báo thiếu.

Promote generation Tra cứu mới làm đổi chữ nguồn thì bản dịch cũ thành mồ côi và `--check`/`--write` dừng:
chạy `--prune-orphans --write` để bỏ chúng (chữ mới thành "chưa dịch", hiện trong `docs/ja-gaps.md`).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

from pipeline.common import sha256_hex
from pipeline.han_script import han_script_lang
from pipeline.shinjitai import VARIANTS_PATH, to_shinjitai

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
OVERRIDES_PATH = ROOT / "pipeline" / "ja-name-overrides.json"
GLOSSARY_PATH = ROOT / "pipeline" / "ja-glossary.json"
TRANSLATIONS_PATH = ROOT / "pipeline" / "ja-translations.json"
OUTPUT_PATH = DATA_DIR / "lookup-ja.json"
SCHEMA_VERSION = 1
SOURCE_FILES = ("heroes-dict.json", "tactics.json", "lookup-catalog.json", "books-dict.json", "ja-kanji-variants.json")
CJK = re.compile(r"[㐀-鿿]")
GENERATION_ID = re.compile(r"lookup:[0-9a-f]{64}")
# Chữ chưa dịch / ghi chú biên tập không được công khai (khớp quy ước của catalog).
EDITORIAL_MARKERS = ("待補充", "待補全")
CONFIDENCE_RANK = {"high": 2, "medium": 1}
STATUS_BY_CONFIDENCE = {"high": "verified", "medium": "derived"}
# Tiền tố của biến thể tướng trong `chinese` -> cách bản Nhật viết, liền không cách.
VARIANT_PREFIXES = {"SP": "SP", "40Y": "40Y", "無雙": "無双", "无双": "無双"}
VARIANT_RE = re.compile(r"^(SP|40Y|無雙|无双)\s*(.+)$")
# Phép kiểm số: dãy số (kể cả thập phân), %, → phải trùng nguyên thứ tự giữa nguồn và bản dịch.
NUMBER_TOKEN = re.compile(r"\d+(?:\.\d+)?|[%％]|→")
BAD_TEXT = re.compile(r"<[^>]*>|&[#a-zA-Z0-9]+;|[\x00-\x08\x0b-\x1f\x7f]")


PRUNE_COMMAND = "python3 -m pipeline.build_lookup_ja --prune-orphans --write"


class LookupJaError(Exception):
    """Đầu vào hoặc đầu ra sai hợp đồng; dừng thay vì ghi dữ liệu chưa chắc đúng."""


# ---------------------------------------------------------------------------------------------
# Đọc dữ liệu nguồn


def _read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise LookupJaError(f"{path}: không đọc được JSON ({exc})") from exc


def canonical_text(value) -> str:
    """JSON deterministic UTF-8 có newline cuối (quy ước pipeline)."""
    return json.dumps(value, ensure_ascii=False, sort_keys=True, indent=1) + "\n"


def text_hash(src: str) -> str:
    return sha256_hex(src.encode("utf-8"))


def load_corpus(data_dir: Path = DATA_DIR) -> dict:
    catalog = _read_json(data_dir / "lookup-catalog.json")
    return {
        "heroes": _read_json(data_dir / "heroes-dict.json"),
        "tactics": _read_json(data_dir / "tactics.json"),
        "books": _read_json(data_dir / "books-dict.json"),
        "catalog": catalog,
        "manifest": _read_json(data_dir / "lookup-manifest.json"),
    }


def _first_cjk(values) -> str | None:
    for value in values or []:
        if isinstance(value, str) and CJK.search(value):
            return value.strip()
    return None


def collect_names(corpus: dict) -> dict[str, str]:
    """`{id: tên chữ Hán nguồn}` cho mọi ID của bảy nhóm (kể cả đặc kỹ trang bị và lựa chọn cải tạo)."""
    names: dict[str, str] = {}

    def put(entry_id, name):
        if not isinstance(name, str) or not CJK.search(name):
            raise LookupJaError(f"{entry_id}: không có tên chữ Hán nguồn")
        if entry_id in names:
            raise LookupJaError(f"{entry_id}: ID lặp trong dữ liệu Tra cứu")
        names[entry_id] = name.strip()

    for row in corpus["heroes"]:
        put(row["id"], row.get("chinese"))
    for row in corpus["tactics"]:
        put(row["id"], row.get("chinese"))
    for row in corpus["books"]:
        # `chinese` của binh thư là giản thể; `sourceNames` (nếu có) là bản phồn thể nguyên văn.
        source = _first_cjk(row.get("sourceNames"))
        put(row["id"], source or row.get("chinese"))
    catalog = corpus["catalog"]
    for group in ("equipment", "advisors", "specials", "buildings", "troopMods"):
        for row in catalog[group]:
            put(row["id"], _first_cjk(row.get("aliasesZh")) or row.get("nameZh"))
    for mod in catalog["troopMods"]:
        for option in mod.get("options", []):
            put(option["id"], option.get("nameZh"))
    return names


def _usable(text) -> bool:
    return isinstance(text, str) and bool(text.strip()) and bool(CJK.search(text)) and not any(m in text for m in EDITORIAL_MARKERS)


def collect_texts(corpus: dict) -> dict[str, dict[str, tuple[str, bool]]]:
    """`{id: {khóa ja: (chữ Trung nguồn, chữ Hán vốn dịch từ tiếng Việt?)}}`.

    Danh sách trường khớp đúng những trường chữ Hán mà hồ sơ `/zh/` đang hiển thị (docs/unified-lookup.md).
    """
    out: dict[str, dict[str, tuple[str, bool]]] = {}

    def put(entry_id, key, text, from_vi=False):
        if _usable(text):
            out.setdefault(entry_id, {})[key] = (text.strip(), bool(from_vi))

    for row in corpus["heroes"]:
        lookup = row.get("lookup") or {}
        put(row["id"], "usage", lookup.get("usageZh"))
        if lookup.get("exclusiveTitleVi"):
            put(row["id"], "exclusiveTitle", lookup.get("exclusiveTitleZh"))
        put(row["id"], "roleTag", row.get("roleTag"))
        for index, cond in enumerate(lookup.get("conditions") or []):
            put(row["id"], f"conditions.{index}", cond.get("textZh"), True)
        for index, pack in enumerate(lookup.get("cardPacks") or []):
            put(row["id"], f"cardPacks.{index}.pack", pack.get("packZh"))
            put(row["id"], f"cardPacks.{index}.category", pack.get("categoryZh"))
    for row in corpus["tactics"]:
        lookup = row.get("lookup") or {}
        kind = (lookup.get("effectZhSource") or {}).get("kind")
        put(row["id"], "effect", row.get("effect"), kind == "translation")
        put(row["id"], "target", row.get("target"))
    for row in corpus["books"]:
        put(row["id"], "effect", row.get("effect"))
    catalog = corpus["catalog"]
    for row in catalog["advisors"]:
        translated = (row.get("zhSource") or {}).get("kind") == "translation"
        put(row["id"], "effect", row.get("effectZh"), translated)
        put(row["id"], "usage", row.get("usageZh"), translated)
    for row in catalog["troopMods"]:
        translated = (row.get("zhSource") or {}).get("kind") == "translation"
        put(row["id"], "effect", row.get("effectZh"), translated)
        put(row["id"], "appliesTo", row.get("appliesToZh"), translated)
        put(row["id"], "suggestedBuild", row.get("suggestedBuildZh"), translated)
        for option in row.get("options", []):
            put(option["id"], "description", option.get("descriptionZh"), (option.get("zhSource") or {}).get("kind") == "translation")
    for row in catalog["buildings"]:
        translated = (row.get("zhSource") or {}).get("kind") == "translation"
        put(row["id"], "summary", row.get("summaryZh"), translated)
        for index, level in enumerate(row.get("levels") or []):
            put(row["id"], f"levels.{index}.effect", level.get("effectZh"), translated)
            put(row["id"], f"levels.{index}.duration", level.get("durationZh"), translated)
    return out


def distinct_sources(texts: dict) -> dict[str, str]:
    """`{sha256: chữ nguồn}` của mọi chuỗi cần dịch (chuỗi trùng chỉ dịch một lần)."""
    return {text_hash(src): src for fields in texts.values() for src, _ in fields.values()}


# ---------------------------------------------------------------------------------------------
# Tên Nhật


def compact_name(name: str) -> str:
    """Bản Nhật viết liền tiền tố Latin/số với tên ("SP 法正" -> "SP法正")."""
    return re.sub(r"(?<=[A-Za-z0-9])\s+(?=[㐀-鿿])", "", name)


def import_observed(rows, names: dict[str, str], source_label: str) -> dict:
    """Dựng nội dung `ja-name-overrides.json` từ bảng quan sát (`[{id, ja, confidence, sourceUrl, …}]`).

    Khớp theo `id` (không theo mặt chữ). Mỗi ID giữ một tên chính: độ tin cao hơn trước, rồi tên trùng kết quả
    chuyển mặt chữ, rồi thứ tự trong file; các tên còn lại vào `alts`. Dòng `low` không dùng. Dòng `id: null`
    mang `baseId` và tiền tố (転・ 拓・ 精・) được lưu riêng, không đè tên của chiến pháp gốc.
    """
    by_id: dict[str, list[dict]] = {}
    prefixed = []
    skipped = {"low": [], "unknownId": [], "noId": 0}
    for row in rows:
        ja, confidence, url = row.get("ja"), row.get("confidence"), row.get("sourceUrl")
        if not isinstance(ja, str) or not ja.strip() or not isinstance(url, str) or not url.strip():
            raise LookupJaError(f"dòng quan sát thiếu ja/sourceUrl: {row!r}")
        if confidence not in CONFIDENCE_RANK and confidence != "low":
            raise LookupJaError(f"dòng quan sát có confidence lạ: {row!r}")
        if confidence == "low":
            skipped["low"].append(row.get("id") or ja)
            continue
        if row.get("id") is None:
            base = row.get("baseId")
            match = re.match(r"^(.{1,2})[・･]", ja)
            if base in names and match:
                prefixed.append({"baseId": base, "confidence": confidence, "name": ja.strip(), "prefix": match.group(1), "sourceUrl": url})
            else:
                skipped["noId"] += 1
            continue
        if row["id"] not in names:
            skipped["unknownId"].append(row["id"])
            continue
        by_id.setdefault(row["id"], []).append(row)
    chosen = {}
    for entry_id, group in by_id.items():
        derived = to_shinjitai(compact_name(names[entry_id]))
        ranked = sorted(enumerate(group), key=lambda item: (-CONFIDENCE_RANK[item[1]["confidence"]], item[1]["ja"].strip() != derived, item[0]))
        best = ranked[0][1]
        entry = {"confidence": best["confidence"], "nameJa": best["ja"].strip(), "sourceUrl": best["sourceUrl"]}
        alts = sorted({r["ja"].strip() for _, r in ranked[1:]} - {entry["nameJa"]})
        if alts:
            entry["alts"] = alts
        chosen[entry_id] = entry
    prefixed.sort(key=lambda item: (item["baseId"], item["name"]))
    return {
        "schemaVersion": SCHEMA_VERSION,
        "observedSource": source_label,
        "names": dict(sorted(chosen.items())),
        "prefixedTactics": prefixed,
        "skipped": {"low": sorted(map(str, skipped["low"])), "noId": skipped["noId"], "unknownId": sorted(skipped["unknownId"])},
    }


def validate_overrides(overrides, names: dict[str, str]) -> None:
    if not isinstance(overrides, dict) or overrides.get("schemaVersion") != SCHEMA_VERSION:
        raise LookupJaError("ja-name-overrides.json: schemaVersion sai")
    for entry_id, entry in (overrides.get("names") or {}).items():
        if entry_id not in names:
            raise LookupJaError(f"ja-name-overrides.json: ID không có trong dữ liệu Tra cứu: {entry_id}")
        if not isinstance(entry, dict) or entry.get("confidence") not in CONFIDENCE_RANK:
            raise LookupJaError(f"ja-name-overrides.json: {entry_id} thiếu confidence high|medium")
        name = entry.get("nameJa")
        if not isinstance(name, str) or not name.strip() or not CJK.search(name):
            raise LookupJaError(f"ja-name-overrides.json: {entry_id} thiếu nameJa")
        if not isinstance(entry.get("sourceUrl"), str) or not entry["sourceUrl"].strip():
            raise LookupJaError(f"ja-name-overrides.json: {entry_id} thiếu sourceUrl (tên không có nguồn không được ghi đè)")
    for item in overrides.get("prefixedTactics") or []:
        if item.get("baseId") not in names or not item.get("name") or not item.get("prefix"):
            raise LookupJaError(f"ja-name-overrides.json: mục tiền tố sai: {item!r}")


def resolve_names(corpus: dict, names: dict[str, str], overrides: dict) -> dict[str, dict]:
    """`{id: {name, nameStatus, nameOriginal, nameOriginalLang}}`; mọi ID đều có tên.

    Thứ tự: tên quan sát theo ID (verified khi độ tin high, ngược lại derived); biến thể tướng (SP, 40Y, 無雙)
    chưa có hàng quan sát thì lấy "tiền tố + tên Nhật của tướng gốc có cùng chữ Hán" và thừa hưởng trạng thái của
    tướng gốc; còn lại là chuyển mặt chữ, derived.
    """
    observed = overrides.get("names") or {}
    resolved: dict[str, dict] = {}

    def derived_of(entry_id):
        return {"name": to_shinjitai(compact_name(names[entry_id])), "nameStatus": "derived"}

    def observed_of(entry_id):
        entry = observed[entry_id]
        return {"name": entry["nameJa"], "nameStatus": STATUS_BY_CONFIDENCE[entry["confidence"]]}

    base_by_chinese = {row["chinese"].strip(): row["id"] for row in corpus["heroes"] if not VARIANT_RE.match(row["chinese"].strip())}
    for entry_id in names:
        if entry_id in observed:
            resolved[entry_id] = observed_of(entry_id)
    for row in corpus["heroes"]:
        entry_id = row["id"]
        if entry_id in resolved:
            continue
        match = VARIANT_RE.match(names[entry_id])
        base_id = base_by_chinese.get(match.group(2).strip()) if match else None
        if match and base_id:
            base = observed_of(base_id) if base_id in observed else derived_of(base_id)
            resolved[entry_id] = {"name": VARIANT_PREFIXES[match.group(1)] + base["name"], "nameStatus": base["nameStatus"]}
    for entry_id in names:
        resolved.setdefault(entry_id, derived_of(entry_id))
    for entry_id, info in resolved.items():
        info["nameOriginal"] = names[entry_id]
        # `lang` của dòng 原名 tính lúc build (giản `zh-Hans` / phồn `zh-Hant` / không phân biệt được `zh`): trình duyệt không
        # phải tải bảng ký tự.
        info["nameOriginalLang"] = han_script_lang(names[entry_id])
    return resolved


# ---------------------------------------------------------------------------------------------
# Bản dịch


def number_tokens(text: str) -> list[str]:
    return [token.replace("％", "%") for token in NUMBER_TOKEN.findall(text)]


def translation_problem(src: str, ja: str) -> str | None:
    """Lý do bản dịch không dùng được, hoặc `None`. Số liệu phải trùng nguyên dãy với nguồn."""
    if not isinstance(ja, str) or not ja.strip():
        return "rỗng"
    if BAD_TEXT.search(ja):
        return "chứa HTML, thực thể hoặc ký tự điều khiển"
    if ja != ja.strip():
        return "thừa khoảng trắng đầu/cuối"
    if to_shinjitai(ja) != ja:
        return "còn ký tự chưa ở tự dạng Nhật của bảng ja-kanji-variants"
    if number_tokens(ja) != number_tokens(src):
        return f"số liệu lệch: nguồn {number_tokens(src)} / dịch {number_tokens(ja)}"
    if not re.search(r"[぀-ヿ㐀-鿿]", ja):
        return "không có chữ Nhật"
    return None


def load_translations(path: Path = TRANSLATIONS_PATH) -> dict:
    if not path.exists():
        return {}
    payload = _read_json(path)
    if not isinstance(payload, dict) or payload.get("schemaVersion") != SCHEMA_VERSION or not isinstance(payload.get("items"), dict):
        raise LookupJaError("ja-translations.json: dạng sai (cần schemaVersion và items)")
    return payload["items"]


def prune_orphans(items: dict, sources: dict[str, str]) -> tuple[dict, list[str]]:
    """Bỏ bản dịch mồ côi (khóa không còn trong chữ nguồn hiện tại); trả `(items còn lại, [khóa đã bỏ] theo thứ tự)`.

    Chữ nguồn mới của các mục đó chưa có bản dịch nên thành "chưa dịch" (khóa vắng trong `texts`, liệt kê ở
    `docs/ja-gaps.md`); không mục nào được dịch lại tự động.
    """
    removed = sorted(key for key in items if key not in sources)
    return {key: item for key, item in items.items() if key in sources}, removed


def validate_translations(items: dict, sources: dict[str, str]) -> None:
    """Fail-loud: sha lệch, mục mồ côi (chữ nguồn đã đổi) hay bản dịch hỏng đều dừng build."""
    orphans = sorted(key for key in items if key not in sources)
    if orphans:
        raise LookupJaError(
            f"ja-translations.json có {len(orphans)} mục mồ côi (chữ nguồn đã đổi), ví dụ {orphans[0][:12]}…; "
            f"chạy `{PRUNE_COMMAND}` để bỏ chúng (chữ mới thành chưa dịch, xem docs/ja-gaps.md) hoặc dịch lại"
        )
    for key, item in items.items():
        if not isinstance(item, dict) or text_hash(str(item.get("src", ""))) != key or item.get("src") != sources[key]:
            raise LookupJaError(f"ja-translations.json: mục {key[:12]}… có src không khớp sha256 hoặc chữ nguồn hiện tại")
        problem = translation_problem(item["src"], item.get("ja"))
        if problem:
            raise LookupJaError(f"ja-translations.json: mục {key[:12]}… ({item['src'][:20]}…) {problem}")


def ingest_batch(batch, sources: dict[str, str], items: dict, model: str, today: str) -> tuple[dict, list[tuple[str, str]]]:
    """Nạp một lô `[{h, ja}]`; trả `(items mới, [(hash, lý do) bị loại])`. Mục lỗi không được ghi, sẽ dịch lại."""
    if not isinstance(batch, list):
        raise LookupJaError("lô dịch phải là mảng [{h, ja}]")
    merged, rejected = dict(items), []
    for row in batch:
        key, ja = (row or {}).get("h"), (row or {}).get("ja")
        if key not in sources:
            rejected.append((str(key), "hash không có trong chữ nguồn hiện tại"))
            continue
        ja = to_shinjitai(ja) if isinstance(ja, str) else ja  # chữ Hán trong bản dịch luôn ở tự dạng Nhật của bảng dùng chung
        problem = translation_problem(sources[key], ja)
        if problem:
            rejected.append((key, problem))
            continue
        merged[key] = {"ja": ja, "model": model, "src": sources[key], "translatedAt": today}
    return merged, rejected


# ---------------------------------------------------------------------------------------------
# Dựng đầu ra


def build_payload(data_dir: Path = DATA_DIR, overrides_path: Path = OVERRIDES_PATH, translations_path: Path = TRANSLATIONS_PATH) -> dict:
    corpus = load_corpus(data_dir)
    names = collect_names(corpus)
    overrides = _read_json(overrides_path) if overrides_path.exists() else {"schemaVersion": SCHEMA_VERSION, "names": {}, "prefixedTactics": []}
    validate_overrides(overrides, names)
    texts = collect_texts(corpus)
    sources = distinct_sources(texts)
    items = load_translations(translations_path)
    validate_translations(items, sources)
    generation_id = corpus["manifest"].get("generationId")
    if not isinstance(generation_id, str) or not GENERATION_ID.fullmatch(generation_id):
        raise LookupJaError("lookup-manifest.json: generationId không đúng dạng lookup:<64-hex>")
    resolved = resolve_names(corpus, names, overrides)
    entries = {}
    for entry_id in sorted(names):
        entry = dict(resolved[entry_id])
        translated, from_vi = {}, []
        for key, (src, vi_origin) in sorted(texts.get(entry_id, {}).items()):
            item = items.get(text_hash(src))
            if item:
                translated[key] = item["ja"]
                if vi_origin:
                    from_vi.append(key)
        entry["texts"] = translated
        if from_vi:
            entry["translatedFromVi"] = from_vi
        entries[entry_id] = entry
    prefixed = [{"baseId": p["baseId"], "name": p["name"], "prefix": p["prefix"]} for p in overrides.get("prefixedTactics") or []]
    sources_digest = {f"data/{name}": sha256_hex((data_dir / name).read_bytes()) for name in SOURCE_FILES}
    return {
        "schemaVersion": SCHEMA_VERSION,
        "lookupGenerationId": generation_id,
        "sources": sources_digest,
        "notice": {"machineTranslated": True, "numbersEdition": "cn-mainland"},
        "payloadSha256": sha256_hex(canonical_text({"entries": entries, "prefixedTactics": prefixed}).encode("utf-8")),
        "prefixedTactics": prefixed,
        "entries": entries,
    }


def coverage(payload: dict, data_dir: Path = DATA_DIR) -> dict:
    """Số mục có/thiếu bản dịch theo nhóm và số tên verified/derived (cho báo cáo và tài liệu)."""
    corpus = load_corpus(data_dir)
    texts = collect_texts(corpus)
    group_of = {}
    for group, rows in (("heroes", corpus["heroes"]), ("tactics", corpus["tactics"]), ("books", corpus["books"]),
                        ("equipment", corpus["catalog"]["equipment"] + corpus["catalog"]["specials"]),
                        ("advisors", corpus["catalog"]["advisors"]), ("troop-mods", corpus["catalog"]["troopMods"]),
                        ("buildings", corpus["catalog"]["buildings"])):
        for row in rows:
            group_of[row["id"]] = group
    for mod in corpus["catalog"]["troopMods"]:
        for option in mod.get("options", []):
            group_of[option["id"]] = "troop-mods"
    report: dict = {}
    for entry_id, entry in payload["entries"].items():
        stats = report.setdefault(group_of[entry_id], {"entries": 0, "withText": 0, "fieldsTranslated": 0, "fieldsMissing": 0, "verified": 0, "derived": 0})
        stats["entries"] += 1
        stats[entry["nameStatus"]] += 1
        wanted = texts.get(entry_id, {})
        if wanted:
            stats["withText"] += 1
        stats["fieldsTranslated"] += len(entry["texts"])
        stats["fieldsMissing"] += len(wanted) - len(entry["texts"])
    return report


# ---------------------------------------------------------------------------------------------
# CLI


def _write_if_changed(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--write", action="store_true", help="ghi data/lookup-ja.json")
    mode.add_argument("--check", action="store_true", help="kiểm file khớp dữ liệu hiện tại (mặc định)")
    mode.add_argument("--import-observed", metavar="PATH", help="ghi pipeline/ja-name-overrides.json từ bảng tên quan sát")
    mode.add_argument("--export-todo", metavar="DIR", help="xuất chuỗi chưa dịch thành các lô JSON")
    mode.add_argument("--ingest", metavar="BATCH", help="nạp một lô bản dịch [{h, ja}]")
    parser.add_argument("--prune-orphans", action="store_true",
                        help="cùng --write: bỏ bản dịch mồ côi khỏi pipeline/ja-translations.json trước khi ghi")
    parser.add_argument("--batch-size", type=int, default=40)
    parser.add_argument("--model", default="")
    parser.add_argument("--data-dir", type=Path, default=DATA_DIR)
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    parser.add_argument("--overrides", type=Path, default=OVERRIDES_PATH)
    parser.add_argument("--translations", type=Path, default=TRANSLATIONS_PATH)
    args = parser.parse_args(argv)
    if args.prune_orphans and not args.write:
        parser.error("--prune-orphans chỉ dùng cùng --write")
    try:
        if args.prune_orphans:
            sources = distinct_sources(collect_texts(load_corpus(args.data_dir)))
            items = load_translations(args.translations)
            kept, removed = prune_orphans(items, sources)
            if removed:
                _write_if_changed(args.translations, canonical_text({"schemaVersion": SCHEMA_VERSION, "items": kept}))
            print(f"bỏ {len(removed)} bản dịch mồ côi khỏi {args.translations}")
        if args.import_observed:
            names = collect_names(load_corpus(args.data_dir))
            rows = _read_json(Path(args.import_observed))
            label = "plans/reports/ja-names-observed-261117.json" if Path(args.import_observed).name == "ja-names-observed-261117.json" else Path(args.import_observed).name
            overrides = import_observed(rows, names, label)
            _write_if_changed(args.overrides, canonical_text(overrides))
            print(f"ja-name-overrides.json: {len(overrides['names'])} tên, {len(overrides['prefixedTactics'])} tiền tố, bỏ {len(overrides['skipped']['low'])} dòng low")
            return 0
        if args.export_todo:
            corpus = load_corpus(args.data_dir)
            sources = distinct_sources(collect_texts(corpus))
            done = load_translations(args.translations)
            todo = [{"h": key, "zh": src} for key, src in sorted(sources.items()) if key not in done]
            outdir = Path(args.export_todo)
            outdir.mkdir(parents=True, exist_ok=True)
            size = max(1, args.batch_size)
            for index in range(0, len(todo), size):
                (outdir / f"batch-{index // size + 1:03d}.json").write_text(
                    json.dumps(todo[index:index + size], ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
            print(f"{len(todo)} chuỗi chưa dịch / {len(sources)} chuỗi khác nhau, {-(-len(todo) // size)} lô")
            return 0
        if args.ingest:
            if not args.model:
                raise LookupJaError("--ingest cần --model (tên model đã dịch)")
            sources = distinct_sources(collect_texts(load_corpus(args.data_dir)))
            items = load_translations(args.translations)
            merged, rejected = ingest_batch(_read_json(Path(args.ingest)), sources, items, args.model, date.today().isoformat())
            _write_if_changed(args.translations, canonical_text({"schemaVersion": SCHEMA_VERSION, "items": merged}))
            print(f"nạp {len(merged) - len(items)} mục, loại {len(rejected)}")
            for key, reason in rejected:
                print(f"  loại {key[:12]}: {reason}", file=sys.stderr)
            return 2 if rejected else 0
        payload = build_payload(args.data_dir, args.overrides, args.translations)
        text = canonical_text(payload)
        if args.write:
            _write_if_changed(args.output, text)
            print(f"ghi {args.output} ({len(payload['entries'])} mục)")
            return 0
        current = args.output.read_text(encoding="utf-8") if args.output.exists() else None
        if current != text:
            print(f"{args.output} lệch dữ liệu hiện tại; chạy `python3 -m pipeline.build_lookup_ja --write`", file=sys.stderr)
            return 1
        print(f"{args.output} khớp ({len(payload['entries'])} mục)")
        return 0
    except LookupJaError as exc:
        print(f"lỗi: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
