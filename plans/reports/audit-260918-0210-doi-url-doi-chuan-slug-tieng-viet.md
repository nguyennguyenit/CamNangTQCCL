# Audit plan — Đổi URL trang chi tiết đội sang slug tiếng Việt

- **Ngày:** 2026-09-18
- **Plan:** [`plans/260918-0144-doi-url-doi-chuan-slug-tieng-viet/plan.md`](../260918-0144-doi-url-doi-chuan-slug-tieng-viet/plan.md)
- **Brainstorm nguồn:** [`brainstorm-260918-0030`](brainstorm-260918-0030-doi-link-doi-chuan-slug-tieng-viet.md)
- **Phương pháp:** đọc plan + 3 phase + brainstorm; đối chiếu mã/dữ liệu đang pin; **dựng lại bộ
  sinh handle của phase 1 trên generation đang pin**; **chạy thật gate localization trong một
  git worktree dùng-một-lần** (đã xoá sau khi đo, không đụng working tree của người dùng).
- **Kết luận:** **BLOCKED — không nên chuyển sang `ak:cook` trước khi sửa 4 phát hiện dưới đây.**
  Phần lõi (đếm trang, bảng va chạm, URL mục tiêu) đúng và tái lập được; phần **cơ chế gate**
  thì thiếu, và chính gate đó chạy trước `astro build`.

---

## 1. Findings

| # | Mức | Phát hiện | Bằng chứng | Sửa trong plan |
|---|---|---|---|---|
| F1 | **BLOCKER** | Plan không chạm contract localization đã pin, nhưng `npm run build`/`verify` chạy gate này **trước** `astro build`. Đổi tên 2 trang Astro ⇒ gate chết | Mục 2.1 — `FileNotFoundError` thật, rồi 3 lỗi tiếp theo | Thêm file + bước cập nhật `pipeline/site_localization.py`, `pipeline/site-localization-policy.json`, `pipeline/site-translations.json` vào phase 2/3 |
| F2 | **BLOCKER** | Luật sinh phase 1 ghi "Nhóm trùng **base**" nhưng baseline (`22.8/55`) và bảng 8 nhóm chỉ tái lập được khi nhóm theo **`SC + base`** | Mục 2.2 — đọc chữ nghĩa cho 851 hàng gắn tag, `pk-s25-ngo-ky-25-wu-qi`, avg 30.12/max 60 | Ghi rõ nhóm va chạm = `(SC, base)`; nêu rõ baseline đo trên `SC + handle` |
| F3 | **MAJOR** | Validator phase 1 ("handle không được chứa `SC` lặp lại ở đầu") **mâu thuẫn chính bộ sinh**: đúng 1 hàng vi phạm, nên `--write` rồi `--check` không thể cùng xanh | Mục 2.3 — `s3-wei-s3-dingpei-sima`, `SC=s3`, handle `s3-tu-ma-cau-hinh-toi-uu` | Chốt: bỏ token mùa trùng ở đầu khi sinh, **hoặc** bỏ luật validator, **hoặc** khai override trong ledger |
| F4 | **MAJOR** | Bảng handle chỉ nhúng ở `index.astro` ⇒ **trang chi tiết không có handle map**, trong khi 2 file render link đội gốc bằng path cứng lại nằm trong danh sách "Intentionally unchanged" | Mục 2.4 — `js/team-detail.js:93` (có e2e phủ), `js/recommended-reference-render.js:272` | Thêm 2 file vào phase 2; quyết định chỗ nhúng map (index-only vs layout) và hệ quả kích thước |
| F5 | MEDIUM | Phase 3 bảo `src/pages/index.astro` "truyền `ogType`" — trang này **không dùng `SiteLayout`**, nó có `<head>` riêng | Mục 2.5 | Sửa `index.astro` trực tiếp; thêm bước đó vào Steps |
| F6 | LOW | Python tự cài lại `isRoutableIdentifier` (TS) — hai nguồn sự thật cho cùng bất biến, đúng loại vấn đề plan dùng để biện luận thứ tự phase | — | Ghi rõ TS là nguồn chuẩn + test đối chiếu danh sách handle qua cả hai tầng |
| F7 | LOW | Success criteria phase 1 yêu cầu sửa thử `displayNameVi` **trong generation đang pin**; quên hoàn nguyên ⇒ `recommendedPublicationSnapshot` đỏ build | — | Làm trên bản copy, không sửa `src/data/recommended-reference/5202c942…/index.json` |
| F8 | LOW | Payload đo được **58.3 KB** gọn (`{"r":…,"l":…}`), plan ghi 67.1 KB | Mục 2.6 | Cập nhật số; kết luận rủi ro không đổi |
| F9 | LOW | `src/pages/sitemap.xml.ts` là endpoint, không có `Astro.site` — dùng `site` từ context | — | Sửa câu chữ phase 3 |

