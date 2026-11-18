# Phase E — Tier nguồn JP cho Đội chuẩn PK-S27 và PK-S26

Effort 18h (E1 10h, E2 8h). Rủi ro: cao (dữ liệu đã publish, generation Recommended, ledger `pipeline/`; theo `AGENTS.md` cần review Astra → Fable).

## Bối cảnh

- Đội chuẩn là publication Recommended dựng từ SGSDeck bởi `pipeline/build_recommended_reference.py` bên trong chuỗi `site_localization build → check → publish` (`docs/season-team-data.md`, mục "Cùng Tồn và nguồn Recommended" và "Tên Việt và dữ liệu Trung nguyên bản"). Mỗi hàng có `tierRaw` của chính SGSDeck; facet hiện có `unit`, `faction`, `tier`, `subcategory`, `source` (`js/recommended-reference-state.js:67`, `:133-139`; nhãn `js/team-filter-section.js:165-167`). `source` hiện chỉ dùng cho bộ sưu tập đội cũ (`team-intro`, `do-uy`, `moi-phe`, `js/recommended-reference-state.js:56`).
- Sidecar mùa (`season-team-configs.json`, `season-team-evaluations.json`) có khái niệm nhiều `rankings` kèm `evidenceRefs` nhưng gắn với đội legacy và đòi cặp kịch bản/luật đã review; registry hiện chưa có luật nào và chưa có PK-S27 (`data/season-registry.json`; `pipeline/season_validation.py:188-218`; `docs/season-team-data.md` mục "Kiểm tra phạm vi đã có dữ liệu"). Vì vậy tier JP gắn vào hàng Recommended, đi qua candidate Recommended hiện có, không đi qua sidecar mùa.
- Mùa JP đánh số khác VN và có nhiều kịch bản trong một mùa (JP S26 chứa kịch bản 兵演春秋; `research-261015-japanese-content-sources.md`). Ghi chú bộ nhớ dự án nói 英雄命世 có bản Nhật S25, tức PK-S26 VN có thể ứng với JP S25; PK-S27 漢焰長明 cần đối chiếu. Issue #10: tên kịch bản là khóa chính, số mùa là nhãn riêng từng bản.
- Nguồn tier JP chính: Kazten "最強テンプレ編成" theo mùa (tier T0/T0.5/T1, tác giả nói là đánh giá cá nhân).

## E1 — Research và bảng khớp đã review {#e1}

Branch: `feat/ja-locale-e1-jp-tier-data`. Phụ thuộc: B (tên Nhật, mềm: có thể bắt đầu đối chiếu mùa và thu tier trước). Sở hữu: `pipeline/recommended-jp-tiers.json` (mới), `plans/261117-0153-ja-locale/reports/jp-season-mapping.md`, `plans/261117-0153-ja-locale/reports/jp-tier-match-review.md`.

Bước:

1. Lập bảng đối chiếu mùa theo **tên kịch bản**: `pk-s27` (漢焰長明) và `pk-s26` (英雄命世) ↔ mùa/kịch bản JP tương ứng, mỗi dòng có URL nguồn Nhật + nguồn VN/TW xác nhận; không suy từ số mùa. Không xác nhận được thì dừng mùa đó và hỏi chủ repo.
2. Thu tier từ bài Kazten của đúng mùa/kịch bản (ngày đăng, ghi chú "trước/sau khi mở server"), chỉ lấy dữ kiện: tên đội Nhật, ba tướng, chiến pháp chính nếu cần phân biệt, tier. Không chép mô tả/giải thích.
3. Khớp từng đội JP với hàng Recommended của cùng `sourceSeasonId`: tên tướng Nhật → ID qua `data/lookup-ja.json` (tên Nhật) và `chinese`/`aliases`; so bộ ba tướng (thứ tự không bắt buộc), dùng chiến pháp để tách khi một bộ ba có nhiều cấu hình. Kết quả mỗi đội: `matched` (đúng một `sourceConfigId` hoặc tập cấu hình cùng đội đã liệt kê), `ambiguous`, `unmatched`.
4. Ghi `pipeline/recommended-jp-tiers.json`: `{schemaVersion, sources:[{id, kind:"kazten", url, publishedAt, fetchedAt, scenarioName, jpSeasonLabel, vnSourceSeasonId}], entries:[{sourceId, jpTeamName, heroIds[3], tier, matchStatus, sourceConfigIds[], reviewNote}]}`. Tier chỉ nhận `T0`, `T0.5`, `T1`, `T1.5`, `T2`, `T3` (`docs/code-standards.md` mục Data contract).
5. Reviewer độc lập (sub-agent khác, không phải người lập bảng) soát mọi dòng `matched` và mẫu `unmatched`, ghi `jp-tier-match-review.md`; chỉ dòng được duyệt mới mang `matchStatus: "matched"`.
6. Đội JP không có trong SGSDeck: chỉ liệt kê trong báo cáo, không tạo hàng mới (chờ Q3).

