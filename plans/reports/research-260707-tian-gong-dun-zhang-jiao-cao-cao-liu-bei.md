# Research: 天公盾 / 张角 曹操 刘备

Date: 2026-07-07

## Summary

- Found exact composition: `张角 / 刘备 / 曹操`.
- Common names found: `天公盾`; exact article labels it `另类藤甲盾`; Douyin labels similar composition `妖皇盾`.
- The exact published configuration matches the video tactics:
  - `张角`: `太平道法` + `士别三日`
  - `刘备`: `锋矢阵` + `暂避其锋`
  - `曹操`: `草船借箭` + `藤甲兵`
- Local repo has no exact team record for `张角 / 曹操 / 刘备`. The closest local records are:
  - `team-intro-49`: `张角 / 刘备 / 鲁肃`
  - `moi-phe-170`: `鲁肃 / 张角 / 曹操`
- Recommendation: add as new `team-intro` record if user wants the video T0 set complete.

## Evidence

### Exact Match Source

Source: Ali213 / 9game repost.

- URL: https://m.ali213.net/news/gl2205/843063.html
- Mirror: https://www.9game.cn/sgzzlb/6748793.html
- Title: `另类藤甲盾阵容推荐 张角刘备曹操阵容搭配`
- Team:
  - `张角`: `太平道法` + `士别三日`; books `疾战突围` + `鬼谋`
  - `刘备`: `锋矢阵` + `暂避其锋`; books `援其必攻` + `救主`
  - `曹操`: `草船借箭` + `藤甲兵`; books `严阵以待` + `防备`
- Notes: article frames it as playable for whiteboard/low-red Zhang Jiao, especially into weapon-damage teams. It recommends having Zhang Jiao's `天公` weapon; otherwise damage can be lower and battle may draw.

### Name / Category Evidence

Source: Xiaomi video post.

- URL: https://game.xiaomi.com/viewpoint/1430123701_1682176832711_13
- Title: `张角刘备曹操战法搭配，天公盾`
- Confirms this exact composition is commonly called `天公盾`.

Source: Douyin search/video metadata.

- URL: https://www.douyin.com/video/7493463283589008679
- Title: `妖皇盾张角刘备曹操战法兵书搭配`
- Indicates newer creator naming may use `妖皇盾`, but this is less stable than `天公盾`.

### Nearby System Sources

Source: 17173 / Hua Xi.

- URL: https://news.17173.com/content/11032024/223906807.shtml
- Describes the Zhang Jiao + Lu Su shield family and says `天公盾` increases damage relative to `诗诗盾`; Cao Cao can replace/augment support slots.

Source: TapTap / Pei Jiang Jun.

- URL: https://www.taptap.cn/moment/355832806401640509
- Describes `天公盾` family and states Zhang Jiao systems mainly use `锋矢阵`; `刘备 / 曹操 / 鲁肃` are common support pieces.

## Canonical VN Mapping

Suggested display:

```text
Tên: Thiên Công Khiên
Tên Hán: 天公盾
Loại: Khiên
Phe: Hỗn hợp
Tier source: video-260701 · T0 · 天公盾
```

Heroes:

```text
Trương Giác / Tào Tháo / Lưu Bị
```

Tactics, aligned to video order:

```text
Trương Giác: Thái Bình Đạo Pháp + Sĩ Biệt Tam Nhật
Tào Tháo: Thuyền Cỏ Mượn Tên + Lính Giáp Mây
Lưu Bị: Phong Thi Trận + Tạm Lánh Sóng Gió
```

Books from exact article source, if needed:

```text
Trương Giác: Tật Chiến Đột Vây + Quỷ Mưu
Lưu Bị: Viện Kỳ Tất Công + Cứu Chủ
Tào Tháo: Nghiêm Trận Dĩ Đãi + Phòng Bị
```

## Fit For Current Repo

Exact team currently missing from `data/teams.json`.

Nearest non-exact teams:

- `team-intro-49`: `Trương Giác / Lưu Bị / Lỗ Túc`
- `moi-phe-170`: `Lỗ Túc / Trương Giác / Tào Tháo`

If added, create a new `team-intro-*` record, then add T0 ranking:

```json
{
  "source": "video-260701 · T0 · 天公盾",
  "tier": "T0",
  "updatedAt": "2026-07-07"
}
```

## Confidence

- Composition confidence: high.
- Tactics confidence: high, exact source matches video.
- Name confidence: medium-high. `天公盾` confirmed by Xiaomi/video metadata; `另类藤甲盾` is article title category; `妖皇盾` appears in Douyin creator naming.
- Tier T0 confidence: medium. Video labels it T0; external sources describe strong/playable but do not consistently label this exact `张角 / 曹操 / 刘备` variant as T0.

## Unresolved Questions

- Whether to add this as a new `team-intro` team now, or keep as researched candidate until user approves data edit.
- Whether display nickname should be only `Thiên Công Khiên`, or include alias `Yêu Hoàng Khiên`.