---

## 2. Bằng chứng chi tiết

### 2.1 F1 — Gate localization (BLOCKER)

`package.json`: `"build": "python3 -m pipeline.site_localization check --root . --stage public && astro build"`,
`"verify"` chạy đúng lệnh đó trước `verify-astro-dist.mjs`. Plan **không** liệt kê
`pipeline/site_localization.py` hay `pipeline/site-localization-policy.json` ở bất kỳ phase nào.

Thí nghiệm: `git worktree add /tmp/tqccl-audit-wt HEAD` (baseline xanh: `exit=0, problems=0`),
rồi `git mv` đúng hai trang như phase 2 mô tả
(`src/pages/teams/recommended/[sourceConfigId].astro` → `src/pages/doi-chuan/[team].astro`,
`…legacy/[legacyTeamId].astro` → `src/pages/doi-khac/[team].astro`):

```text
FileNotFoundError: [Errno 2] No such file or directory: 'src/pages/teams/recommended/[sourceConfigId].astro'
  File ".../pipeline/site_localization.py", line 1236, in ui_source_locations
    source = _repo_member(root, relative, label="UI source").read_text()
exit=1
```

Nguyên nhân: `UI_LITERAL_OBLIGATIONS` (`site_localization.py:319-327`) khoá cứng đường dẫn file
làm **owner** của 9 obligation (`ui:route-recommended/*` ×5, `ui:route-legacy/*` ×4), và
`check()` gọi `concrete_site_locations` → `ui_source_locations` **ngoài mọi try**, nên lỗi nổi
lên thành traceback chứ không thành danh sách problem.

Cập nhật dần từng lớp (đóng vai một implementer cẩn thận) cho thấy còn **ba** chốt nữa:

```text
# sau khi sửa UI_LITERAL_OBLIGATIONS + đổi khoá sourceFiles sang path mới
{"problems":[{"location":"pipeline/site-localization-policy.json",
  "reason":"routeFamily recommended-detail entrypoint is outside the reviewed source inventory:
            src/pages/teams/recommended/[sourceConfigId].astro"}]}

# sau khi sửa thêm routeFamilies[].page/entrypoints/owner
{"problems":[
 {"location":"full-site-inventory","reason":"concrete localization inventory differs from reviewed baseline"},
 {"location":"pipeline/site-translations.json","reason":"stale translation fingerprint: ('ui:route-recommended/title-team', 'title')"}]}
```

Tổng hợp: gate này pin **bốn** thứ mà plan đổi:

1. `pipeline/site_localization.py` — `UI_LITERAL_OBLIGATIONS` (9 entry, path owner).
2. `pipeline/site-localization-policy.json` → `sourceFiles` (33 khoá hash; `policy` còn bắt buộc
   giữ `REQUIRED_OWNER_FILES` gồm `src/lib/team-detail-routes.ts`), `routeFamilies[]`
   (`page`, `entrypoints`, `locations[].owner.file`), `baseline.notes.concreteInventorySha256`
   (digest gồm cả `owner` = `"<path>::<symbol>"`, nên đổi path là đổi digest).
3. `pipeline/site-translations.json` — 9 entry `ui:route-*` có `inputFingerprint` băm cả
   `context.sourceFile`; `validate_translation_entries` ném ở entry lệch **đầu tiên**.
4. Hash của mọi file trong `sourceFiles` mà plan sửa: `js/app.js`, `js/team-detail.js`,
   `js/recommended-reference-render.js`, `src/layouts/SiteLayout.astro`,
   `src/lib/team-detail-routes.ts`, `src/pages/index.astro`, cộng 2 trang Astro bị xoá.

Hệ quả lên plan: `npm run build` đỏ ngay ở bước 1 ⇒ **không có `dist`** ⇒ mọi success criteria
của phase 2/3 (1366+166 trang, sitemap 1533 `<loc>`, canonical) không thể chạm tới. Failure
Protocol của plan ("verify đỏ thì STOP, không nới validator") mà không có bước cập nhật
inventory hợp lệ sẽ khiến cook dừng đúng như thiết kế — nhưng dừng vì lý do plan không dự liệu.

