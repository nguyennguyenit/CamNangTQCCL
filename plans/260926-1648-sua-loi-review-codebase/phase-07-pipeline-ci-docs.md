---
phase: 7
title: "Pipeline, CI, hygiene và docs"
status: pending
priority: P2
effort: "3d"
dependencies: [6]
---

# Phase 7: Pipeline, CI, hygiene và docs

## Goal
Pipeline rebuild không đổi ID đã công khai, các lệnh trong runbook chạy được đúng như docs ghi, repo không còn track dữ liệu dẫn xuất/riêng tư lớn, CI chạy khi đổi CSS/`public/`, và toàn bộ docs mô tả đúng code sau Phase 2–6.

## Contract
- Pipeline logic: ReviewPipeline#1 (`pipeline/normalize.py:237` + `pipeline/build_json.py:33-42` đánh số lại 110 ID `moi-phe`), #3 (`build_books_dict` lỗi với `归心`, `兵行诡道`, `pipeline/books-han-viet-map.json:60-61`; hai tên có trong `data/books-dict.json`), #7 (`--resume` không dùng, `pipeline/crawl_sgsdeck_recommended.py:229`; không lệnh nào ghi `scope-inventory.json`, `:232-234`), #17 (`pipeline/build_season_data.py:36` khoá theo `--output-dir`), #18 (`pipeline/suggest_aliases.py:18,30`), #20 (`pipeline/hanviet.py:135` lấy khớp đầu thay vì dài nhất), #16 (helper trùng lặp, ưu tiên thấp, làm cuối).
- Pipeline docs/hygiene: ReviewPipeline#2 (`build_dict` đã bị chặn vĩnh viễn, `pipeline/build_dict.py:118-121`, docs còn ghi là bước thường), #4 (`data/facets.json` lệch xa hơn "1 đội"), #5 (`pipeline/lookup-output/site-vi-candidate/`, `site-vi-activation/` lọt `.gitignore:29-34`), #6 (`--catalog` bắt buộc, `pipeline/build_recommended_reference.py:741`, thiếu ở `docs/season-team-data.md:91-97`), #12 phần docs (`parse_coexist_csv` là thư viện không CLI), #14 (`pipeline/recommended-missing-translations.json` pin generation `fb8b3871…`), #15 (`docs/unified-lookup.md:50,73`), #19 (docstring `build_json.py:3`, `docs/system-architecture.md:38`).
- Repo/CI: ReviewAstroCss#4 phần prune (35 generation cũ; quyết định Q5 = A: `git rm` + ignore, giữ lịch sử), #7 (`.github/workflows/mcp-worker.yml:26-63` thiếu `css/**`, `public/**`, `tsconfig.json`), #17 (`assets/videos/…`, 54 file = 19 `.mp4` + 34 `.jpg` + 1 `.md`, `team-list.md:3` lộ đường dẫn máy; Q5 = A), #18 (3 script npm thừa, `package.json`), #20 (`_site/`, `.wrangler/` gốc, plan `260907-2333` còn `in-progress`).
- Docs còn lại: ReviewJsCore#15 (`docs/project-overview-pdr.md:21,34-36`, `docs/system-architecture.md:218`), ReviewJsTools#19 phần số liệu (`docs/codebase-summary.md:70-71`), ReviewAstroCss#14 phần docs (`docs/deployment-guide.md:269`).

## Files to Create / Modify
- Create: `tests/test_suggest_aliases.py`.
- Modify pipeline: `pipeline/build_json.py`, `pipeline/normalize.py`, `pipeline/build_books_dict.py`, `pipeline/books-han-viet-map.json` (nếu cần cờ), `pipeline/crawl_sgsdeck_recommended.py`, `pipeline/build_season_data.py`, `pipeline/suggest_aliases.py`, `pipeline/hanviet.py`, `pipeline/site_localization.py` (lệnh `prune`), `data/facets.json` (nếu Phase 2 bước G chưa sinh lại); ưu tiên thấp: `pipeline/common.py` (mới) + các module có helper trùng.
- Delete: `pipeline/build_dict.py`, `pipeline/crawl_tactics.py`, `pipeline/link_tactics.py`, `tests/test_build_dict.py`, `tests/test_crawl_tactics.py`, `tests/test_link_tactics.py`, `pipeline/tactic-name-overrides.json`, `pipeline/role-tag-map.json` (chuỗi chỉ phục vụ `build_dict`, đã grep; **giữ** `data/tactics-generic.json` vì là artifact công khai `legacy-public/build-input`, `src/lib/public-artifact-manifest.mjs:71`).
- Untrack: `pipeline/lookup-output/site-vi-candidate/`, `pipeline/lookup-output/site-vi-activation/`, `pipeline/recommended-missing-translations.json`, 35 generation cũ dưới `src/data/recommended-reference/`, 53 file media `assets/videos/team-info-from-download-260701/` (giữ `team-list.md`).
- Modify tests: `tests/{test_build,test_build_books_dict,test_crawl_sgsdeck_recommended,test_build_season_data,test_hanviet,test_site_localization}.py`.
- Modify repo: `.gitignore`, `.github/workflows/mcp-worker.yml`, `package.json`, `assets/videos/team-info-from-download-260701/team-list.md`, `plans/260907-2333-project-research-skill/plan.md` (frontmatter `status`).
- Modify docs: `README.md` (`:86,160`), `docs/deployment-guide.md` (`:59,74,269`, cảnh báo rebuild), `docs/system-architecture.md` (`:38-39,56,218`), `docs/codebase-summary.md` (`:57-58,70-71,83,85,110`), `docs/project-overview-pdr.md` (`:21,34-36,68,85`), `docs/project-roadmap.md` (`:12`), `docs/code-standards.md` (`:83`), `docs/season-team-data.md` (`:79-97,224`, publish + prune, `parse_coexist_csv`), `docs/unified-lookup.md` (`:50,73`), `docs/project-changelog.md`.

