"""Crawl thư viện chiến pháp (战法库) + tướng (武将库) từ lingxigames.

Cơ chế (đã verify spike): list endpoint lấy priRowId + tên; detail endpoint
`getQueryDataInfoByPriId` trả ĐỦ cột (loại/chất/mô tả/binh chủng/icon). KHÔNG cần
headless — tbId đã biết, detail trả full field.

- Crawl chạy OFFLINE lúc build, KHÔNG vào runtime site (giữ zero-dep).
- [H3] fail-loud nếu len(items) != totalCount; retry/backoff khi lỗi mạng.
- [C3] chỉ giữ iconUrl, KHÔNG tải/commit PNG aligames.

Chỉ Python stdlib. Hàm parse_* thuần (test bằng fixture, không gọi mạng).
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from typing import Optional, Set

from . import hanviet

API_URL = "https://galaxias-api.lingxigames.com/ds/ajax/endpoint.json"
_HEADERS = {
    "Origin": "https://sgzzlb.lingxigames.com",
    "Referer": "https://sgzzlb.lingxigames.com/station/",
    "Content-Type": "application/json",
}
GAME_ID = 10000100
TB_TACTICS = "350659307657771017"  # 战法库
TB_HEROES = "350659087930767364"   # 武将库

# Loại chiến pháp Hán -> Việt (7 loại).
TACTIC_TYPE_MAP = {
    "主动": "Chủ động", "被动": "Bị động", "指挥": "Chỉ huy", "突击": "Đột kích",
    "阵法": "Trận pháp", "兵种": "Binh chủng", "内政": "Nội chính",
}
# Nguồn chiến pháp Hán -> Việt.
TACTIC_SOURCE_MAP = {
    "自带战法": "Tự mang", "传承战法": "Truyền thừa", "战法书": "Sách chiến pháp",
    "事件战法": "Sự kiện", "活动战法": "Hoạt động", "赛季战法": "Mùa giải",
}


def _post(api: str, params: dict, retries: int = 3) -> dict:
    """POST endpoint lingxi với retry/backoff [H3]."""
    body = json.dumps({"api": api, "params": params}).encode("utf-8")
    last_err: Optional[Exception] = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(API_URL, data=body, headers=_HEADERS, method="POST")
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            # Coi là lỗi nếu success==False HOẶC thiếu result (chống lỗi server-side
            # rơi vào KeyError ngoài phạm vi retry). [H3]
            if data.get("success") is False or "result" not in data:
                raise RuntimeError(f"API lỗi: {data.get('message')}")
            return data
        except (urllib.error.URLError, TimeoutError, RuntimeError,
                json.JSONDecodeError, KeyError, TypeError) as exc:
            last_err = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"POST {api} thất bại sau {retries} lần: {last_err}")


def crawl_list(tb_id: str, size: int = 20, sleep: float = 0.4) -> list:
    """Lặp page -> gom toàn bộ {priRowId, priVal}. [H3] fail-loud nếu lệch totalCount."""
    by_id: dict = {}  # priRowId -> item (dedup, chống page lặp inflate count)
    page = 0
    total = None
    max_pages = 0
    while True:
        data = _post(
            "/api/l/owresource/getQueryDataInfoListByCategory",
            {"gameId": GAME_ID, "tbId": tb_id, "categoryIds": "", "page": page, "size": size},
        )
        result = data["result"]
        if total is None:
            total = result.get("totalCount")
            if total is None:
                raise RuntimeError(f"[H3] tbId={tb_id}: thiếu totalCount")
            max_pages = total // size + 2  # guard vòng lặp vô hạn
        batch = result.get("items", [])
        if not batch:
            break
        for it in batch:
            by_id[it["priRowId"]] = it  # dedup theo priRowId
        if len(by_id) >= total or page >= max_pages:
            break
        page += 1
        time.sleep(sleep)
    items = list(by_id.values())
    if len(items) != total:
        raise RuntimeError(f"[H3] tbId={tb_id}: thu {len(items)} (unique) != totalCount {total} (crawl thiếu/lệch)")
    return items


def fetch_detail(tb_id: str, pri_row_id: str) -> dict:
    """Lấy item chi tiết (đủ cột) theo priRowId."""
    data = _post(
        "/api/l/owresource/getQueryDataInfoByPriId",
        {"gameId": GAME_ID, "tbId": tb_id, "priRowId": pri_row_id},
    )
    return data["result"]["items"][0]


# --- Parser thuần (test bằng fixture) ---

def detail_map(item: dict) -> dict:
    """details[] -> {key: val}. Bỏ qua cột icon (đọc riêng qua _icon_url)."""
    return {d["key"]: (d.get("val") or "") for d in item.get("details", [])}


def _icon_url(item: dict) -> str:
    """Lấy URL icon PC (ưu tiên PCicon). Chỉ URL, KHÔNG tải về [C3]."""
    for d in item.get("details", []):
        if d.get("key") == "PCicon" and d.get("val"):
            return d["val"]
    for d in item.get("details", []):
        if "icon" in d.get("key", "").lower() and d.get("val"):
            return d["val"]
    return ""


def parse_tactic_detail(item: dict, missing: Optional[Set[str]] = None) -> dict:
    """Item chi tiết 战法 -> record tactics.json (chưa gắn aliases/auto-link)."""
    dm = detail_map(item)
    chinese = item["priVal"].strip()
    type_cn = dm.get("战法类型", "").strip()
    source_cn = dm.get("战法来源", "").strip()
    return {
        "chinese": chinese,
        "hanViet": hanviet.to_viet(chinese, missing),
        "type": TACTIC_TYPE_MAP.get(type_cn, type_cn),
        "quality": dm.get("战法品质", "").strip(),
        "effect": dm.get("战法描述", "").strip(),
        "target": dm.get("战法目标", "").strip(),
        "troopFit": hanviet.troops_vn(dm.get("兵种限制", "")),
        "source": TACTIC_SOURCE_MAP.get(source_cn, source_cn),
        "sourceHeroCn": dm.get("来源武将", "").strip(),
        "iconUrl": _icon_url(item),
    }


def parse_hero_detail(item: dict, missing: Optional[Set[str]] = None) -> dict:
    """Item chi tiết 武将 -> record heroes-dict.json."""
    dm = detail_map(item)
    chinese = item["priVal"].strip()
    # Tướng biến thể đặc biệt: tiền tố "SP"/"PS" (Latin) trước tên Hán.
    is_sp = False
    base_cn = chinese
    for pfx in ("SP", "PS"):
        if base_cn.upper().startswith(pfx):
            is_sp = True
            base_cn = base_cn[len(pfx):].strip()
            break
    base_viet = hanviet.to_viet(base_cn, missing)
    han_viet = ("SP " + base_viet) if is_sp else base_viet
    stars_cn = dm.get("星级", "").strip()  # vd "5星"
    stars = "".join(c for c in stars_cn if c.isdigit())
    return {
        "chinese": chinese,
        "hanViet": han_viet,
        "isSP": is_sp,
        "faction": hanviet.faction_vn(dm.get("阵营", "")),
        "stars": int(stars) if stars else None,
        "cost": dm.get("cost", "").strip(),
        "stats": {
            "luc": dm.get("武力", "").strip(),
            "tri": dm.get("智力", "").strip(),
            "thong": dm.get("统率", "").strip(),
            "toc": dm.get("速度", "").strip(),
            "chinh": dm.get("政治", "").strip(),
            "mi": dm.get("魅力", "").strip(),
        },
        "selfTacticCn": dm.get("自带战法", "").strip(),
        "iconUrl": _icon_url(item),
    }