Ghi chú: `pipeline/site-translations.json` là ledger **đã review** (mỗi entry có
`review.reviewer/reviewedAt/evidence/semanticChecks`). Việc refresh fingerprint là thao tác cơ
học trên context, nhưng vẫn phải do plan chỉ định rõ (dùng `capture`/`build`/`publish` của
chính tool, hay cập nhật tay + lý do), nếu không thì đây đúng là chỗ dễ "nới gate cho build xanh".

### 2.2 F2 — Nhóm va chạm: `base` hay `SC + base` (BLOCKER)

Đo lại trên generation đang pin (`5202c942…`, 1366 hàng, `data/teams.json` 166 đội):

| Đại lượng | Đo được | Plan/brainstorm ghi |
|---|---|---|
| `S(displayNameVi)` khác nhau | **656** | 656 ✔ |
| `(SC, base)` khoá duy nhất / nhóm trùng / hàng trong nhóm | **1264 / 83 / 185** | "1181 hàng base duy nhất, 185 hàng nằm trong 83 nhóm trùng" ✔ (1181 = số hàng có khoá riêng) |
| `base` đơn thuần | **540 nhóm, 243 nhóm trùng, 1069 hàng** | brainstorm §5e ghi 243 nhóm / 1069 hàng ✔ |

Nhưng luật sinh phase 1 lại viết: "*Nhóm không trùng **base**… Nhóm trùng **base**…*" — không
kèm mùa. Cài đặt đúng chữ nghĩa đó rồi chạy:

| Cách nhóm | Hàng bị gắn tag | `SC+handle` duy nhất | Dài TB / max | Ví dụ |
|---|---|---|---|---|
| `base` (đúng chữ nghĩa) | **851** | 1366 | **30.12 / 60** | `pk-s25-ngo-ky-25-wu-qi`, `s3-ngo-ky-u-wu-qi`, `pk-s26-don-don-thuan-s26-dundun-dun` |
| `(SC, base)` (đúng baseline) | **165** | 1366 | **22.83 / 55** | `pk-s28-on-hau-cung`, `pk-s28-hoang-ma-hon-hop`, `pk-s11-do-doc-cung-chuyen-huu` |

Baseline của plan ("dài trung bình 22.8, dài nhất 55") **chỉ** khớp cách nhóm thứ hai, và chỉ
cách đó mới tái lập đúng bảng 8 nhóm va chạm (đã kiểm từng dòng, khớp 16/16) cùng các URL
trong `Outcome đã khóa` của plan.md. Plan phải nói thẳng: nhóm va chạm = `(SC, base)`, và
baseline "1366/1366" là trên **`SC + handle`** — handle trần chỉ có 638 giá trị khác nhau
(hoặc 1246 nếu nhóm theo base), nên câu "1366/1366 handle khác nhau" dễ khiến cook tưởng sai
và đi gắn thêm tag.

### 2.3 F3 — Validator mâu thuẫn bộ sinh (MAJOR)

Validator phase 1: "*handle không được chứa `SC` lặp lại ở đầu*". Toàn bộ 1366 hàng chỉ có đúng
một hàng vi phạm:

```text
sourceConfigId = s3-wei-s3-dingpei-sima
displayNameVi  = "S3 Tư Mã cấu hình tối ưu"   → base = s3-tu-ma-cau-hinh-toi-uu
sourceSeasonCode = S3                          → SC   = s3
⇒ handle sinh ra = s3-tu-ma-cau-hinh-toi-uu (bắt đầu bằng SC) ⇒ validator FAIL
```

Nghĩa là `--write` rồi `--check` **không thể** cùng xanh, trong khi Success criteria phase 1 đòi
"`--check` phải xanh trên ledger vừa sinh" và Failure protocol cấm "sửa ledger bằng tay để ép
xanh". Đồng thời URL mà brainstorm §4 mong đợi (`/doi-chuan/s3-tu-ma-cau-hinh-toi-uu/`, một
`s3`) **không** sinh ra được từ luật hiện tại (luật cho `…/s3-s3-tu-ma-cau-hinh-toi-uu/`).

Ba lựa chọn hợp lệ, plan phải chọn một: (a) bỏ token mùa trùng ở đầu handle khi sinh
(rồi ghi vào ledger `tu-ma-cau-hinh-toi-uu`), (b) bỏ luật validator đó (vì `SC+handle` vẫn duy
nhất, chỉ xấu chữ), (c) khai một override có review trong ledger cho hàng này và mô tả override
như một phần của luật (hiện plan khẳng định "0 dòng gán tay").