## Tasks & Steps

### A. ID ổn định khi rebuild (ReviewPipeline#1)
- [ ] **Test trước.** `tests/test_build.py`: patch `pipeline.build_json.parse_team_intro` trả raw fixture cho 2 nguồn (thứ tự như `_TEAM_FILES`, `:23-26`), truyền danh sách đội đã commit có `moi-phe-62…` → `build_teams(committed=…)` giữ đúng ID theo tập tướng; đội mới nhận số kế tiếp của đúng nguồn; đội đã commit biến mất khỏi nguồn → `SystemExit` liệt kê ID. Đỏ: trả `moi-phe-50…`.
- [ ] **Sửa.** `build_json` đọc `data/teams.json` đang commit, ghép theo (nguồn, tập tên tướng đã sắp; trùng thì theo thứ tự), `normalize_team` nhận ID thay vì chỉ số toàn cục (`normalize.py:237`); docstring `build_json.py:3` nói đúng (ghi đè, `sort_keys=False`) (ReviewPipeline#19); `docs/system-architecture.md:38` "ghi đè" + link cảnh báo; `docs/deployment-guide.md:74` thêm cảnh báo ID và cách chạy an toàn.

### B. `build_books_dict` với dữ liệu thật (ReviewPipeline#3)
- [ ] **Test trước.** `tests/test_build_books_dict.py`: `build_books_dict(_load_map(), <facets.json thật>.books)` không ném. Đỏ: `ValueError … 'Quy Thuận' … không thuộc facets.json.books`.
- [ ] **Sửa.** Hai sách có trong `data/books-dict.json` (đã đếm) nên không xoá: validator chấp nhận dòng map có cờ `"outsideTeams": true` (hoặc bảng phụ trong cùng file) cho sách không đội nào dùng; `data/books-dict.json` sau `python3 -m pipeline.build_books_dict` phải trùng byte bản đang commit.

### C. `facets.json` (ReviewPipeline#4)
- [ ] `data/facets.json` đã được sinh lại ở Phase 2 bước G (Q4 = A) nên bước này chỉ thêm test giữ nó không trôi. **Test:** `tests/test_build.py` — `data/facets.json` bằng `build_facets(data/teams.json)` và tổng `sources` = tổng `statuses` = `len(teams)`. Test viết xong chạy trên `data/facets.json` của commit trước Phase 2 (`git stash`/worktree tạm) để thấy đỏ (213 ≠ 166), rồi xanh trên cây hiện tại. Docs: bỏ câu "lệch 1 đội" (`README.md:160`, `docs/codebase-summary.md:85,110`, `docs/deployment-guide.md:74`, `docs/project-overview-pdr.md:68`), đánh dấu xong mục `docs/project-roadmap.md:12`.

### D. Crawler (ReviewPipeline#7) và lệnh builder (ReviewPipeline#6)
- [ ] **Test trước.** `tests/test_crawl_sgsdeck_recommended.py`: `main(["--cache", tmp, "--freeze-inventory", <fixture picker HTML trong tests/fixtures/sgsdeck-recommended>])` ghi `scope-inventory.json` bằng đúng inventory `discover_scopes()` trả; chạy lại không có inventory vẫn báo hướng dẫn. Đỏ: tham số lạ.
- [ ] **Sửa.** Bỏ `--resume` (cache đã là điểm tiếp tục), thêm `--freeze-inventory`; `docs/season-team-data.md:79-85` bỏ `--resume`, thêm bước freeze; `:91-97` thêm `--catalog data/heroes-dict.json` (catalog mà `compile_candidate` dùng, `site_localization.py:1957`) — chạy thử lệnh với `--output /tmp/…` để xác nhận.

### E. Khoá mùa (ReviewPipeline#17)
- [ ] **Test trước.** `tests/test_build_season_data.py`: `dictionary_exclusion` với `root` tạm và `output_dir` ở thư mục khác → khoá nằm ở `<root>/pipeline/lookup-output/promotion.lock`, không tạo `pipeline/` dưới cha của `output_dir`; khoá đã có hoặc journal `activation-prepared`/`writing` → từ chối. Đỏ: khoá ở cha `output_dir`.
- [ ] **Sửa.** Dùng `LOCK_RELATIVE`, `JOURNAL_STATES` của `pipeline/promote_unified_lookup.py:23-25` với `root` của repo.

### F. `suggest_aliases` (ReviewPipeline#18) và `hanviet` (ReviewPipeline#20)
- [ ] **Test trước.** `tests/test_suggest_aliases.py`: raw fixture có `SP Tuân Úc` và `SP Tuân Úc(S)`, `Tôn Thương Hương` (đã là khoá alias) → không cụm nào được đề xuất cho hai trường hợp này; file quét = `_TEAM_FILES` của `build_json` (không có `Team Đô Úy.html`). `tests/test_hanviet.py`: patch `COMPOUND_READINGS` = `{"AB": "x", "ABC": "y"}` → đọc `"ABC"` ra `"y"`. Đỏ cả hai.
- [ ] **Sửa.** Gom theo `parse_hero(nameRaw)["baseName"]`, bỏ tên đã là khoá trong `aliases.json`, dùng `_TEAM_FILES`; `hanviet.py:135` duyệt `sorted(COMPOUND_READINGS, key=len, reverse=True)`.

### G. Nghỉ chuỗi `build_dict` (ReviewPipeline#2) — dọn, miễn test-first
- [ ] Xoá 3 module + 3 test + 2 bảng (danh sách ở Files); grep lại `build_dict|crawl_tactics|link_tactics|tactic-name-overrides|role-tag-map` trên `pipeline/ tests/ scripts/ mcp-worker/ docs/ README.md` → chỉ còn changelog. Docs: bỏ khỏi lệnh thường (`README.md:86`, `docs/deployment-guide.md:59`), `docs/system-architecture.md:39` ghi từ điển do Unified Lookup sở hữu, `docs/codebase-summary.md:58,83`, `docs/code-standards.md:83` không coi hai bảng đã xoá là input đang publish.

### H. Dữ liệu dẫn xuất và riêng tư (ReviewPipeline#5, #14, #15, #12 docs)
- [ ] `git rm -r --cached pipeline/lookup-output/site-vi-candidate pipeline/lookup-output/site-vi-activation` (file trên đĩa giữ nguyên, tái tạo được); `.gitignore` đổi `:29-34` thành `pipeline/lookup-output/*candidate*/`, `pipeline/lookup-output/*activation*/`. Theo Q5 = A không purge lịch sử (hai blob ~23 MB còn trong `.git`).
- [ ] `pipeline/recommended-missing-translations.json`: ngừng commit (không file nào đọc, đã grep); `docs/season-team-data.md:224` ghi ra `.cache/recommended-missing-translations.json` sau mỗi publish.
- [ ] `docs/unified-lookup.md`: `:73` evidence hiện tại là transaction `site-vi-260926-1928` (`committed`, khớp `lookup:064fd2d5…`); `:50` dùng `<activation-manifest>`.
- [ ] `docs/season-team-data.md` mục Cùng Tồn: `parse_coexist_csv` là thư viện không CLI, `build_content_links` là bộ sinh `season-content-links.json`, cách gọi bằng Python.

### I. Prune generation (ReviewAstroCss#4) — Q5 = A
- [ ] **Test trước.** `tests/test_site_localization.py`: root tạm có 3 thư mục generation + `current.json` trỏ một cái → `main(["prune", "--root", tmp])` chỉ còn thư mục đang pin; `current.json` trỏ thư mục không tồn tại → từ chối, không xoá gì. Đỏ: lệnh chưa có.
- [ ] **Sửa.** Lệnh `prune` trong `pipeline/site_localization.py` (xoá thư mục generation ≠ `current.generationId`, không tham số giữ thêm); thêm vào quy trình publish trong `docs/season-team-data.md:184-193` (sau `check --stage public`) và thay G6 của plan này. Chạy `python3 -m pipeline.site_localization prune --root .` → `git add -A src/data/recommended-reference` (35 generation cũ thành xoá trong commit). Không `git filter-repo`, không force-push: lịch sử giữ nguyên, cây làm việc và clone nông nhỏ đi; `.git` không đổi kích thước.

### J. Repo, CI, docs còn lại (ReviewAstroCss#7, #14, #17, #18, #20; ReviewJsCore#15; ReviewJsTools#19)
- [ ] `.github/workflows/mcp-worker.yml` thêm `"css/**"`, `"public/**"`, `"tsconfig.json"` vào cả `pull_request.paths` và `push.paths`; chạy `npm --prefix mcp-worker test -- test/release/repository-gate.test.ts`.
- [ ] `package.json` bỏ `test:contracts`, `test:dev-contract`, `test:e2e:astro` (hai file test vẫn chạy trong `test:node`; project Playwright duy nhất là `astro`).
- [ ] `assets/videos/…`: `git rm --cached` 53 file media (19 `.mp4`, 34 `.jpg`), chuyển bản trên đĩa sang `~/.Trash/CamNangTQCCL-cleanup-<yymmdd>/assets-videos/` (khôi phục được); `.gitignore` thêm `assets/videos/**/*.mp4`, `assets/videos/**/*.jpg`; giữ `team-list.md` (được 2 báo cáo `plans/reports/research-260703-*` trỏ tới), dòng `:3` chỉ giữ tên file gốc, bỏ đường dẫn máy. Lịch sử giữ nguyên (Q5 = A).
- [ ] `_site/`, `.wrangler/` gốc chuyển vào Thùng rác (ignored, không ai tham chiếu); plan `260907-2333` `status: completed` (skill `tqccl-research` đã commit ở `82076bb`).
- [ ] Docs: `docs/project-overview-pdr.md:21,34-36` (8 trang mục theo đường dẫn, hash chỉ còn chuyển tiếp), `docs/system-architecture.md:218` (lỗi JSON hiện ở mount của trang mục), `docs/codebase-summary.md:70-71` (202 tướng, 406 chiến pháp, theo `docs/unified-lookup.md:7-8`), `docs/deployment-guide.md:269` (bỏ "danh mục"; "chuyển Thẻ/Thẻ gọn/Bảng" theo Q7 = A đã làm ở Phase 3).

### K. Helper dùng chung (ReviewPipeline#16) — ưu tiên thấp, làm cuối
- [ ] **Test trước (đặc tả hiện trạng).** Chạy mọi bản `slug` hiện có trên toàn bộ tên thật (`data/heroes-dict.json`, `data/tactics.json`, `data/lookup-catalog.json`, `pipeline/team-route-handles.json` giá trị, tên đội `data/teams.json`) và ghi cặp nào cho kết quả giống hệt nhau; test mới khẳng định helper chung cho **đúng** kết quả của từng bản được gộp trên cùng tập tên (xanh trước khi thay, bảo toàn). Bản nào khác ngữ nghĩa (vd. slug handle của `team_route_handles.py:121`) → **không gộp**, ghi lý do trong báo cáo.
- [ ] **Sửa.** `pipeline/common.py`: `canonical_json` (luôn `allow_nan=False`), `sha256_hex`, các slug đã chứng minh trùng, `lookup_exclusion(root)` (khoá + journal, dùng ở bước E); thay các bản sao đã chứng minh tương đương. Mọi test Python + `site_localization check --stage public` (byte generation không đổi) + `team_route_handles --check` xanh.

### L. Kết phase
- [ ] G2 xác nhận không file bị ghim nào stale (phase này không sửa file `sourceFiles`; `pipeline/site_localization.py` thêm lệnh `prune` không nằm trong `sourceFiles` và không đổi output candidate — `check --stage public` phải vẫn exit 0). Changelog ghi rõ dọn theo Q5 = A (chỉ untrack, lịch sử giữ nguyên); `reports/phase-07.md` (dung lượng `src/data/recommended-reference` trước/sau, danh sách file untrack, đường dẫn Thùng rác).

## Verification
- `python3 -m unittest discover -s tests` → pass (các test mới đã thấy đỏ trước sửa).
- `python3 -m pipeline.build_books_dict` → exit 0 và `git diff --exit-code data/books-dict.json`.
- `python3 -m pipeline.build_recommended_reference <lệnh đúng như docs, --output /tmp/rr-out>` → không lỗi thiếu tham số.
- `git ls-files src/data/recommended-reference | awk -F/ '{print $4}' | sort -u` → `current.json` + đúng 1 generation; `git ls-files pipeline/lookup-output assets/videos` → chỉ `assets/videos/team-info-from-download-260701/team-list.md`; `git check-ignore pipeline/lookup-output/site-vi-candidate/ledger.json` → bị ignore; `git log --oneline | wc -l` không giảm (không viết lại lịch sử).
- `grep -n '"css/\*\*"\|"public/\*\*"\|"tsconfig.json"' .github/workflows/mcp-worker.yml` → 6 dòng.
- Gate A2 exit 0.
