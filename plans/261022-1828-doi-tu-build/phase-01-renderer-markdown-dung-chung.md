---
phase: 1
title: "Renderer Markdown dùng chung (view-tree, profile admin/ugc)"
status: pending
priority: P1
effort: "0.5d"
dependencies: []
---

# Phase 1 — Renderer Markdown dùng chung

## Goal

Có module `js/markdown.js` biến Markdown thành cây `js/view-tree.js`, chạy được cả trong Node (`treeToHtml`) lẫn trình duyệt (`treeToDom`), với hai profile:
- `admin` giữ **đúng** hành vi của `renderMarkdown` cũ trong `js/community-admin.js`, có test khoá.
- `ugc` cho bài người dùng: giải mã escape/entity, code span và fence N backtick, `ol start`, link có ngoặc cân bằng, không ảnh, link lọc theo origin, trích dẫn tối đa 2 cấp.

Khung xem trước bài blog ở `/quan-tri/` chuyển sang dùng module này với profile `admin`, và renderer cũ bị xoá. <!-- Red Team #6, #15 -->

## Context links

- Số dòng là tham chiếu ≈ trên `0f89e2e`; luôn tìm theo symbol ghi kèm. <!-- Red Team #3 -->
- Renderer cũ trong `js/community-admin.js`: khối chú thích "Markdown an toàn" ≈`:35`, `safeHref` ≈`:39-44`, `safeImageSrc` ≈`:46-51`, `INLINE_PATTERN` ≈`:53`, `inlineNodes` ≈`:55-75`, `renderMarkdown` ≈`:78-141`. Grep `renderMarkdown` trên toàn repo ra 3 dòng: định nghĩa ≈`:78`, lời gọi đệ quy cho blockquote ≈`:130`, nơi gọi duy nhất ≈`:1590` (`paintPreview`). <!-- Red Team Fact Checker -->
- Hành vi cũ cần giữ cho `admin`:
  - Fence đóng ở **mọi** dòng bắt đầu bằng ```` ``` ```` (≈`:88-93`).
  - Tiêu đề `#{1,4}` ra `h{n+1}` (≈`:95-99`).
  - List không có `start` (≈`:107-120`).
  - Blockquote đệ quy (≈`:122-131`).
  - Inline dùng một regex `INLINE_PATTERN` (code một backtick; link `[^)\s]+`), không giải mã escape/entity.
- Cây view: `js/view-tree.js` `h`, `treeToHtml` (escape `& < >`), `treeToDom` (nhận `doc`).
- Manifest `/js/`: `src/lib/public-artifact-manifest.mjs` `PUBLIC_ARTIFACTS` (mỗi file `js/*.js` phải có `entry("js", …)`); test đếm `tests-js/astro-dist-contract.test.mjs` (`result.assetCount`); test cú pháp ES2022 `tests-js/browser-baseline.test.mjs`.
- Markdown thực tế TipTap xuất ra: [researcher §1.3](./reports/researcher-261023-tiptap-astro.md).
- Chuỗi mẫu bài cũ sau migration `0012`: định nghĩa ở [phase 2 task 2.7](./phase-02-worker-bao-tri-body-md-migration.md); ca 18 của task 1.3 dùng đúng chuỗi đó.
- Điều kiện bắt đầu: [plan.md "Phụ thuộc chéo plan"](./plan.md).

## Files to Create/Modify

- Tạo: `js/markdown.js`, `tests-js/markdown.test.mjs`
- Sửa: `js/community-admin.js` (xoá renderer cũ, đổi `paintPreview`, thêm import)
- Sửa: `src/lib/public-artifact-manifest.mjs` (thêm `entry("js", "markdown")`)
- Ghi: `plans/261022-1828-doi-tu-build/reports/release-log.md` (tạo file, mục "Điều kiện bắt đầu")

## Tasks