## E2 — Đưa vào generation và facet nguồn JP {#e2}

Branch: `feat/ja-locale-e2-jp-tier-build`, tạo sau khi C và E1 đã ghép. Sở hữu: `pipeline/build_recommended_reference.py`, phần nối tham số trong `pipeline/site_localization.py`, `js/recommended-reference-state.js`, `js/team-filter-section.js`, `js/recommended-reference-render.js` (badge tier JP trên thẻ/bảng), `js/team-detail-navigation.js` (allowlist `SECTION_QUERY_KEYS`), `tests/test_build_recommended_reference.py`, `tests-js/recommended-reference-state.test.mjs`, `tests-e2e/recommended-browser.spec.mjs`.

Thiết kế (khóa facet chờ Q2; mặc định dưới đây):

1. `build_recommended_reference.py` nhận `--jp-tiers pipeline/recommended-jp-tiers.json`; descriptor generation ghim hash file (cùng cách `legacyTeamsHash`/`contentLinksHash`); chỉ dòng `matched` được chiếu; mỗi hàng khớp thêm `tierSources: [{source: "jp", tier, sourceId}]`; `tierRaw` của SGSDeck giữ nguyên, không thay, không suy tier từ nguồn khác. `sourceConfigId` lạ hoặc mùa lệch → builder dừng.
2. `site_localization` truyền tham số khi dựng candidate; file mới nằm trong input hash nên đổi file sinh generation mới (đúng hành vi mong muốn).
3. Facet mới `tierSource` (nhãn vi "Nguồn tier", zh "评级来源", ja "評価ソース"), giá trị `sgsdeck` (hàng có `tierRaw`) và `jp` (hàng có `tierSources` JP); đếm theo mùa đang chọn như facet khác; thêm khóa URL `tierSource` vào `REPEATABLE`, allowlist `SECTION_QUERY_KEYS` của `/doi-chuan/` và chữ ký SSR (`referenceViewSignature`, `docs/code-standards.md` mục cây view). Thẻ/bảng hiện thêm tier JP cạnh tier SGSDeck, có nhãn nguồn và link bài nguồn (`validateHttpSourceUrl` đã nhận `kazten.com`, `tests-js/recommended-reference-state.test.mjs:57`).
4. Chuỗi UI mới có đủ vi/zh/ja (test arity).

Bước (TDD): test Python builder (chiếu dòng matched, bỏ dòng khác, dừng khi ID lạ/mùa lệch, hash vào descriptor) → test JS facet đếm đúng theo mùa, lọc OR trong nhóm/AND với nhóm khác, khóa URL, chữ ký SSR → sửa code → ghim lại localization + publish trên branch (commit riêng) → `team_route_handles --rebind/--check` → build, verify, e2e `recommended-browser` thêm case lọc `tierSource=jp`.

## Cách kiểm

| Loại | Nội dung |
|---|---|
| Review dữ liệu | `jp-season-mapping.md`, `jp-tier-match-review.md` của reviewer độc lập |
| Unit | builder (Python), facet/state (JS) |
| Tích hợp | candidate `site_localization` check/publish, `check --stage public`, build, verify |
| E2E | lọc `tierSource=jp` ở PK-S27 và PK-S26, đếm chip khớp số hàng |
| Diff có chủ đích | So output trước/sau E2: chỉ trang Đội chuẩn/trang mùa PK-S27, PK-S26 và trang đội khớp đổi; danh sách đính PR |

## Rủi ro

| Rủi ro | Khả năng × Tác động | Giảm thiểu |
|---|---|---|
| Đối chiếu sai mùa JP↔VN | Trung bình × Cao | Khóa theo tên kịch bản, hai nguồn xác nhận, dừng khi không chắc |
| Khớp đội sai (cùng bộ ba, khác cấu hình) | Trung bình × Trung bình | Dùng chiến pháp tách, `ambiguous` không chiếu, reviewer độc lập |
| Tier cá nhân bị hiểu là chính thức | Trung bình × Trung bình | Nhãn nguồn + ngày + link bài |
| E2 đổi output vi/zh (đội có tier JP) | Chắc chắn × Thấp | Là thay đổi có chủ đích, tách khỏi cổng trùng byte của C, chờ chủ repo xác nhận (Q2) |
| Generation mới lệch ledger route handle | Trung bình × Trung bình | `team_route_handles --rebind` + `--check` theo `docs/deployment-guide.md:303-320` |

## Rollback

E1: xoá file mới. E2: revert merge, chạy lại chuỗi ghim + publish để quay về generation không có `--jp-tiers` (generation cũ có thể đã bị `prune`, nên dựng lại thay vì khôi phục tay), rồi `team_route_handles --rebind`.

## Done khi

PK-S27 và PK-S26 có hàng mang tier JP chỉ từ dòng `matched` đã review; facet nguồn JP đếm đúng theo mùa (unit + e2e); báo cáo đối chiếu mùa và review khớp nằm trong `reports/`.