### 2.4 F4 — Handle map không phủ trang chi tiết (MAJOR)

Phase 2 nhúng bảng handle vào `src/pages/index.astro` và đăng ký ở `js/app.js`. Nhưng
`SiteLayout.astro` hiện nhúng pin cho **mọi** trang, còn `index.astro` là trang duy nhất không
dùng layout; trang chi tiết chỉ nạp `/js/team-detail.js`, **không** nạp `app.js`. Hai chỗ dựng
path đội gốc bằng chuỗi cứng lại nằm ngoài bảng handle:

| Chỗ | Đường dẫn cứng | Có chạy thật không |
|---|---|---|
| `js/team-detail.js:93` | `/teams/legacy/${legacyTeamId}/` | **Có** — hiện trong action `Xem đội gốc` ở nhánh `?variant=` lỗi/không khớp; có e2e phủ (`tests-e2e/team-detail-pages.spec.mjs:224-245`), và có 40 biến thể admitted trên 40 đội |
| `js/recommended-reference-render.js:272` | `/teams/legacy/${reference.legacyTeamId}/` | Hiện **không** (0/1366 hàng có `legacyReferences`) — nhưng sẽ nổ ở generation sau, và vi phạm `docs/code-standards.md:15` |

Cả hai file đang nằm trong danh sách "**Intentionally unchanged**" của phase 2, mà phase 2 lại
yêu cầu "xoá mọi khẳng định còn pin `/teams/...`" trong các spec e2e — tức bước 6 sẽ buộc phải
sửa khẳng định cho một link mà mã sản xuất vẫn sinh ra path cũ. Cần: thêm hai file vào Files,
và chốt chỗ nhúng map. Lưu ý đánh đổi mà plan chưa cân: nhúng vào `SiteLayout` thì mọi trang
chi tiết cũng có map, nhưng cộng ~58 KB vào **từng** trang (1532 trang ⇒ ~90 MB `dist`); nhúng
theo `index.astro` như plan thì phải truyền handle riêng qua data attribute cho từng trang chi
tiết.

### 2.5 F5 — `index.astro` không dùng `SiteLayout` (MEDIUM)

`grep -rn "SiteLayout" src/` trả về đúng 3 chỗ dùng: `404.astro`, `teams/recommended/[sourceConfigId].astro`,
`teams/legacy/[legacyTeamId].astro`. `src/pages/index.astro` tự viết `<head>` (dòng 7-19, có
`og:type` riêng ở dòng 16). Phase 3 Files ghi "*Modify: … `src/pages/index.astro` — truyền
`ogType`*" là bất khả thi, và Steps chỉ sửa `SiteLayout` — nên success criteria "`dist/index.html`
có `rel="canonical"`" sẽ không đạt được nếu làm đúng theo Steps. Phải sửa `<head>` của
`index.astro` trực tiếp (file này cũng nằm trong `sourceFiles` pin của F1).

### 2.6 F8 — Kích thước bảng handle

Đo trên ledger sinh theo luật `(SC, base)`: `{"r":{…1366…},"l":{…166…}}` gọn =
**59 695 byte (58.3 KB)**; plan ghi 67.1 KB. Các số còn lại của plan khớp: `dist/index.html`
= 5 113 byte (5.1 KB) và `…/index.json` = 3 374 536 byte (3.37 MB).

---

## 3. Đã kiểm và xác nhận đúng