### Task 1.0 — Điều kiện bắt đầu và worktree <!-- Red Team #2, #3 -->
- Goal: PR #36 và `fix/community-teams-ui-polish` đã ở `main`; plan chạy trong worktree riêng tách từ `origin/main`; các symbol neo vẫn còn; không file nào plan sửa bị ghim.
- Target files and symbols: worktree `/Users/plateau/Project/worktrees/CamNangTQCCL-doi-tu-build`, nhánh `feat/doi-tu-build`; `pipeline/site-localization-policy.json` (`sourceFiles`).
- Steps:
  1. `git fetch origin`
  2. `gh pr view 36 --json state -q .state`
  3. `git merge-base --is-ancestor a1ba727 origin/main; echo $?`. Nếu in `1`, chạy `gh pr list --state merged --head fix/community-teams-ui-polish --json number -q 'length'` (nhánh được squash-merge thì lệnh này in ≥ 1).
  4. Nếu bước 2 khác `MERGED`, hoặc cả hai lệnh ở bước 3 đều không đạt: **DỪNG và hỏi user**, không làm tiếp.
  5. `git worktree add /Users/plateau/Project/worktrees/CamNangTQCCL-doi-tu-build -b feat/doi-tu-build origin/main`. Từ đây **mọi lệnh của plan chạy trong thư mục worktree này** (trừ khi task ghi worktree khác).
  6. `npm ci && (cd community-worker && npm ci)`
  7. Kiểm symbol neo: mỗi lệnh sau phải in đúng `1`:
     - `grep -c "export function renderMarkdown" js/community-admin.js`
     - `grep -c 'entry("js", "match-dict")' src/lib/public-artifact-manifest.mjs`
     - `grep -c "export function communityPageHref" js/community-api.js`
     - `grep -c "export async function signOut" js/community-api.js`
     - `grep -c "export const COMMUNITY_PAGES" scripts/verify-astro-dist.mjs`
     - `grep -c "export function mountTeamForm" js/community-team-form.js`
     - `grep -c "export function modeFromSearch" js/community-team-state.js`
     - `grep -c "export function initCommunityTeams" js/community-teams.js`
  8. Kiểm file ghim:
     ```sh
     node -e "const f=Object.keys(require('./pipeline/site-localization-policy.json').sourceFiles);const ours=['js/markdown.js','js/community-admin.js','js/community-admin-teams.js','js/community-admin-users.js','js/community-api.js','js/community-auth.js','js/community-comments.js','js/community-reports.js','js/community-team-data.js','js/community-team-form.js','js/community-team-state.js','js/community-teams.js','src/lib/public-artifact-manifest.mjs','src/components/pages/CommunityTeamsPage.astro','src/components/community/CommunityTeamsHub.astro','src/components/community/ReportsHub.astro','src/components/community/AdminConsole.astro','src/components/pages/PrivacyPage.astro','src/pages/doi-cong-dong/index.astro','src/pages/zh/doi-cong-dong/index.astro','css/styles.css','public/_headers','public/_redirects','scripts/verify-astro-dist.mjs','astro.config.mjs','package.json','playwright.config.mjs'];const hit=ours.filter(x=>f.includes(x));console.log(hit.length?hit.join(','):'none')"
     ```
  9. Tạo `plans/261022-1828-doi-tu-build/reports/release-log.md` (trong worktree), mục "Điều kiện bắt đầu": output bước 2, 3 và 8, SHA `git rev-parse --short origin/main`.
- Success criteria: #36 MERGED; ui-polish đã ở `main`; worktree tồn tại trên nhánh `feat/doi-tu-build`; 8 symbol còn; không file ghim.
- Verify: bước 2 in `MERGED`; bước 3 in `0` (hoặc lệnh dự phòng in số ≥ 1); `git -C /Users/plateau/Project/worktrees/CamNangTQCCL-doi-tu-build rev-parse --abbrev-ref HEAD` in `feat/doi-tu-build`; 8 lệnh của bước 7 đều in `1`; bước 8 in `none`.

