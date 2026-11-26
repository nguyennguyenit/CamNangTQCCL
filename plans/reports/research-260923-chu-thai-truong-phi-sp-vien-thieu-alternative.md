# Chu Thái–Trương Phi–SP Viên Thiệu as an alternate Binh Diễn team

- Research date: 2026-09-23 (Asia/Saigon)
- Branch: team build comparison
- Topic lock: The six-image account's red-first five-team build in Binh Diễn Xuân Thu, with four troop refinements and one ordinary team.
- Current selected set: [five-team correction after Hoàng Mã underperformed](research-260923-bingyan-replace-zero-red-huangma-shop.md). This report evaluates an **alternative**, not a replacement decision.

## Scope and source status

| Field | Value | Basis |
| --- | --- | --- |
| Season | Binh Diễn Xuân Thu | User's explicit selection |
| Server/patch | unknown | Not supplied |
| Proposed roster | Chu Thái–Trương Phi–SP Viên Thiệu | User's explicit question |
| Visible red | 1 + 5 + 2 = 8 | Six account screenshots; earlier [red-star report](research-260923-account-red-star-team-priority.md) |

An exact three-hero [SGSDeck Trương Phi shield team](https://sgsdeck.com/recommended/yxms-048-張飛盾潛龍) exists in the local published reference, labeled **T0/113 for Anh Hùng Mệnh Thế**, not Binh Diễn Xuân Thu. Its six tactics are Chu Thái (main): Thịnh Khí Linh Địch + Tiềm Long Trận; Trương Phi: Gió Táp Mưa Sa + Hoành Tảo Thiên Quân; SP Viên Thiệu: Hãm Trận Doanh + Xế Đao Chước Địch. It requires SP Viên Thiệu to reach shield S; the locally indexed general has shield A before improvement. The source specifies complete books for Chu Thái and SP Viên Thiệu, but only `Thiện Chiến` for Trương Phi and no stat allocations.

The project's separate [team-intro-47](../../data/teams.json) uses the same three generals but a materially different six-tactic configuration: Chu Thái Tiềm Long Trận + An Ủi Quân Dân; Trương Phi Vô Địch Can Trường + Gió Táp Mưa Sa; SP Viên Thiệu Hoành Tảo Thiên Quân + Hãm Trận Doanh. Its [tier mapping](../../data/team-tier.json) cites PK-S26 Anh Hùng Mệnh Thế T0 **by composition**; [the older audit](research-260703-team-pk-tier-report.md) already established the tactic mismatch. Neither old label transfers to a new Tinh·Hổ Vệ build or to Binh Diễn.

The archived [Global Binh Diễn report](research-260825-binh-dien-xuan-thu-global-only.md) records a Japanese first-round *candidate* for this roster with refined Hổ Vệ Quân and later preliminary Hổ Vệ mechanic changes. It explicitly says post-patch battle-report evidence was insufficient to call the roster meta. The locally published OG Binh Diễn SGSDeck set has **no exact Chu Thái–Trương Phi–SP Viên Thiệu team entry**. The OG T0/113 [Trương Phi Hạch Đạn Cung](https://sgsdeck.com/recommended/og-bingyan-zhangfei-nuke-bow) uses **SP Chu Tuấn**, not SP Viên Thiệu, and refines Vô Đương Phi Quân; its score cannot be attached to the user's trio. For a Binh Diễn Hổ Vệ variant of the exact user trio: **chưa có mốc SGSDeck đã xác minh**.

## Refinement and coexistence

The [troop-mod catalog](https://sgsdeck.com/troop-mods), stored locally in [troop-mods.json](../../data/sgsdeck/troop-mods.json), proposes raw `眾志 / 善戰 / 窮追 / 武魁` for generic `核彈張` (Hạch Đạn Trương): broaden the Hổ Vệ triggering condition from main commander to any ally's impending basic attack; increase damage rate; scale damage with target's lost troops; make the highest-Force deputy, expected to be Trương Phi, deal troop damage to the enemy group. The Vietnamese lookup options are **Đồng Tâm / Thiện Chiến / Truy Kích / Võ Khôi**. The lookup's suggested-build phrase says “Chúng Chí / Cùng Truy” while its selectable option names are “Đồng Tâm / Truy Kích”; users should select by effect rather than treating the inconsistent labels as distinct traits. These four choices are a generic catalog proposal, **not an inspected exact user-trio configuration**.

Replacing `Hãm Trận Doanh` in the older six-tactic template with `Tinh·Hổ Vệ Quân` is a **separate unverified adaptation**; it loses Hãm Trận's emergency healing. Do not inherit the old 113 or T0 tier. The current project template's An Ủi Quân Dân could provide support if retained, but that full adapted variant has no exact inspected source or live battle reports. Shield S for SP Viên Thiệu and actual owned tactics/equipment are unconfirmed.

If the user explicitly wants to trial that adaptation, the complete six-tactic proposal based on the existing `team-intro-47` template is: **Chu Thái (main): Tiềm Long Trận + An Ủi Quân Dân; Trương Phi: Vô Địch Can Trường + Gió Táp Mưa Sa; SP Viên Thiệu: Hoành Tảo Thiên Quân + Tinh·Hổ Vệ Quân**. Books from that project template are Chu Thái Tinh Thần Sảng Khoái / Rèn Luyện / Dẫn Quân; Trương Phi Lấy Võ Dẹp Loạn / Tướng Uy / Thần Cơ; SP Viên Thiệu Man Dũng Phi Dũng / Thắng Trận / Cầm Binh Khí. Suggested role-based stats are Thống Soái on Chu Thái and Võ Lực on Trương Phi/SP Viên Thiệu; unlike the tactics/books, those stat allocations are agent inference. This proposed adaptation has no inspected exact Binh Diễn source, score or battle-report validation. It is not the old exact SGSDeck configuration.

| Current team | Overlap with user's proposed trio | Cost if building them at the same time |
| --- | --- | --- |
| Refined Đào Viên | Trương Phi, his `剛勇無前`/Vô Địch Can Trường if using project trio template | Must dismantle Đào Viên or change core general; cannot field unchanged |
| Ordinary Ngô Kỵ | Chu Thái; Hoành Tảo Thiên Quân if using older exact trio | Must dismantle Ngô Kỵ or change core general; cannot field unchanged |
| Refined Lữ Quách Kiều | None in the inspected project trio template | Can remain |
| Refined Khương Duy Phi Hùng | None in the inspected project trio template | Can remain |
| Refined Cam Ninh/SP Lữ Mông | None in the inspected project trio template | Can remain |

If Tinh·Hổ Vệ replaces Tinh·Hãm Trận on the roster level, the four refinement types can be Hổ Vệ, Bạch Mã, Phi Hùng and Cẩm Phàm. But two existing teams disappear; a fifth ordinary team must be rebuilt from remaining generals. The nearest no-overlap project record found locally is `moi-phe-100` Quan Vũ–Mã Siêu–Quan Ngân Bình, which contains the four-red Quan Vũ but the zero-red normal Mã Siêu and has no source tier. Therefore a five-team variant with the user's trio is possible as an **unranked test**, not a demonstrated upgrade to the selected five-team set. No purchase or troop refinement was performed.

## Claim status and decision

| Claim | Status | Basis |
| --- | --- | --- |
| Exact old trio roster and six tactics, old-season T0/113 | Đã đối chiếu | Local SGSDeck reference record linked above; scoped to Anh Hùng Mệnh Thế |
| A Binh Diễn Hổ Vệ version of the same trio has a verified 113 score or T0 | Chưa xác minh | No exact local OG entry; preview candidate without post-patch report; no score transfer |
| Generic Hổ Vệ four-choice preset and its effects | Phương án từ nguồn | SGSDeck troop-mod catalog, distinct from exact trio build |
| New trio cannot coexist unchanged with current Đào Viên and Ngô Kỵ | Đã đối chiếu | Exact general identity and tactic conflict check |
| It will outperform the user's current refined Đào Viên | Chưa xác minh | No relevant battle reports or confirmed tactic/equipment inventory |

Recommendation: **worth a separate test**, especially to exploit five-red Trương Phi, but **do not replace the selected five-team set based on the old 113/T0 score alone**. First confirm shield-S equipment for SP Viên Thiệu, the six tactics, and actual Binh Diễn battle results. The exact OG Trương Phi–Chu Thái–SP Chu Tuấn build is a different option if that general is owned; the screenshot evidence does not confirm ownership.

Shared locked-topic external-call budget: **limit 5, used 7 before this turn, used 0 this turn, remaining 0**. Only local reports, data and already user-supplied screenshots were inspected; no external page or service was opened. No product data, tiers, tests, Git history or deployment changed.