| Hạng mục | Kết quả đo |
|---|---|
| `index.json` 1366 hàng, `other-teams.json` 40 hàng admitted, `data/teams.json` 166 đội | ✔ khớp plan |
| Hàng thiếu `displayNameVi` / `sourceSeasonCode` / `tierOrder` / `value` / `listIndex` | ✔ 0 (đúng như plan); `nameZh` thiếu 2, `factionRaw` thiếu 4 |
| Luật `(SC, base)` sinh **1366 handle duy nhất** trên `SC+handle`, 0 `None`, max 55 byte, mọi handle qua `isRoutableIdentifier` | ✔ tái lập baseline |
| Bảng 8 nhóm va chạm (3 Ôn Hầu Cung, 3 Hoàng Mã, `pk-s26-don-don-thuan-yxms-031`, `pk-s11-do-doc-cung-chuyen-huu`) | ✔ khớp **16/16 dòng**, kể cả bên giữ URL trơn |
| URL mục tiêu trong plan.md: `og-40y-lu-bo-cung-vuong-di`, `pk-s24-tu-ma-phi-hung`, `pk-s28-hoang-ma`, `pk-s28-hoang-ma-hon-hop`, `doi-khac/hoang-ma-thuong` | ✔ sinh đúng |
| Đội khác: 166 handle duy nhất, **14 nhóm trùng** tag bằng số cuối `id`, nhãn `nickname\|\|name` 0 chữ Hán | ✔ khớp baseline |
| `pipeline/recommended-identity-map.json`: 661 entry `kind: team` (khoá theo alias ⇒ không chứa được handle theo hàng) | ✔ |
| Danh sách test phải sửa: 4 `tests-js` + 4 `tests-e2e`; không file nào khác còn pin `/teams/...` ngoài 4 file JS đã nêu | ✔ |
| `public/_headers` đang phủ `/teams/recommended/*`, `/teams/legacy/*`; `tests-js/pages-headers-contract.test.mjs` so khớp **đúng thứ tự** 9 rule | ✔ |
| `@astrojs/sitemap` không có trong `node_modules`; `astro.config.mjs` `site: https://tqccl.pages.dev`, `output: static` | ✔ |
| `scripts/verify-astro-dist.mjs:8` import `teamDetailCatalog`; allowlist `DEPLOYMENT_CONTROL_ARTIFACTS` + `STATIC_PUBLIC_ARTIFACTS`; `expectedFiles` dựng từ `catalog.htmlPaths` | ✔ |
| Sitemap 1533 `<loc>` = 1 + 1366 + 166 | ✔ số học khớp |
| Trích dẫn dòng: `team-detail-routes.ts:10-19`, `js/team-detail.js:37`, `team-detail-navigation.js:26-29` & `:188`, `js/app.js:279/347-348/377`, `index.astro:69-71`, `SiteLayout.astro:40-46`, `code-standards.md:15` & `:39`, `verify-astro-dist.mjs:8/14-18/58-66`, `docs/deployment-guide.md:101/108-109/135/240` | ✔ tất cả chính xác |

---

## 4. Việc phải sửa trong plan trước khi cook

1. **Phase 1**
   - Sửa luật: "nhóm va chạm = cùng `SC` và cùng `base`"; nói rõ baseline `1366/1366` là trên
     `SC + handle`, và handle trần không duy nhất toàn cục (638 giá trị).
   - Chốt xử lý F3 (bỏ token mùa trùng ở đầu / bỏ luật validator / override có review) và cập
     nhật Success criteria cho khớp.
   - Ghi rõ `isRoutableIdentifier` bên TS là nguồn chuẩn; thêm test đối chiếu hai tầng (F6).
   - Đổi bài kiểm "sửa thử `displayNameVi`" sang bản copy generation (F7).
2. **Phase 2**
   - Thêm vào Files: `pipeline/site_localization.py`, `pipeline/site-localization-policy.json`,
     `pipeline/site-translations.json`, `js/team-detail.js`, `js/recommended-reference-render.js`.
   - Thêm bước: cập nhật 9 `UI_LITERAL_OBLIGATIONS`, `routeFamilies`, `sourceFiles`
     (giữ `REQUIRED_OWNER_FILES`), `baseline.notes.concreteInventorySha256`, và refresh 9
     `inputFingerprint` của ledger; nêu rõ dùng lệnh nào của tool và có cần review lại không.
   - Quyết định chỗ nhúng handle map phủ cả trang chi tiết, kèm đánh đổi kích thước `dist`.
3. **Phase 3**
   - Sửa Files/Steps: canonical + `og:url` cho `index.astro` sửa trực tiếp (không qua `ogType`
     của `SiteLayout`), và nhắc rằng `SiteLayout.astro` + `index.astro` đều phải re-pin hash.
   - Sửa câu "`Astro.site`" trong endpoint thành `site` từ context (F9).
   - Cập nhật số payload 58.3 KB (F8).

## 5. Còn phải xác minh khi triển khai (không kiểm được ở tầng kế hoạch)

- Bảng handle sau khi review: 8 nhóm va chạm + hậu tố delta `yxms-031`/`chuyen-huu` là **quy
  ước**, không phải đúng/sai ngữ nghĩa; người dùng nên đọc qua trước khi đóng băng.
