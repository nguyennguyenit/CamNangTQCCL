"""Phiên âm Hán-Việt cấp ký tự + map chất tướng / phe / binh chủng.

Nguồn bảng ký tự: spike `plans/reports/spike-hanviet-char-map.py.txt` (409 ký tự
trong 174 chiến pháp), mở rộng dần khi crawl gặp ký tự mới.

Quy tắc fail-loud: ký tự ngoài bảng -> `transliterate` ném `MissingCharError`
(hoặc gom vào `missing` nếu truyền set). KHÔNG ship phiên âm thiếu ký tự.

Chỉ Python stdlib.
"""

from __future__ import annotations

from typing import Optional, Set

# Bảng phiên âm Hán-Việt cấp ký tự. Mở rộng khi crawl gặp ký tự mới (giữ a→z).
HV = {
    "劭": "thiệu", "邵": "thiệu", "变": "biến", "變": "biến", "未": "vị", "陌": "mạch",
    "一": "nhất", "七": "thất", "万": "vạn", "三": "tam", "上": "thượng", "下": "hạ", "不": "bất", "世": "thế", "东": "đông", "中": "trung",
    "临": "lâm", "丹": "đan", "举": "cử", "义": "nghĩa", "之": "chi", "乘": "thừa", "书": "thư", "乱": "loạn", "争": "tranh", "二": "nhị",
    "云": "vân", "五": "ngũ", "亢": "kháng", "人": "nhân", "仁": "nhân", "从": "tòng", "仓": "thương", "以": "dĩ", "伏": "phục", "众": "chúng",
    "伪": "ngụy", "佐": "tá", "余": "dư", "侮": "vũ", "侯": "hầu", "倾": "khuynh", "傲": "ngạo", "儒": "nho", "先": "tiên", "克": "khắc",
    "入": "nhập", "全": "toàn", "八": "bát", "兴": "hưng", "兵": "binh", "其": "kỳ", "兹": "tư", "军": "quân", "冠": "quan", "冲": "xung",
    "决": "quyết", "凉": "lương", "凌": "lăng", "凤": "phượng", "出": "xuất", "击": "kích", "刀": "đao", "刚": "cương", "利": "lợi", "别": "biệt",
    "刮": "quát", "制": "chế", "前": "tiền", "力": "lực", "功": "công", "助": "trợ", "劫": "kiếp", "劳": "lao", "势": "thế", "勇": "dũng",
    "勋": "huân", "十": "thập", "千": "thiên", "华": "hoa", "南": "nam", "卧": "ngọa", "双": "song", "反": "phản", "发": "phát", "古": "cổ",
    "合": "hợp", "名": "danh", "向": "hướng", "命": "mệnh", "咆": "bào", "哮": "hao", "囊": "nang", "四": "tứ", "围": "vi", "固": "cố",
    "国": "quốc", "地": "địa", "坐": "tọa", "坚": "kiên", "垂": "thùy", "埋": "mai", "城": "thành", "境": "cảnh", "壁": "bích", "士": "sĩ",
    "处": "xử", "夏": "hạ", "多": "đa", "大": "đại", "天": "thiên", "夺": "đoạt", "奇": "kỳ", "奋": "phấn", "女": "nữ", "奸": "gian",
    "好": "hảo", "如": "như", "妙": "diệu", "姬": "cơ", "姿": "tư", "威": "uy", "子": "tử", "守": "thủ", "定": "định", "宠": "sủng",
    "容": "dung", "射": "xạ", "将": "tướng", "小": "tiểu", "尝": "thường", "尽": "tận", "屈": "khuất", "工": "công", "布": "bố", "帆": "phàm",
    "师": "sư", "帷": "duy", "常": "thường", "幄": "ác", "平": "bình", "幸": "hạnh", "弑": "thí", "弓": "cung", "当": "đương", "形": "hình",
    "影": "ảnh", "待": "đãi", "得": "đắc", "御": "ngự", "德": "đức", "心": "tâm", "必": "tất", "志": "chí", "忠": "trung", "恶": "ác", "惑": "hoặc",
    "戈": "qua", "成": "thành", "战": "chiến", "戟": "kích", "戮": "lục", "戾": "lệ", "所": "sở", "才": "tài", "扫": "tảo", "扼": "ách",
    "折": "chiết", "披": "phi", "抬": "đài", "拒": "cự", "持": "trì", "挟": "hiệp", "挫": "tỏa", "振": "chấn", "捷": "tiệp", "搦": "nạch",
    "摇": "dao", "摧": "thôi", "政": "chính", "敌": "địch", "数": "số", "文": "văn", "断": "đoạn", "施": "thi", "无": "vô", "日": "nhật",
    "昭": "chiêu", "是": "thị", "晓": "hiểu", "智": "trí", "暂": "tạm", "暗": "ám", "暴": "bạo", "月": "nguyệt", "望": "vọng", "木": "mộc",
    "术": "thuật", "机": "cơ", "来": "lai", "杨": "dương", "杯": "bôi", "林": "lâm", "枪": "thương", "校": "hiệu", "梦": "mộng", "棺": "quan",
    "楚": "sở", "槊": "sóc", "横": "hoành", "橹": "lỗ", "歌": "ca", "步": "bộ", "武": "võ", "毅": "nghị", "毒": "độc", "毦": "nhị",
    "气": "khí", "水": "thủy", "江": "giang", "池": "trì", "汤": "thang", "沉": "trầm", "沙": "sa", "泉": "tuyền", "泰": "thái", "流": "lưu",
    "测": "trắc", "济": "tế", "深": "thâm", "清": "thanh", "渠": "cừ", "渡": "độ", "溯": "tố", "火": "hỏa", "炽": "sí", "烈": "liệt",
    "烧": "thiêu", "焰": "diễm", "熯": "hãn", "燕": "yến", "物": "vật", "狮": "sư", "狼": "lang", "猛": "mãnh", "王": "vương", "环": "hoàn",
    "生": "sinh", "用": "dụng", "甲": "giáp", "画": "họa", "略": "lược", "疗": "liệu", "疾": "tật", "痴": "si", "登": "đăng", "白": "bạch",
    "百": "bách", "益": "ích", "监": "giám", "盛": "thịnh", "盟": "minh", "目": "mục", "直": "trực", "相": "tương", "盼": "phán", "睨": "nghễ",
    "瞋": "sân", "矛": "mâu", "矢": "thỉ", "知": "tri", "破": "phá", "神": "thần", "秘": "bí", "穿": "xuyên", "突": "đột", "窃": "thiết",
    "立": "lập", "竭": "kiệt", "符": "phù", "笳": "già", "策": "sách", "筹": "trù", "箕": "cơ", "算": "toán", "箭": "tiễn", "精": "tinh",
    "累": "lũy", "纬": "vĩ", "纵": "túng", "练": "luyện", "经": "kinh", "结": "kết", "绝": "tuyệt", "统": "thống", "群": "quần", "翎": "linh",
    "者": "giả", "而": "nhi", "聚": "tụ", "肉": "nhục", "胆": "đảm", "胜": "thắng", "胡": "hồ", "腰": "yêu", "臣": "thần", "自": "tự",
    "舌": "thiệt", "舞": "vũ", "良": "lương", "色": "sắc", "花": "hoa", "苕": "điều", "若": "nhược", "苦": "khổ", "英": "anh", "莫": "mạc",
    "营": "doanh", "薪": "tân", "藤": "đằng", "虎": "hổ", "虑": "lự", "虞": "ngu", "蛇": "xà", "蛮": "man", "蜀": "thục", "血": "huyết",
    "行": "hành", "衣": "y", "袭": "tập", "西": "tây", "要": "yếu", "视": "thị", "誓": "thệ", "计": "kế", "识": "thức", "诗": "thi",
    "诱": "dụ", "谋": "mưu", "象": "tượng", "豹": "báo", "貌": "mạo", "败": "bại", "贫": "bần", "贵": "quý", "赴": "phó", "跃": "dược",
    "身": "thân", "车": "xa", "轰": "oanh", "载": "tải", "辩": "biện", "迅": "tấn", "运": "vận", "连": "liên", "逐": "trục", "通": "thông",
    "速": "tốc", "逸": "dật", "道": "đạo", "遵": "tuân", "避": "tị", "酒": "tửu", "重": "trọng", "金": "kim", "鉴": "giám", "铁": "thiết",
    "锁": "tỏa", "锋": "phong", "锐": "nhuệ", "锦": "cẩm", "镇": "trấn", "镜": "kính", "长": "trường", "门": "môn", "闭": "bế", "间": "gian",
    "阙": "khuyết", "防": "phòng", "阵": "trận", "陈": "trần", "降": "hàng", "陷": "hãm", "雄": "hùng", "雅": "nhã", "雨": "vũ", "雷": "lôi",
    "霆": "đình", "震": "chấn", "霸": "bá", "青": "thanh", "靡": "mị", "面": "diện", "音": "âm", "顶": "đỉnh", "顾": "cố", "风": "phong",
    "飞": "phi", "香": "hương", "马": "mã", "驱": "khu", "骇": "hãi", "骑": "kỵ", "骨": "cốt", "高": "cao", "鬼": "quỷ", "魁": "khôi",
    "魂": "hồn", "魄": "phách", "魅": "mị", "鸩": "trậm", "鸱": "si", "鹰": "ưng", "黄": "hoàng", "鼓": "cổ", "齐": "tề",
    # --- Mở rộng cho tên tướng (武将库) + tên riêng Tam Quốc ---
    "丑": "sửu", "丕": "phi", "严": "nghiêm", "丰": "phong", "乐": "nhạc", "乔": "kiều", "于": "vu", "亮": "lượng", "伊": "y", "会": "hội",
    "传": "truyền", "佗": "đà", "借": "tá", "儁": "tuấn", "兀": "ngột", "元": "nguyên", "公": "công", "关": "quan", "典": "điển", "刃": "nhận",
    "刘": "lưu", "到": "đáo", "动": "động", "卓": "trác", "单": "đan", "卫": "vệ", "原": "nguyên", "史": "sử", "司": "tư", "吉": "cát",
    "吕": "lữ", "周": "chu", "嘉": "gia", "垒": "lũy", "备": "bị", "太": "thái", "夫": "phu", "姜": "khương", "婴": "anh", "孙": "tôn",
    "孟": "mạnh", "宁": "ninh", "实": "thực", "宣": "tuyên", "宫": "cung", "尚": "thượng", "屏": "bình", "州": "châu", "左": "tả", "庞": "bàng",
    "庶": "thứ", "廪": "lẫm", "延": "diên", "弄": "lộng", "引": "dẫn", "张": "trương", "弦": "huyền", "归": "quy", "彧": "úc", "徐": "từ",
    "徽": "huy", "思": "tư", "惇": "đôn", "惰": "nọa", "慈": "từ", "懿": "ý", "扬": "dương", "抗": "kháng", "抚": "phủ", "据": "cứ",
    "授": "thụ", "掣": "xiết", "操": "tháo", "攸": "du", "敛": "liễm", "整": "chỉnh", "斗": "đấu", "斫": "chước", "春": "xuân", "昱": "dục",
    "晃": "hoảng", "普": "phổ", "曹": "tào", "朱": "chu", "朵": "đóa", "权": "quyền", "李": "lý", "桥": "kiều", "植": "thực", "檄": "hịch",
    "正": "chính", "氏": "thị", "民": "dân", "汲": "cấp", "沮": "thư", "法": "pháp", "渊": "uyên", "溃": "hội", "满": "mãn", "潜": "tiềm",
    "焚": "phần", "燎": "liệu", "独": "độc", "玲": "linh", "琬": "uyển", "瑜": "du", "瓒": "toản", "甄": "chân", "甘": "cam", "田": "điền",
    "盖": "cái", "祝": "chúc", "禁": "cấm", "禄": "lộc", "程": "trình", "籍": "tịch", "纮": "hoành", "纯": "thuần", "绍": "thiệu", "绮": "ỷ",
    "维": "duy", "羽": "vũ", "肃": "túc", "腾": "đằng", "船": "thuyền", "艾": "ngải", "苞": "bao", "荀": "tuân", "草": "thảo", "获": "hoạch",
    "葛": "cát", "董": "đổng", "蒋": "tưởng", "蒙": "mông", "蔡": "thái", "蝉": "thiền", "融": "dung", "袁": "viên", "装": "trang", "裸": "lõa",
    "褚": "chử", "览": "lãm", "角": "giác", "让": "nhượng", "许": "hứa", "诩": "hủ", "诸": "chư", "貂": "điêu", "贾": "giả", "走": "tẩu",
    "赵": "triệu", "超": "siêu", "踞": "cứ", "辎": "truy", "辑": "tập", "辽": "liêu", "进": "tiến", "逊": "tốn", "邓": "đặng", "邕": "ung",
    "邹": "trâu", "郃": "cáp", "郝": "hác", "郭": "quách", "里": "lý", "钟": "chung", "银": "ngân", "陆": "lục", "韦": "vi", "顺": "thuận",
    "颜": "nhan", "驰": "trì", "魏": "ngụy", "鲁": "lỗ", "鹿": "lộc", "龙": "long",
    # --- Mở rộng cho chiến pháp generic (tactics-generic.json) ---
    "主": "chủ", "伐": "phạt", "危": "nguy", "唐": "đường", "因": "nhân", "少": "thiểu", "己": "kỷ", "并": "tịnh",
    "彼": "bỉ", "捐": "quyên", "救": "cứu", "柔": "nhu", "烦": "phiền", "藏": "tàng", "虚": "hư", "解": "giải",
    "攻": "công", "远": "viễn", "障": "chướng", "雁": "nhạn", "非": "phi", "鱼": "ngư", "鳞": "lân",
}

