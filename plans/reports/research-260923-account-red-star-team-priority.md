# Ưu tiên đội theo sao đỏ của account trong sáu ảnh

- Research date: 2026-09-23 (Asia/Saigon)
- Branch: team build
- Topic lock: Tư vấn đội cùng tồn cho account trong sáu ảnh, ưu tiên tướng nhiều sao đỏ

## Scope and correction

| Field | Value | Basis |
| --- | --- | --- |
| Server/region | unknown | User has not specified a server; the scenario is described as Global-original in the archived project research |
| Season | Binh Diễn Xuân Thu | Explicit user follow-up in the same conversation |
| Patch/rule version | unknown | User has not specified the in-game rule version |
| Account evidence | Six user-provided roster screenshots | Visible cards and red advancement marks |
| Current teams/tactic ownership | unknown | Screenshots do not show tactic inventory or complete active teams |

Previous chat recommendation put the SP Mã Siêu–SP Hoàng Phổ Tung–Hứa Du core first. Its exact roster remains supported by the project and [SGSDeck OG build](https://sgsdeck.com/recommended/og-bingyan-huangma-spear-jiefanwei), but the **priority is replaced** for this account after the user explicitly chose red-star use as the deciding constraint. Both SP generals appear at zero red in the screenshots.

## Account observations

Orange advancement marks were counted directly from enlarged local crops of the supplied screenshots. They are account observations, not source claims about team strength.

| General | Visible red marks | Screenshot |
| --- | ---: | --- |
| Trương Phi | 5 | 1 |
| Quan Vũ | 4 | 2 |
| Cam Ninh, invested copy | 5 | 4 |
| Lữ Bố, invested copy | 5 | 3 |
| Lữ Mông, normal variant | 5 | 1 |
| Trương Xuân Hoa | 5 | 1 |
| Mãn Sủng | 4 | 2 |
| Tả Từ | 2 | 6 |
| Chu Thái | 1 | 1 |
| SP Mã Siêu; SP Hoàng Phổ Tung | 0; 0 | 3; 5 |

Normal Lữ Mông (five red) and SP Lữ Mông (zero red) are separate generals in the screenshots. Do not transfer the former's red count to builds requiring the latter.

## Earlier generic candidate configurations from current project data

The following are intact project configurations from [teams.json](../../data/teams.json), with tier provenance in [team-tier.json](../../data/team-tier.json). They do not assert that the user owns the six tactics, required equipment, or season systems.

| Priority | Project record and tier | Troop, commander, sub-commanders | Tactics by holder | Books (project order) | Visible red total | Account/season condition |
| --- | --- | --- | --- | --- | ---: | --- |
| 1 | `team-intro-45`, T0.5 in PK-S26 source | Shield; Lưu Bị, Quan Vũ, Trương Phi | Lưu Bị: Hãm Trận Doanh + Tạm Lánh Sóng Gió; Quan Vũ: Cưỡi Ngựa Nghìn Dặm + Uy Mưu Vô Địch; Trương Phi: Cơ Hình Trận + Gió Táp Mưa Sa | Lưu Bị: Tấn Công Điểm Yếu / Khích Lệ Lòng Quân / Khép Hờ; Quan Vũ: Đánh Sau Trúng Trước / Quỷ Mưu / Hợp Biến; Trương Phi: Dĩ Trực Báo Oán / Tinh Chuẩn / Thiện Chiến | 9 | Quan Vũ shield suitability/equipment and six tactics must be checked |
| 2 | `team-intro-33`, T0 in PK-S26 source | Bow; Hứa Du, Lữ Bố, Tả Từ | Hứa Du: Thuyền Cỏ Mượn Tên + Võ Phong Trận; Lữ Bố: Đương Phong Thôi Quyết + Thôi Phong Đoạn Nhẫn; Tả Từ: Quân Cẩm Phàm + Lâm Nguy Cứu Chủ | Hứa Du: Tam Quân Chi Chúng / Rèn Luyện / Dẫn Quân; Lữ Bố: Đánh Bất Ngờ Thắng / Thận Trọng / Tinh Chuẩn; Tả Từ: Tấn Công Điểm Yếu / Khích Lệ Lòng Quân / Khép Hờ | 7 | Source configuration names Điêu Thuyền's adviser skill; current season/unlock unknown |
| 3 | `team-intro-26`, T0.5 in PK-S26 source | Bow; Cam Ninh, Thái Sử Từ, Chu Thái | Cam Ninh: Phá Quân Uy Thắng + Hoành Tảo Thiên Quân; Thái Sử Từ: Đánh Bại Quân Địch + Mau Giành Lợi Thế; Chu Thái: Bạch Mã Nghĩa Tòng + Thịnh Khí Linh Địch | Cam Ninh: Thắng Sẽ Càng Mạnh / Thắng Trận / Cầm Binh Khí; Thái Sử Từ: Thắng Sẽ Càng Mạnh / Thắng Trận / Cầm Binh Khí; Chu Thái: Tinh Thần Sảng Khoái / Rèn Luyện / Dẫn Quân | 6 | Six tactics must be checked |

Project records do not specify stat allocations or a transition milestone for these three configurations. Suggested role-based points are inference only: Lưu Bị intelligence, Quan Vũ/Trương Phi force; Lữ Bố force, Hứa Du/Tả Từ intelligence; Cam Ninh force, Thái Sử Từ enough speed to act before Cam Ninh if the tactic plan needs it then force, Chu Thái command. No fixed speed threshold is evidenced here.

The three complete tactic sets above have no exact duplicate with each other. This does **not** prove compatibility with any current account teams, because their locked tactics were not supplied.

## Other red-heavy leads and source boundary

- `moi-phe-71` (Tư Mã Ý–Trương Xuân Hoa–Mãn Sủng) uses nine visible red marks and exists in current project data, but has no project tier. An SGSDeck search result lists a T0 女王盾 with the same roster for PK-S24; its **exact configuration was not inspected**. It is a lead, not a verified higher-ranked replacement for the project build.
- Cam Ninh–Thái Sử Từ–normal Lữ Mông would use ten visible red marks. The project has no ranked exact build for that roster; the ranked `team-intro-27` requires SP Lữ Mông or Trình Phổ, not the five-red normal Lữ Mông. A searched public SGSDeck listing mentions the normal variant, but its full tactics were not inspected. Do not transplant the SP build to normal Lữ Mông.
- The previous SP Mã Siêu–SP Hoàng Phổ Tung–Hứa Du recommendation still has the project T0 record `team-intro-1`. Its zero-red carry and protector make it lower priority under the user's new constraint, not disproven as a team.

For the **exact three older project configurations listed above**, **chưa có mốc SGSDeck đã xác minh**. A [public SGSDeck Đào Viên team](https://sgsdeck.com/teams/fEkWCAnZ) was inspected in the prior turn and has the same roster but different tactics; its scores or books must not be transferred to the project configuration. The SGSDeck OG Hoàng Mã build applies only to its own six tactics and scenario. After the user clarified the scenario, the published local SGSDeck reference yielded a separate exact Binh Diễn Xuân Thu Đào Viên configuration below.

## Claim status and limits

| Claim | Status | Basis |
| --- | --- | --- |
| Visible red counts and distinct normal/SP Lữ Mông | Đã đối chiếu | User-provided screenshots 1–6, locally enlarged and inspected |
| Three candidate rosters, tactics, books and historical project tiers | Đã đối chiếu | Current `data/teams.json` and `data/team-tier.json` records above |
| These three tactical sets have no mutual duplicates | Đã đối chiếu | Exact tactic-name comparison of the three complete project records |
| SGSDeck has a distinct OG Binh Diễn Xuân Thu Đào Viên build with the six tactics, books, stat focus and source score shown below | Phương án từ nguồn | Published local SGSDeck reference generation selected by `src/data/recommended-reference/current.json`; direct page inspection recorded in the follow-up below |
| They are the best live teams for this account in Binh Diễn Xuân Thu | Chưa xác minh | Server/rule version, tactic ownership, equipment and season-specific live combat reports are missing |
| SGSDeck normal Lữ Mông or 女王盾 is an exact replacement for local builds | Chưa xác minh | Only search-result listings, not full configurations, were available within the research budget |

The user subsequently specified **Binh Diễn Xuân Thu**. The three project tier records above are from **PK-S26 Anh Hùng Mệnh Thế**, a different named scenario, so their T0/T0.5 labels must not be presented as the selected season's tier. The roster and tactic sets remain project reference configurations, with season applicability **Chưa xác minh**. The [archived Global Binh Diễn Xuân Thu report](research-260825-binh-dien-xuan-thu-global-only.md) already cautions that preview balance changed and a live tier was not established there. That caution remains valid. The current `data/season-team-configs.json` and `data/season-team-evaluations.json` are both empty, so the product contains no admitted configuration or evaluation for this selected season.

## Binh Diễn Xuân Thu adjustment

- **Selected red-first source configuration:** SGSDeck's Binh Diễn Xuân Thu `og-bingyan-taoyuan-shield-huijun`, visible in the project's published `src/data/recommended-reference/<current generation>/index.json` source snapshot. It uses the account's five-red Trương Phi and four-red Quan Vũ. Its T0.5 label and 105 score belong only to this exact SGSDeck configuration, not to the older `team-intro-45` or to a newly verified live Global tier. The direct source URL recorded in the snapshot is [SGSDeck Đào Viên Thuẫn](https://sgsdeck.com/recommended/og-bingyan-taoyuan-shield-huijun). The live page was not reopened during the season-clarification follow-up; it was directly inspected in the later translation request recorded below.

| Field | SGSDeck OG source snapshot value |
| --- | --- |
| Phase/season | OG Binh Diễn Xuân Thu, giao chiến; level window and transition milestone unknown |
| Commander/sub-commanders | Lưu Bị / Quan Vũ / Trương Phi |
| Troop | Khiên |
| Lưu Bị | Hãm Trận Doanh + Cắt Xương Trị Độc; books Tấn Công Điểm Yếu / Khép Hờ / Khích Lệ Lòng Quân; Trí Lực |
| Quan Vũ | Uy Mưu Vô Địch + Huy Quân Kết Trận; books Đánh Sau Trúng Trước / Quỷ Mưu / Tướng Uy; Võ Lực và Tốc Độ |
| Trương Phi | Cương Dũng Vô Tiền + Kích Kỳ Nọa Quy; books Dĩ Trực Báo Oán / Tinh Chuẩn / Thiện Chiến; Võ Lực |
| Account conditions | Source note calls for Quan Hưng adviser skill; user ownership/unlock of adviser and six tactics unknown |
| Source score | 105, attached only to this exact source configuration |

The previous generic Đào Viên build used different tactics on all three holders. It remains a separate older project variant and is no longer the selected default for this explicitly named season.
- The alternate **Chu Thái–Trương Phi–SP Viên Thiệu** uses eight visible red marks (1+5+2). `team-intro-47` has a complete older Tiềm Long/Hãm Trận configuration with a PK-S26 Anh Hùng Mệnh Thế T0 label. Separately, the archived Binh Diễn Xuân Thu report identifies a **Tinh·Hổ Vệ Quân** version as a promising post-balance test but says battle-report evidence was insufficient to rank it. Those are different configurations; do not splice Hổ Vệ into the older six-tactic record or inherit its tier. It competes with Đào Viên for Trương Phi.
- **Hứa Du–Lữ Bố–Tả Từ** appears as a season watchlist core with Tinh·Tử Sĩ Tiên Phong or Tinh·Cẩm Phàm Quân in the archived report. That watchlist does not supply an inspected complete six-tactic build and does not validate the older `team-intro-33` tactics for this season. Its normal Lữ Bố in the account must not be confused with the separate 40Y Lữ Bố.
- **Cam Ninh–Thái Sử Từ–Chu Thái** is still a complete older project template that puts five-red Cam Ninh on damage. The report's Binh Diễn Xuân Thu Cam Ninh–Thái Sử Từ–**SP Lữ Mông** lead is a different roster and cannot use this account's five-red normal Lữ Mông as an automatic substitute.
- The archived report lists **Hoàng Mã Thương** near the top of its post-balance Japan Global *preview* comparison, while the account's SP Mã Siêu and SP Hoàng Phổ Tung show zero red. Under the user's explicit red-first choice it remains an alternative for strength-first play, not first priority. Preview results are not live tier proof.

## External-call budget

| Topic | Limit | Used | Remaining |
| --- | ---: | ---: | ---: |
| Tư vấn đội cho account trong sáu ảnh (including the season clarification) | 5 | 5 | 0 |

The prior answer used three web calls. This follow-up used two web searches. Local file reads, image crops and inspection cost zero external calls. No further source page was opened after the budget was exhausted. No product data, tier, skill, test, Git history, or deployment was changed.

## Direct page inspection during translation follow-up

On 2026-09-23, the user explicitly requested a plain Vietnamese translation of the exact [SGSDeck Đào Viên Thuẫn page](https://sgsdeck.com/recommended/og-bingyan-taoyuan-shield-huijun). The live page was inspected in the user's open browser tab. This confirms the six tactics, nine books, stat focus, T0.5/105 source label, OG Binh Diễn Xuân Thu season tag, and author line `OCR import (官方公告 兵演春秋)` shown above. The page additionally lists Quan Vũ's alternatives `破陣摧堅 / 絕其汲道` and Trương Phi's alternative `疾風驟雨`. It says to appoint Quan Hưng's adviser skill. These are **Phương án từ nguồn** for this exact variant; Global applicability and the account's tactic/adviser ownership remain **Chưa xác minh**.

The page calls Trương Phi's first tactic `剛勇無前` (Hán-Việt: Cương Dũng Vô Tiền). The project's reviewed [Vietnamese name override](../../pipeline/tactic-name-overrides.json) maps `刚勇无前` to **Vô Địch Can Trường**. The two labels denote the same tactic; future user-facing advice should use the Vietnamese game name first to avoid confusion.

The read operation used a failed web page open followed by direct inspection of the user's already open browser tab: two external calls beyond the previous 5/5 ledger. The shared topic ledger is therefore **7 used against the skill's default 5-call maximum**. No further external research was performed after direct inspection.