- 166 hàng nhận tag dưới luật đã sửa — cần xác nhận chất lượng tag trước khi freeze.
- Rủi ro đã ghi trong plan.md về root page phình lên vì payload nhúng: đo thật sau build.
- Việc "đợt 2" (42 hàng lệch binh chủng, 38 hàng thiếu `unitTypesRaw`) **không** thuộc audit
  này; audit không tự cấp quyền chạy crawl hay deploy.

---

## 6. Đã áp dụng vào plan

Bốn file plan đã được sửa theo các finding trên (2026-09-18, sau audit này).

| Finding | Sửa gì | Ở đâu |
|---|---|---|
| F1 | Thêm Step 7 "Refresh contract localization" với 6 bước con: `inventory --report` để lấy digest mới; sửa 9 `UI_LITERAL_OBLIGATIONS`; sửa `sourceFiles`/`routeFamilies`/`baseline.notes.concreteInventorySha256` + bump `policyVersion`; refresh fingerprint qua `expected_fingerprints(site_translation_obligations(...), glossary_digest(...))`; refresh batch receipt `site-review-v5-056` + output reviewer; gate riêng `check --stage public`. Thêm 3 file pipeline vào Files, thêm gate vào Success criteria + Failure protocol (kèm cấm tự refresh fingerprint để né review) | phase-02 Files/Steps/Success/Failure, plan.md Verification contract + Rủi ro |
| F2 | Luật ghi rõ **khoá nhóm va chạm = `(SC, base)`**, kèm số liệu phản chứng của cách nhóm theo `base` (243 nhóm/1069 hàng, URL `pk-s25-ngo-ky-25-wu-qi`); baseline ghi rõ đo trên `SC + handle`, handle trần 638 giá trị không phải bất biến | phase-01 Luật sinh + Baseline + Validator |
| F3 | Thêm bước 6 của luật: cắt token mùa trùng ở đầu handle, nêu đúng hàng `s3-wei-s3-dingpei-sima` → `/doi-chuan/s3-tu-ma-cau-hinh-toi-uu/`; Success criteria thêm "0 handle bằng/bắt đầu bằng `SC`" | phase-01 |
| F4 | Thêm `js/team-detail.js` + `js/recommended-reference-render.js` + `src/layouts/SiteLayout.astro` vào Files; contract runtime đổi thành hai surface (`{r,l}` ở root, `{l}` ở trang chi tiết) và giải thích vì sao; Step 5 sửa hai path cứng; Success criteria thêm phép kiểm link "Xem đội gốc" | phase-02, plan.md Decision table + Done |
| F5 | Files/Steps đổi thành sửa `<head>` của `src/pages/index.astro` trực tiếp; bỏ "truyền `ogType`" cho trang gốc | phase-03 |
| F6 | Ghi chú thực thi: TS là nguồn chuẩn, Python cài lại, catalog TS là tầng kiểm thứ hai | phase-01 Failure protocol |
| F7 | Step 5 đổi sang kiểm trên bản copy với cờ `--generation-root`, cấm sửa file trong `src/data/recommended-reference/` | phase-01 |
| F8 | 67.1 KB → **58.3 KB** (`{l}` ~4.4 KB), ở cả Evidence phase 2 và Rủi ro plan.md | phase-02, plan.md |
| F9 | `Astro.site` trong endpoint → `site` từ `APIContext` | phase-03 |

Kiểm lại luật đã sửa trên generation đang pin (1366 hàng): `SC + handle` duy nhất **1366**,
**0** handle bằng/bắt đầu bằng `SC`, **0** handle rỗng, **166** hàng có tag, dài TB **22.83**,
max **55**, mọi handle qua `isRoutableIdentifier`; bảng 8 nhóm va chạm vẫn khớp 16/16 dòng;
URL mục tiêu của plan.md không đổi, và `s3-wei-s3-dingpei-sima` cho đúng
`/doi-chuan/s3-tu-ma-cau-hinh-toi-uu/` như brainstorm §4 mong đợi.

Chỉ dẫn fingerprint trong Step 7.4 đã được chạy thử: `expected_fingerprints(
site_translation_obligations(root, pack), glossary_digest(root, policy))` trả đúng 9 khoá
`ui:route-*` và khớp ledger hiện tại ⇒ sau khi đổi path chỉ cần lấy lại 9 giá trị mới.

Trạng thái sau khi sửa: không còn finding nào ở mức BLOCKER/MAJOR. Điều kiện còn lại để cook
chạy được là có người/agent review độc lập cho 9 receipt ở Step 7.5 — nếu chưa có thì phase 2
dừng ở gate localization đúng như Failure protocol, không được bỏ qua.