# Họ/cụm đọc đặc biệt (đa âm theo cụm). Áp longest-match TRƯỚC char-level.
#   诸葛 = Gia Cát (không phải "Chư Cát"); 貂蝉 = Điêu Thuyền (không phải "Điêu Thiền").
COMPOUND_READINGS = {
    "诸葛": "gia cát",
    "貂蝉": "điêu thuyền",
}

# Đa âm chốt thủ công (M4): cộng đồng VN dùng âm thứ 2.
#   摧 tồi->thôi (Đương Phong Thôi Quyết), 武 vũ->võ (Quan Võ), 箕 ki->cơ.
# Đã gộp thẳng vào HV ở trên để re-crawl áp lại deterministic.

# Map phe: chữ Hán -> tên Việt site dùng.
FACTION_MAP = {"魏": "Ngụy", "蜀": "Thục", "吴": "Ngô", "群": "Quần", "汉": "Hán"}

# Map binh chủng: chữ Hán -> tên Việt (khớp unitTypes site: Kỵ/Cung/Thương/Khiên).
TROOP_MAP = {"骑兵": "Kỵ", "弓兵": "Cung", "枪兵": "Thương", "盾兵": "Khiên", "器械": "Khí giới"}


class MissingCharError(ValueError):
    """Ký tự Hán không có trong bảng phiên âm (fail-loud, không ship thiếu)."""