### Task 1.1 — Viết `js/markdown.js`
- Goal: hàm `markdownTree(source, { profile = 'admin', siteOrigin } = {})` trả **mảng** nút view-tree (mỗi khối một nút).
- Target files and symbols: `js/markdown.js` (export `markdownTree`); import duy nhất `import { h } from './view-tree.js';`. Không import gói npm, không chạm `document`, không có state cấp module.
- Steps:
  1. Chuẩn hoá đầu vào (cả hai profile): `String(source ?? '')`, đổi `\r\n` và `\r` thành `\n`. Riêng `ugc`: thay mọi ký tự `U+E000` và `U+E001` có sẵn bằng `U+FFFD` (hai ký tự này dành cho placeholder ở bước 5).
  2. Nếu `profile === 'ugc'` mà `siteOrigin` không phải chuỗi URL hợp lệ: `throw new Error('markdownTree: siteOrigin is required for the ugc profile')`.
  3. **Profile `admin`**: chuyển nguyên thuật toán `renderMarkdown` + `inlineNodes` + `INLINE_PATTERN` + `safeHref` + `safeImageSrc` cũ sang dạng trả nút `h(...)` thay vì DOM (mỗi `el(tag, attrs, kids)` thành `h(tag, attrs, kids)`, `fragment.append(x)` thành `blocks.push(x)`). Giữ nguyên mọi regex, thứ tự kiểm, cách đóng fence, mapping tiêu đề `h{n+1}`, list không `start`, đệ quy blockquote. Không giải mã escape/entity.
  4. **Profile `ugc`**, tách khối theo dòng:
     - Code fence: dòng bắt đầu bằng ≥ 3 backtick mở khối; đóng ở dòng bắt đầu bằng số backtick ≥ số lúc mở; ra `h('pre', {}, [h('code', {}, text)])`, nội dung giữ nguyên.
     - Tiêu đề `/^(#{1,6})\s+(.*)$/`: `n ≤ 2` ra `h2`, `n ≥ 3` ra `h3`.
     - Kẻ ngang `/^\s*(---+|\*\*\*+)\s*$/` ra `h('hr')`.
     - Danh sách `/^\s*([-*+]|\d+[.)])\s+(.*)$/`: gom dòng liên tiếp cùng loại; list lồng bị làm phẳng; `ol` có `start` (chuỗi) khi số đầu khác 1.
     - Trích dẫn: dòng `^>\s?` liên tiếp, bỏ một dấu `>`, gọi lại phần tách khối với `depth + 1` (bắt đầu `depth = 0`); bọc trong `h('blockquote', {}, children)`. Khi `depth` đã là 2 thì dòng bắt đầu bằng `>` **không** mở trích dẫn mới mà được xử lý như dòng đoạn thường. <!-- Red Team #6 -->
     - Dòng trống kết thúc đoạn; dòng khác `trim()` rồi gom vào đoạn, nối bằng một dấu cách, ra `h('p', {}, inline(...))`. Bỏ đoạn mà sau giải mã chỉ còn khoảng trắng hoặc `U+00A0`.
  5. Hàm inline của `ugc`, quét trái sang phải:
     - `\` + một ký tự ASCII dấu câu (`!`–`/`, `:`–`@`, `[`–`` ` ``, `{`–`~`): ra ký tự đó dưới dạng placeholder.
     - Dãy `n` backtick: tìm dãy đóng có đúng `n` backtick; có thì ra placeholder của nút `h('code', {}, nội dung)` (nội dung giữ nguyên; nếu bắt đầu và kết thúc bằng dấu cách và không toàn dấu cách thì bỏ một dấu cách mỗi đầu); không có thì giữ nguyên các backtick.
     - Entity `&amp; &lt; &gt; &quot; &apos; &nbsp; &#N; &#xH;`: ra placeholder ký tự đã giải mã; số 0, lớn hơn `0x10FFFF` hoặc thuộc vùng surrogate ra `U+FFFD`.
     - Placeholder = `U+E000` + chỉ số thập phân + `U+E001`, chỉ số trỏ vào một mảng cục bộ của lần gọi.
     - Trên chuỗi đã thay placeholder, áp regex theo thứ tự `\*\*(.+?)\*\*` → `strong`, `\*(?!\s)(.+?)\*` → `em`, `!\[([^\]]*)\]\(DEST\)` → ảnh, `\[([^\]]+)\]\(DEST\)` → link, với `DEST = ((?:[^()\s]|\([^()\s]*\))+)`. Nội dung xử lý đệ quy bằng regex này (đệ quy theo độ dài chuỗi, bị chặn bởi 10 000 ký tự). Mọi chuỗi và giá trị `href`/`alt` trả về phải được khôi phục placeholder.
  6. Link/ảnh của `ugc`: `href` đã trim phải bắt đầu bằng `http://`, `https://` hoặc `/` nhưng không phải `//` và không chứa `\`; `new URL(href, siteOrigin)` không ném và có `protocol` là `http:` hoặc `https:`. Cùng origin với `new URL(siteOrigin).origin` → `h('a', { href: url.pathname + url.search + url.hash }, …)`. Khác origin → `h('a', { href: url.href, rel: 'nofollow ugc noopener', target: '_blank' }, …)`. Không đạt → chỉ ra chữ của link. Ảnh không bao giờ ra `img`, chỉ ra chữ `alt`.
  7. Viết chú thích đầu file tiếng Việt: module thuần, không HTML thô, hai profile, `admin` giữ hành vi cũ cho xem trước blog, `ugc` cho bài người dùng.
- Success criteria: file chỉ import `./view-tree.js` và export `markdownTree`.
- Verify: `node -e "import('./js/markdown.js').then(m => console.log(typeof m.markdownTree))"` in đúng `function`.

### Task 1.2 — Đăng ký `js/markdown.js` trong manifest
- Goal: `/js/markdown.js` được publish như các module `js/` khác.
- Target files and symbols: `src/lib/public-artifact-manifest.mjs`, mảng `PUBLIC_ARTIFACTS`.
- Steps:
  1. Thêm dòng `  entry("js", "markdown"),` ngay trước dòng `  entry("js", "match-dict"),` (tìm theo chuỗi; PR #36 có chèn thêm entry quanh chỗ này).
- Success criteria: manifest có đúng một entry `markdown`.
- Verify: no verification needed (task 1.5 chạy `npm run test:node` và `npm run test:dist`).

### Task 1.3 — Test Node cho renderer
- Goal: hành vi ở task 1.1 được khoá bằng test so sánh HTML chính xác.
- Target files and symbols: `tests-js/markdown.test.mjs` (`node:test`, `node:assert/strict`, `markdownTree` từ `../js/markdown.js`, `treeToHtml` từ `../js/view-tree.js`; `const html = (md, opts) => markdownTree(md, opts).map(treeToHtml).join('')`; `const UGC = { profile: 'ugc', siteOrigin: 'https://tqccl.com' }`).
- Steps: viết các ca dưới đây, mỗi ca một `assert.equal(html(input, opts), expected)`. Đầu vào ghi dạng literal chuỗi JS (đã escape `\\`). Chuỗi kỳ vọng sau dấu `=` là **nội dung thực** của HTML; khi chép vào JS, đổi mỗi `\` thành `\\` (ví dụ `<code>a\_b</code>` viết thành `"<code>a\\_b</code>"`).
  1. `html("# A\n\n## B\n\n### C\n\n#### D", UGC)` = `<h2>A</h2><h2>B</h2><h3>C</h3><h3>D</h3>`.
  2. `html("# A\n## B")` = `<h2>A</h2><h3>B</h3>` (profile mặc định `admin`).
  3. `html("R&amp;D a\\_b \\*x\\* &lt;b&gt; &#39;q&#x27;", UGC)` = `<p>R&amp;D a_b *x* &lt;b&gt; 'q'</p>`.
  4. `html("\\&lt; giữ nguyên", UGC)` = `<p>&amp;lt; giữ nguyên</p>`.
  5. `html("``a`b`` và `a\\_b`", UGC)` = `<p><code>a`b</code> và <code>a\_b</code></p>`.
  6. `html("[x](https://x.com/a_(b))", UGC)` = `<p><a href="https://x.com/a_(b)" rel="nofollow ugc noopener" target="_blank">x</a></p>`.
  7. `html("[d](/doi-chuan/) [e](https://tqccl.com/tra-cuu/?q=1#a)", UGC)` = `<p><a href="/doi-chuan/">d</a> <a href="/tra-cuu/?q=1#a">e</a></p>`.
  8. `html("[j](javascript:alert(1)) [p](//evil.com/x) [m](mailto:a@b.c)", UGC)` = `<p>j p m</p>`.
  9. `html("[m](mailto:a@b.c)")` = `<p><a href="mailto:a@b.c" rel="noopener" target="_blank">m</a></p>`.
  10. `html("![ảnh](https://x.com/a.png)", UGC)` = `<p>ảnh</p>`; `html("![ảnh](https://x.com/a.png)")` = `<p><img src="https://x.com/a.png" alt="ảnh" loading="lazy"></p>`.
  11. `html("a\n\n&nbsp;\n\nb", UGC)` = `<p>a</p><p>b</p>`.
  12. `html("<script>x</script>", UGC)` = `<p>&lt;script&gt;x&lt;/script&gt;</p>`.
  13. `html("- a\n  - b\n- c", UGC)` = `<ul><li>a</li><li>b</li><li>c</li></ul>`.
  14. `html("3. a\n4. b", UGC)` = `<ol start="3"><li>a</li><li>b</li></ol>`; `html("1. a", UGC)` = `<ol><li>a</li></ol>`.
  15. `html("\\# không phải tiêu đề\n\n\\- a\n\n1\\. a", UGC)` = `<p># không phải tiêu đề</p><p>- a</p><p>1. a</p>`.
  16. `html("> **đậm** và *nghiêng*", UGC)` = `<blockquote><p><strong>đậm</strong> và <em>nghiêng</em></p></blockquote>`.
  17. `assert.throws(() => markdownTree("x", { profile: "ugc" }), /siteOrigin/)`.
  18. Chuỗi bài cũ sau migration (trùng từng ký tự với ca vi của phase 2 task 2.7):
      ```js
      const MIGRATED_VI = [
        "## Lối chơi", "",
        "Mở đầu \\*nhanh\\* \\[Tào Tháo]", "",
        "\\# 1 chủ lực", "",
        "\\> 50% máu", "",
        "- a\\_b \\`x\\` \\\\ R\\&D", "",
        "## Điểm mạnh", "",
        "Mạnh", "",
        "## Bị khắc chế bởi", "",
        "Kỵ",
      ].join("\n");
      ```
      `html(MIGRATED_VI, UGC)` = `<h2>Lối chơi</h2><p>Mở đầu *nhanh* [Tào Tháo]</p><p># 1 chủ lực</p><p>&gt; 50% máu</p><ul><li>a_b `x` \ R&amp;D</li></ul><h2>Điểm mạnh</h2><p>Mạnh</p><h2>Bị khắc chế bởi</h2><p>Kỵ</p>`.
  19. Đầu file: `assert.equal(typeof document, "undefined")`.
  20. `admin` không giải mã: `html("&amp; \\_a")` = `<p>&amp;amp; \_a</p>`. <!-- Red Team #15 -->
  21. `admin` đóng fence ở dòng ```` ``` ```` bất kỳ: `html("````\na\n```\nb\n````")` = `<pre><code>a</code></pre><p>b</p><pre><code></code></pre>`. <!-- Red Team #15 -->
  22. `admin` không có `start`: `html("3. a")` = `<ol><li>a</li></ol>`. <!-- Red Team #15 -->
  23. `admin` giữ regex link cũ: `html("[x](https://x.com/a_(b))")` = `<p><a href="https://x.com/a_(b" rel="noopener" target="_blank">x</a>)</p>`. <!-- Red Team #15 -->
  24. Trích dẫn sâu bị chặn ở `ugc`: `html(">".repeat(9990) + "x", UGC)` = `<blockquote><blockquote><p>` + `"&gt;".repeat(9988)` + `x</p></blockquote></blockquote>`; thêm helper `depth(node)` (độ sâu lồng tối đa của cây, `typeof node === "string"` thì 0) và assert `Math.max(...markdownTree(">".repeat(9990) + "x", UGC).map(depth)) <= 4`. <!-- Red Team #6 -->
- Success criteria: 24 ca có trong file và đều đạt.
- Verify: `node --experimental-strip-types --test tests-js/markdown.test.mjs` exit 0 và output có dòng `# fail 0`.