def _is_cjk(ch: str) -> bool:
    """CJK Unified Ideographs (chỉ ký tự Hán mới bắt buộc có trong bảng)."""
    return "一" <= ch <= "鿿"


def transliterate(chinese: str, missing: Optional[Set[str]] = None) -> str:
    """Phiên âm chuỗi Hán -> Hán-Việt (chữ thường, cách nhau dấu space).

    Ký tự không phải Hán (Latin/số, vd tiền tố "SP") giữ nguyên, không tính
    thiếu. Ký tự Hán ngoài bảng: gom vào `missing` (nếu truyền set) hoặc ném
    `MissingCharError` (fail-loud).
    """
    s = (chinese or "").strip()
    out = []
    latin = []  # gom run ký tự không phải Hán liền nhau thành 1 token (vd "SP")

    def _flush():
        if latin:
            out.append("".join(latin))
            latin.clear()

    i = 0
    while i < len(s):
        # Cụm đọc đặc biệt (đa âm theo cụm) — ưu tiên longest-match.
        matched = next((c for c in COMPOUND_READINGS if s.startswith(c, i)), None)
        if matched:
            _flush()
            out.append(COMPOUND_READINGS[matched])
            i += len(matched)
            continue
        ch = s[i]
        if ch in HV:
            _flush()
            out.append(HV[ch])
        elif not _is_cjk(ch):
            if ch.strip():
                latin.append(ch)  # Latin/số/SP — giữ nguyên, gom liền nhau
        elif missing is not None:
            _flush()
            missing.add(ch)
            out.append(ch)
        else:
            raise MissingCharError(f"Ký tự ngoài bảng phiên âm: {ch!r} trong {chinese!r}")
        i += 1
    _flush()
    return " ".join(out)


def title_case_vn(text: str) -> str:
    """Viết hoa đầu mỗi âm tiết: 'bạo lệ vô nhân' -> 'Bạo Lệ Vô Nhân'."""
    return " ".join(w[:1].upper() + w[1:] for w in (text or "").split())


def to_viet(chinese: str, missing: Optional[Set[str]] = None) -> str:
    """Hán -> tên Việt title-case (phiên âm + viết hoa)."""
    return title_case_vn(transliterate(chinese, missing))


def faction_vn(chinese: str) -> str:
    return FACTION_MAP.get((chinese or "").strip(), (chinese or "").strip())


def troops_vn(chinese: str) -> list:
    """'骑兵、弓兵、枪兵' -> ['Kỵ','Cung','Thương']. Tách theo 、 hoặc ,."""
    raw = (chinese or "").replace(",", "、")
    return [TROOP_MAP.get(p.strip(), p.strip()) for p in raw.split("、") if p.strip()]