### Task 1.4 — Chuyển xem trước bài blog sang module mới, xoá renderer cũ
- Goal: `/quan-tri/#bai-viet` xem trước bằng `markdownTree(..., { profile: 'admin' })`; không còn mã renderer trùng lặp.
- Target files and symbols: `js/community-admin.js`: khối từ chú thích `/* ---------- Markdown an toàn (xem trước) ---------- */` tới hết hàm `renderMarkdown`; hàm `paintPreview`.
- Steps:
  1. Thêm sau dòng `import { el, icon, svgNode } from './render.js';`: `import { markdownTree } from './markdown.js';` và `import { treeToDom } from './view-tree.js';`.
  2. Xoá khối chú thích "Markdown an toàn", `safeHref`, `safeImageSrc`, `INLINE_PATTERN`, `inlineNodes`, `renderMarkdown`.
  3. Đổi `paintPreview` thành `const paintPreview = () => preview.replaceChildren(...markdownTree(bodyInput.value, { profile: 'admin' }).map((node) => treeToDom(node)));`.
  4. Sửa chú thích đầu file ("xem trước an toàn") cho đúng: xem trước dựng bằng `js/markdown.js` profile `admin`.
- Success criteria: không còn `renderMarkdown`, `safeImageSrc`, `INLINE_PATTERN` trong `js/`.
- Verify: grep `renderMarkdown|safeImageSrc|INLINE_PATTERN` trong `js/` trả 0 kết quả; `node --check js/community-admin.js` exit 0.

### Task 1.5 — Cổng của phase
- Goal: phase không làm hỏng test hiện có; commit chỉ chứa file của phase.
- Target files and symbols: worktree `feat/doi-tu-build`.
- Steps:
  1. `npm run test:node`
  2. `npm run build`
  3. `npm run verify`
  4. `npm run test:dist`
  5. `python3 -m pipeline.site_localization check --root . --stage public`
  6. `git add js/markdown.js tests-js/markdown.test.mjs js/community-admin.js src/lib/public-artifact-manifest.mjs plans/261022-1828-doi-tu-build/reports/release-log.md` <!-- Red Team #2 -->
  7. `git diff --cached --name-only`
  8. `git commit -m "feat(community): shared view-tree Markdown renderer with admin/ugc profiles"`
- Success criteria: lệnh 1–5 exit 0; commit chỉ gồm 5 file của bước 6.
- Verify: lệnh 1–5 exit 0 (`npm run test:node` in `# fail 0`; `npm run verify` không in `dist allowlist mismatch`); output bước 7 đúng 5 dòng của bước 6 và không chứa `docs/design/` hay `scripts/design-canvas/shot.mjs`.

## Risk

- `admin` được chuyển 1:1 thuật toán cũ và khoá bằng ca 2, 9, 10, 20–23; mọi khác biệt hành vi chỉ nằm ở `ugc`.
- Module có thể có hai bản (thô ở `/js/`, bundle nếu editor import): không có state cấp module nên vô hại.

## Security

- Không đường nào nhận HTML thô: mọi chữ đi qua `treeToHtml`/`treeToDom`.
- `ugc` chặn `javascript:`, `data:`, `//host`, backslash, `mailto:`, không xuất `img`, link ngoài có `nofollow ugc noopener`.
- `ugc` giới hạn trích dẫn 2 cấp, nên cây có độ sâu bị chặn: `treeToHtml`/`treeToDom` (đệ quy) không tràn stack với bài gửi thẳng qua API. Profile `admin` vẫn đệ quy không giới hạn như cũ, nhưng chỉ dùng cho bài blog do admin viết.
- Placeholder dùng ký tự vùng riêng đã bị lọc khỏi đầu vào `ugc` ở bước 1.

## Failure Protocol
If any Verify step does not meet its stated pass condition, STOP this phase.
Do not improvise a fix, retry blindly, or reason around the failure.
Spawn the `kongming` subagent for next-step counsel and pass:
- the phase and task id,
- what you attempted (the steps you ran),
- the exact command and its full output,
- the pass condition it failed to meet.
Apply kongming's guidance, then re-run the Verify step.
If `kongming` cannot be spawned in this environment, STOP and report the same
failure evidence to the user. Never continue by self-reasoning.
