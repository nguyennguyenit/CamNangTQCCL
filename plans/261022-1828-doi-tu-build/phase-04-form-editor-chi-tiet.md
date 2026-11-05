---
phase: 4
title: "Form 1 ảnh tự đọc, editor TipTap + textarea dự phòng, nháp, đăng lại, trang chi tiết, quản trị, preview"
status: pending
priority: P1
effort: "2.5d"
dependencies: [1, 2, 3]
---

# Phase 4 — Form, editor TipTap, trang chi tiết

## Goal

Người dùng đã đăng nhập viết bài ở `/doi-tu-build/?new=1`:
- Chọn **một** ảnh là ảnh tự tải lên và tự được AI đọc đúng một lần (không có nút). Form hiện số lượt đọc AI còn lại.
- Sửa ô tướng/chiến pháp và viết thân bài trong editor TipTap (`<cm-md-editor>`). Nếu editor không tải được, form chuyển sang `<textarea>` Markdown. <!-- Red Team #5, #12 -->
- Nháp tự lưu trên trình duyệt, gắn với vòng đời view: không mất khi rời trang, không hồi sinh sau khi gửi, bị xoá khi đăng xuất, hết hạn sau 30 ngày. <!-- Red Team #4 -->
- Bài bị từ chối đăng lại được.

Trang chi tiết và khu quản trị hiển thị `bodyMd` qua `js/markdown.js` profile `ugc`. Cuối phase, một lần deploy preview kiểm chuyển hướng 302 và, không bắt buộc, gõ IME. <!-- Red Team #14 -->

Không sửa thẻ "null" và tiêu đề lặp: `fix/community-teams-ui-polish` đã sửa và đã merge trước. <!-- Red Team #15 -->

## Context links

- Số dòng là tham chiếu ≈ trên `0f89e2e`. ui-polish đã đổi `js/community-teams.js` (`teamCard`, heading); PR #36 đã đổi `js/community-api.js` (`signOut`), `css/styles.css`, `scripts/verify-astro-dist.mjs`, `tests-js/astro-dist-contract.test.mjs`. Luôn tìm theo symbol. <!-- Red Team #3 -->
- Form hiện tại `js/community-team-form.js`:
  - Hằng `MAX_IMAGES`, `OPTIONAL_FIELDS`; hàm `formMessage`; `mountTeamForm` ≈`:67`.
  - `applyDraft` ≈`:219`; ô ảnh có `readButton` "Đọc bằng AI"; `applyRead`; hai chuỗi tải lên/đọc độc lập.
  - `playstyleInput`, `optional`; `showFieldError`; listener `submit`. <!-- Red Team Fact Checker -->
- Hàm thuần `js/community-team-state.js`: `OPTIONAL_FIELDS`, `PLAYSTYLE_MIN`, `TEXT_MAX`, `OPTIONAL_MAX`, `MAX_UPLOADS`, `teamPayloadFromDraft`, `modeFromSearch`.
- Test `tests-js/community-team-state.test.mjs`: `FIELDS` ≈`:47-56`; assert `body.strengths` ≈`:63`; `body.uploadIds` `["up1","up2"]` ≈`:65`; `playstyle: "ngắn"` ≈`:100`; `playstyle: "𠮷".repeat(5)` ≈`:152`; khối 7 `assert.deepEqual(modeFromSearch(…), { mode, id })` ≈`:164-170`. <!-- Red Team #9 -->
- Trang `js/community-teams.js`:
  - `ANALYSIS_FIELDS`; tab trong `nav`; khối phân tích trong `detailView` (`el('dl', { class: 'cm-team-analysis' }, …)`).
  - `mineView` (`mineCard`), `newView`, `render` (`renderToken`, `isCurrent`, `mount.replaceChildren(view)`), listener `popstate`.
- Quản trị `js/community-admin-teams.js`: `ANALYSIS_FIELDS`, `detailNodes`, `summary` "Xem phân tích".
- Lỗi `js/community-api.js`:
  - `CommunityError`, `statusMessage` (429 "vài phút"), `codeMessage`, `api`. Nhánh `specific` của `api` ném lỗi không có `unavailable`, nên bộ đồng bộ (`js/recruit-sync.js` `isOffline`) coi 503 bảo trì là lỗi cứng. <!-- Red Team #10 -->
  - `signOut`: sau PR #36 xoá khoá roster trong `finally`.
- TipTap: [researcher](./reports/researcher-261023-tiptap-astro.md) §1.1–1.5, §2, §3, §5.
- Astro/Vite:
  - `astro.config.mjs` `vite` (chỉ có `plugins`). Vite mặc định target `safari16.4`, trong khi baseline repo là Safari 16 (`tests-js/browser-baseline.test.mjs`). <!-- Red Team #5 -->
  - `playwright.config.mjs` `webServer` (`npm run build && npm run preview`, `timeout: 30_000`); từng chạm giới hạn này (`docs/deployment.md` "reruns stopped at the 30 s `webServer` limit"). <!-- Red Team #15 -->
- Verifier: `scripts/verify-astro-dist.mjs` `COMMUNITY_PAGES`, mảng `expectedFiles` (allowlist chính xác), vòng `for (const { htmlPath, mount, entry } of COMMUNITY_PAGES)`; fixture `tests-js/astro-dist-contract.test.mjs` `communityPageHtml` và vòng ghi `COMMUNITY_PAGES`.
- CSS: `css/styles.css` `.adm-team-field`, `.adm-md-preview …`, `.cm-team-analysis*`, `.cm-team-text`, `.cm-status[data-kind="error"]` (`var(--avoid)`), token `--size-col-200`.
- E2E: `tests-e2e/community-teams.spec.mjs` (`teamDetail`, `uploadAndRead`, các test form, của tôi, quản trị "Xem phân tích"); mock `tests-e2e/helpers/community-mock.mjs` (`json`, route đội dùng `pick` không `await`).

## Files to Create/Modify

- Sửa: `package.json`, `package-lock.json` (14 gói `@tiptap/*` 3.32.0, `devDependencies`)
- Sửa: `astro.config.mjs` (`vite.build.target`), `playwright.config.mjs` (nếu task 4.5 đo build > 20 s) <!-- Red Team #5, #15 --> <!-- Updated: Kongming advice - đánh số lại 4.3–4.5 -->
- Tạo: `src/scripts/md-editor-extensions.ts`, `src/scripts/md-editor-tiptap.ts`, `src/scripts/md-editor-element.ts`
- Sửa: `src/components/pages/CommunityTeamsPage.astro`
- Sửa: `scripts/verify-astro-dist.mjs`, `tests-js/astro-dist-contract.test.mjs`
- Sửa: `js/community-team-state.js`, `js/community-team-form.js`, `js/community-teams.js`, `js/community-admin-teams.js`, `js/community-api.js`
- Sửa: `css/styles.css`
- Tạo: `tests-js/md-editor-roundtrip.test.mjs`; sửa: `tests-js/community-team-state.test.mjs`
- Sửa: `tests-e2e/community-teams.spec.mjs`, `tests-e2e/helpers/community-mock.mjs`
- Ghi: `plans/261022-1828-doi-tu-build/reports/release-log.md` (mục "Gói TipTap", "Build", "Preview", "IME")

## Tasks

### Task 4.1 — Cài TipTap pin chính xác, không chạy script <!-- Red Team #13 -->
- Goal: 14 gói `@tiptap/*` cùng bản `3.32.0`, ghi chính xác; không chạy lifecycle script lúc cài; chữ ký registry hợp lệ; danh sách gói gián tiếp được ghi lại.
- Target files and symbols: `package.json` `devDependencies`, `package-lock.json`; `release-log.md` mục "Gói TipTap".
- Steps:
  1. `npm install --ignore-scripts --save-dev --save-exact @tiptap/core@3.32.0 @tiptap/pm@3.32.0 @tiptap/markdown@3.32.0 @tiptap/extension-document@3.32.0 @tiptap/extension-paragraph@3.32.0 @tiptap/extension-text@3.32.0 @tiptap/extension-heading@3.32.0 @tiptap/extension-bold@3.32.0 @tiptap/extension-italic@3.32.0 @tiptap/extension-code@3.32.0 @tiptap/extension-list@3.32.0 @tiptap/extension-blockquote@3.32.0 @tiptap/extension-link@3.32.0 @tiptap/extensions@3.32.0`
  2. `npm audit signatures`
  3. `git diff -U0 package-lock.json | grep '^+    "node_modules/'` → chép nguyên output (danh sách gói mới, trực tiếp và gián tiếp) vào `release-log.md` mục "Gói TipTap", kèm `npm ls marked linkifyjs prosemirror-view prosemirror-model`.
  4. Đọc danh sách ở bước 3: mọi gói phải thuộc `@tiptap/*`, `prosemirror-*`, `marked`, `linkifyjs`, `orderedmap`, `rope-sequence`, `w3c-keyname` hoặc `@types/*`; có gói khác thì **DỪNG và hỏi user**.
- Success criteria: mọi khoá `@tiptap/*` trong `package.json` = `3.32.0`; `npm audit signatures` sạch; danh sách gói đã ghi và không có gói lạ.
- Verify:
  - `node -e "const d=require('./package.json').devDependencies;const t=Object.entries(d).filter(([k])=>k.startsWith('@tiptap/'));console.log(t.length, t.every(([,v])=>v==='3.32.0'))"` in `14 true`.
  - Bước 2 exit 0.
  - `npm ls @tiptap/core @tiptap/pm` exit 0, không in `invalid`.
  - `release-log.md` có mục "Gói TipTap".

### Task 4.2 — Bộ extension tường minh (dùng chung editor và test)
- Goal: một hàm trả đúng tập node/mark mà `js/markdown.js` profile `ugc` hiểu, cấm list lồng, escape đầu đoạn.
- Target files and symbols: `src/scripts/md-editor-extensions.ts`, export `contentExtensions()` và `isAllowedLink(url: string): boolean`.
- Steps:
  1. Import từ các gói ở task 4.1 (import nội bộ dùng đuôi `.ts`, theo `src/lib/season-pages.ts`).
  2. `isAllowedLink(url)`: `true` khi `url.trim()` khớp `/^https?:\/\//i` hoặc bắt đầu bằng `/` nhưng không bằng `//`.
  3. `contentExtensions()` trả mảng theo thứ tự: `Document`, `Paragraph` mở rộng (bước 4), `Text`, `Heading.configure({ levels: [2, 3] })`, `Bold`, `Italic`, `Code`, `BulletList`, `OrderedList`, `ListItem.extend({ content: 'paragraph' })`, `Blockquote`, `Link.configure({ openOnClick: false, autolink: false, linkOnPaste: false, defaultProtocol: 'https', isAllowedUri: (url) => isAllowedLink(url) })`. Không dùng StarterKit, không bật `HardBreak`, `CodeBlock`, `HorizontalRule`, `Strike`, `Underline`, `Image`, `ListKeymap`.
  4. `Paragraph.extend({ renderMarkdown })`: gọi bản gốc rồi, nếu chuỗi kết quả bắt đầu bằng `#`, `>`, `-` + dấu cách, `+` + dấu cách, hoặc khớp `/^\d+[.)]\s/`, chèn `\` trước ký tự đầu (trường hợp số: trước `.`/`)`). Vá upstream tiptap#8134. Cách gọi bản gốc (`this.parent` hoặc dạng khác) được chốt ở task 4.3 bước 1 trước khi viết bước này; ghi đúng cách đã chốt. <!-- Updated: Kongming advice - chốt hợp đồng TipTap trước tích hợp -->
- Success criteria: file biên dịch được với `npm run check`.
- Verify: no verification needed (task 4.3 chạy test trên chính hàm này).

### Task 4.3 — Chốt hợp đồng TipTap 3.32.0 và test round-trip (Node) <!-- Updated: Kongming advice - chuyển lên ngay sau 4.2 -->
- Goal: trước khi dựng editor và sửa verifier, biết chắc ba điều trên đúng bản đã pin:
  - API `MarkdownManager` (tên hàm serialize/parse);
  - cách `renderMarkdown` của một extension mở rộng gọi bản gốc;
  - Markdown do editor xuất ra hiển thị đúng qua `markdownTree(…, ugc)` và schema cấm list lồng.
- Target files and symbols: `node_modules/@tiptap/markdown/dist/index.d.ts` (chỉ đọc), `node_modules/@tiptap/core/dist/index.d.ts` (chỉ đọc), `tests-js/md-editor-roundtrip.test.mjs` (import `MarkdownManager` từ `@tiptap/markdown`, `getSchema` từ `@tiptap/core`, `contentExtensions` từ `../src/scripts/md-editor-extensions.ts`, `markdownTree` từ `../js/markdown.js`, `treeToHtml` từ `../js/view-tree.js`); `release-log.md` mục "Hợp đồng TipTap".
- Steps:
  1. Chốt API trên bản cài thật, ghi vào `release-log.md` mục "Hợp đồng TipTap":
     - `grep -n "class MarkdownManager" -A 40 node_modules/@tiptap/markdown/dist/index.d.ts`: tên và chữ ký của hàm Markdown → JSON và JSON → Markdown.
     - `grep -n "renderMarkdown" node_modules/@tiptap/core/dist/index.d.ts`: kiểu của `renderMarkdown` trong config extension, và `this`/tham số dùng để gọi bản gốc (`parent`).
     - Nếu tên khác `serialize`/`parse` hoặc không có cách gọi bản gốc: sửa các bước dưới theo tên thật **chỉ khi** chữ ký tương đương 1:1. Nếu không có cơ chế gọi bản gốc thì DỪNG theo Failure Protocol, không tự chép lại renderer của Paragraph.
  2. Hoàn tất bước 4 của task 4.2 theo cách gọi bản gốc vừa chốt.
  3. `const manager = new MarkdownManager({ extensions: contentExtensions() });`, `const render = (json) => markdownTree(manager.serialize(json), { profile: 'ugc', siteOrigin: 'https://tqccl.com' }).map(treeToHtml).join('')` (dùng tên hàm đã chốt ở bước 1).
  4. Viết 6 ca:
     - Ca 1: doc gồm heading level 2 "Lối chơi"; paragraph "đậm" (bold), " ", "nghiêng" (italic); bulletList "một", "hai"; blockquote chứa paragraph "trích"; paragraph "R&D a_b <b>". `render(doc)` = `<h2>Lối chơi</h2><p><strong>đậm</strong> <em>nghiêng</em></p><ul><li>một</li><li>hai</li></ul><blockquote><p>trích</p></blockquote><p>R&amp;D a_b &lt;b&gt;</p>`.
     - Ca 2: paragraph "# không phải tiêu đề" → `manager.serialize` bắt đầu bằng `\#`; `render` = `<p># không phải tiêu đề</p>`.
     - Ca 3: paragraph "x" có link `https://x.com/a_(b)` → `<p><a href="https://x.com/a_(b)" rel="nofollow ugc noopener" target="_blank">x</a></p>`.
     - Ca 4: paragraph "a`b" có mark code → `<p><code>a`b</code></p>`.
     - Ca 5: `getSchema(contentExtensions()).nodeFromJSON(nested).check()` ném lỗi (listItem chứa paragraph rồi bulletList).
     - Ca 6: `manager.serialize(manager.parse("## A\n\nb"))` = `"## A\n\nb"`.
- Success criteria: mục "Hợp đồng TipTap" ghi tên hàm và cách gọi bản gốc; 6 ca đạt.
- Verify: `release-log.md` có mục "Hợp đồng TipTap"; `node --experimental-strip-types --test tests-js/md-editor-roundtrip.test.mjs` exit 0 và in `# fail 0`.

### Task 4.4 — Editor TipTap và custom element `<cm-md-editor>` <!-- Red Team #4 --> <!-- Updated: Kongming advice - token vòng đời, bỏ import() về muộn -->
- Goal: `<cm-md-editor>` nạp TipTap bằng `import()` khi được gắn vào DOM. Nó phải:
  - luôn giữ giá trị Markdown mới nhất (kể cả sau khi bị gỡ);
  - huỷ editor khi bị gỡ;
  - bỏ qua kết quả `import()` về sau khi đã bị gỡ;
  - phát `editor-ready` khi sẵn sàng và `editor-error` khi nạp lỗi.
- Target files and symbols: `src/scripts/md-editor-tiptap.ts` (export `createEditor`, `toolbarActions`), `src/scripts/md-editor-element.ts` (class `MdEditorElement`, thẻ `cm-md-editor`).
- Steps:
  1. `md-editor-tiptap.ts`: `export function createEditor(mount: HTMLElement, { value, placeholder, label, onUpdate, onRejectedFile })` tạo `new Editor({ element: mount, extensions: [...contentExtensions(), Markdown, UndoRedo, Placeholder.configure({ placeholder })], content: value, contentType: 'markdown', editorProps: { attributes: { 'aria-label': label, 'aria-multiline': 'true', role: 'textbox', class: 'cm-md-editor-content' }, handlePaste(view, event) { if (event.clipboardData?.files?.length) { onRejectedFile(); return true; } return false; }, handleDrop(view, event) { if (event.dataTransfer?.files?.length) { onRejectedFile(); return true; } return false; } }, onUpdate: () => onUpdate() })`. HTML dán vào để schema lọc. Trả editor.
  2. `toolbarActions(editor)` trả `{ key, run }` cho `h2`, `h3`, `bold`, `italic`, `bulletList`, `orderedList`, `blockquote`, `link`. Lệnh đổi khối (`h2`, `h3`, hai list, `blockquote`) **không chạy** khi `editor.view.composing` là `true`. `link`: `window.prompt` lấy URL; rỗng thì `unsetLink`; `isAllowedLink` sai thì không làm gì.
  3. `md-editor-element.ts`:
     - Attribute do form truyền (đã bản địa hoá): `data-label`, `data-placeholder`, `data-loading`, `data-error`, `data-file-rejected`, `data-tools` (JSON nhãn 8 nút).
     - Trường riêng `#value = ''`, `#loadToken = 0`, `#editor = null`. `get value()`: `#editor` có thì `#editor.getMarkdown()`, không thì `#value`. `set value(v)`: `#value = String(v)`; `#editor` có thì `#editor.commands.setContent(#value, { contentType: 'markdown' })`.
     - `async connectedCallback()`:
       - `const token = ++this.#loadToken;`.
       - Dựng `div.cm-md-toolbar` (nút `type="button"`, `aria-pressed` theo `editor.isActive`), `div.cm-md-editor-mount` và `p.cm-md-editor-status` chữ `data-loading`.
       - `try { const mod = await import('./md-editor-tiptap.ts'); if (token !== this.#loadToken || !this.isConnected) return; … } catch { if (token !== this.#loadToken || !this.isConnected) return; … }`.
       - Nhánh thành công: tạo editor với `#value`, xoá chữ trạng thái, rồi `this.dispatchEvent(new Event('editor-ready', { bubbles: true }))`.
       - `onUpdate`: `#value = editor.getMarkdown()` **rồi** phát `new Event('input', { bubbles: true })`.
       - `onRejectedFile`: chữ trạng thái = `data-file-rejected`.
       - Nhánh lỗi: chữ trạng thái = `data-error`, phát `new Event('editor-error', { bubbles: true })`.
     - `focus()`: `#editor?.commands.focus()`.
     - `disconnectedCallback`: `this.#loadToken += 1` (vô hiệu mọi `import()` đang chờ); nếu có `#editor` thì `#value = #editor.getMarkdown()`, `#editor.destroy()`, `#editor = null`; xoá con.
     - Cuối file: `if (!customElements.get('cm-md-editor')) customElements.define('cm-md-editor', MdEditorElement);`.
- Success criteria: hai file biên dịch được; `md-editor-element.ts` chỉ nạp `md-editor-tiptap.ts` qua `import()` động; cả hai nhánh sau `await` đều kiểm `token` và `isConnected`.
- Verify: no verification needed (task 4.5 build, task 4.10 e2e).

### Task 4.5 — Nạp editor từ trang, target Vite, allowlist `_astro`, thời gian build
- Goal: HTML của `/doi-tu-build/` (vi, zh) có đúng một `<script type="module" src="/_astro/….js">`. Build nhắm Safari 16. Verifier chấp nhận tập `_astro` đi theo script đó và từ chối file `_astro` lạ. Playwright không bị cắt vì build chậm hơn.
- Target files and symbols: `src/components/pages/CommunityTeamsPage.astro`; `astro.config.mjs` (`vite`); `playwright.config.mjs` (`webServer.timeout`); `scripts/verify-astro-dist.mjs` (`COMMUNITY_PAGES`, `expectedFiles`, vòng kiểm trang cộng đồng); `tests-js/astro-dist-contract.test.mjs` (`communityPageHtml`, vòng ghi `COMMUNITY_PAGES`, test "dist verifier rejects missing, unexpected…").
- Steps:
  1. Trước khi sửa: `/usr/bin/time -p npm run build` → ghi giây `real` vào `release-log.md` mục "Build" là "trước".
  2. `CommunityTeamsPage.astro`: ngay sau `<CommunityTeamsHub locale={locale} />` (trước script `is:inline`), thêm khối không có thuộc tính nào:
     ```astro
     <script>
       import '../../scripts/md-editor-element.ts';
     </script>
     ```
  3. `astro.config.mjs`: trong `vite`, thêm `build: { target: 'safari16' },` cạnh `plugins`. <!-- Red Team #5 -->
  4. `verify-astro-dist.mjs`: thêm trường `editor: true` vào hai entry `doi-tu-build` của `COMMUNITY_PAGES`, `editor: false` cho entry khác.
  5. Thêm `async function astroScriptClosure(distPath, htmlPaths)`:
     - Đọc từng HTML (bỏ qua file không tồn tại), lấy mọi `src="(/_astro/[^"]+\.js)"`.
     - Duyệt BFS các file JS đó. Trong mỗi file, lấy mọi chuỗi literal khớp `./TÊN.js`, `/_astro/TÊN.js` hoặc `_astro/TÊN.js` (TÊN không chứa `/`), quy về `_astro/TÊN.js`.
     - Trả `Set` đường dẫn tương đối dist.
  6. Trước khi dựng `expectedFiles`: `const astroFiles = await astroScriptClosure(distPath, COMMUNITY_PAGES.filter((p) => p.editor).map((p) => p.htmlPath));`, thêm `...astroFiles` vào `expectedFiles`.
  7. Trong vòng kiểm trang cộng đồng:
     - Trang `editor`: nếu không khớp `/<script type="module" src="\/_astro\/[^"]+\.js"><\/script>/` thì ném `` new Error(`Community page lacks its editor script: ${htmlPath}`) ``.
     - Trang khác: nếu có `/_astro/` thì ném `` `Community page must not load the editor bundle: ${htmlPath}` ``.
  8. Fixture `astro-dist-contract.test.mjs`:
     - `communityPageHtml` nhận thêm tham số `editor`; khi `true`, nối `<script type="module" src="/_astro/md-editor.test.js"></script>` vào cuối chuỗi.
     - Vòng ghi truyền `editor`.
     - Ghi một lần `dist/_astro/md-editor.test.js` (`import("./md-editor-chunk.test.js");`) và `dist/_astro/md-editor-chunk.test.js` (`export {};`).
  9. Thêm hai ca vào test "dist verifier rejects missing, unexpected…" (khôi phục sau mỗi ca):
     - Ghi `dist/_astro/stray.js` → ném `/unexpected: _astro\/stray\.js/`.
     - Xoá script `_astro` khỏi `doi-tu-build/index.html` → ném `/lacks its editor script/`.
  10. Sau khi sửa: `/usr/bin/time -p npm run build` → ghi giây `real` là "sau". Nếu "sau" > 20, đặt `webServer.timeout` trong `playwright.config.mjs` thành `120_000`. <!-- Red Team #15 -->
- Success criteria: build thật sinh ít nhất một `dist/_astro/*.js`; verifier xanh. [UNVERIFIED] dạng thẻ script mới được kiểm ở mức compiler Astro (researcher §3); nếu thẻ có thêm thuộc tính, lệnh Verify in `0` và Failure Protocol áp dụng.
- Verify:
  - `npm run build` exit 0.
  - `node -e "const h=require('fs').readFileSync('dist/doi-tu-build/index.html','utf8');const m=h.match(/<script type=\"module\" src=\"\/_astro\/[^\"]+\.js\"><\/script>/g)||[];console.log(m.length)"` in `1`.
  - `npm run verify` exit 0.
  - `npm run test:dist` exit 0 và in `# fail 0`.
  - `release-log.md` mục "Build" có hai số; nếu "sau" > 20 thì `grep -c "120_000" playwright.config.mjs` in `1`.

### Task 4.6 — Hàm thuần: payload mới, `from`, nháp
- Goal: payload `{title, heroes, tactics, troop, bodyMd, lang, uploadIds}` (đúng 1 ảnh, thân bài 10–10 000); `?new=1&from=<id>`; hàm nháp không chạm DOM, có hạn 30 ngày.
- Target files and symbols: `js/community-team-state.js` (hằng ở đầu file, `teamPayloadFromDraft`, `modeFromSearch`); export mới `BODY_MIN`, `BODY_MAX`, `TEAM_DRAFT_PREFIX`, `DRAFT_TTL_MS`, `draftStorageKey`, `serializeDraft`, `parseStoredDraft`, `repostFields`; `tests-js/community-team-state.test.mjs`.
- Steps:
  1. Xoá `OPTIONAL_FIELDS`, `PLAYSTYLE_MIN`, `TEXT_MAX`, `OPTIONAL_MAX`, `MAX_UPLOADS`. Thêm `export const BODY_MIN = 10;`, `export const BODY_MAX = 10000;`, `const UPLOADS_PER_TEAM = 1;`, `export const TEAM_DRAFT_PREFIX = 'tqccl:team-draft:';`, `export const DRAFT_TTL_MS = 30 * 86_400_000;`.
  2. `teamPayloadFromDraft`:
     - Thay khối `playstyle`/`optional` bằng `const bodyMd = trimmed(typeof fields?.bodyMd === 'string' ? fields.bodyMd.replace(/\r\n?/gu, '\n') : '');` và `if (length(bodyMd) < BODY_MIN || length(bodyMd) > BODY_MAX) throw new TeamFormError('invalid_text');`.
     - Kiểm ảnh thành `uploadIds.length !== UPLOADS_PER_TEAM`.
     - Đối tượng trả về thay `playstyle, ...optional` bằng `bodyMd`.
  3. `modeFromSearch`: **chỉ nhánh `new`** trả thêm khoá `from` (`params.get('from')` nếu khớp `TEAM_ID_RE`, ngược lại `null`); nhánh `list`, `detail`, `mine` giữ đúng hình dạng `{ mode, id }`. <!-- Red Team #9 -->
  4. `draftStorageKey(userId, seasonId)` → `` `${TEAM_DRAFT_PREFIX}${userId}:${seasonId}` ``.
  5. `serializeDraft({ heroes, title, troop, bodyMd }, now)`: `heroes` là mảng 3 `{ hero: id|null, tactics: [id|null, id|null] }`; trả `JSON.stringify({ v: 1, savedAt: now, heroes, title, troop, bodyMd })`. Không có khoá nào chứa upload.
  6. `parseStoredDraft(text, now)`: `JSON.parse` trong `try`. Trả `null` nếu một trong các điều kiện sau đúng; ngược lại trả đối tượng đã kiểm: <!-- Red Team #4 -->
     - `v !== 1`.
     - `savedAt` không phải số, hoặc `now - savedAt > DRAFT_TTL_MS`.
     - `heroes` không phải mảng 3 phần tử.
     - Id tướng khác `null` mà không khớp `/^hero:[a-z0-9]+(?:-[a-z0-9]+)*$/u`.
     - Id chiến pháp khác `null` mà không khớp `/^tactic:[a-z0-9]+(?:-[a-z0-9]+)*$/u`.
     - `title` không phải chuỗi ≤ 80 code point.
     - `troop` không phải `''` hoặc phần tử `TROOPS`.
     - `bodyMd` không phải chuỗi ≤ 50 000 ký tự.
  7. `repostFields(team)` → `{ heroes: team.heroes.map((hero, i) => ({ hero, tactics: [team.tactics?.[i]?.[0] ?? null, team.tactics?.[i]?.[1] ?? null] })), title: team.title ?? '', troop: TROOPS.includes(team.troop) ? team.troop : '', bodyMd: typeof team.bodyMd === 'string' ? team.bodyMd : '' }`.
  8. Test `tests-js/community-team-state.test.mjs`: <!-- Red Team #9 -->
     - `FIELDS`: thay 6 trường bằng `bodyMd: "## Lối chơi\r\n\r\nMở đầu bằng khống chế rồi dồn sát thương."`, `uploadIds: ["up1"]`.
     - Assert `body.strengths` (≈`:63`) thay bằng `assert.equal(body.bodyMd, "## Lối chơi\n\nMở đầu bằng khống chế rồi dồn sát thương.")`.
     - Assert `body.uploadIds` (≈`:65`) thành `["up1"]`.
     - `playstyle: "ngắn"` (≈`:100`) thành `bodyMd: "ngắn"` → `invalid_text`. Thêm `bodyMd: "a".repeat(10001)` → `invalid_text`, `"𠮷".repeat(10000)` hợp lệ, `uploadIds: ["a","b"]` → `invalid_uploads`.
     - `playstyle: "𠮷".repeat(5)` (≈`:152`) thành `bodyMd`.
     - Trong khối `modeFromSearch` (≈`:164-170`): chỉ assert của `?new=1` đổi thành `{ mode: "new", id: null, from: null }`; sáu assert còn lại giữ nguyên. Thêm `modeFromSearch("?new=1&from=t9")` = `{ mode: "new", id: null, from: "t9" }` và `?new=1&from=BAD` cho `from: null`.
     - Thêm test: `serializeDraft` → `parseStoredDraft(…, now)` giữ nguyên dữ liệu, chuỗi JSON không chứa `upload`; `parseStoredDraft` trả `null` cho `"{"`, `{"v":2}`, id tướng sai dạng, và `savedAt` cũ hơn 30 ngày; test `repostFields` với một đội mẫu.
- Success criteria: test đạt.
- Verify: `node --experimental-strip-types --test tests-js/community-team-state.test.mjs` exit 0 và in `# fail 0`.

### Task 4.7 — Thông báo lỗi, bảo trì, quota, đăng xuất xoá nháp
- Goal:
  - 429 nói đúng thời gian chờ theo `Retry-After`.
  - `maintenance` được coi là "không khả dụng" (bộ đồng bộ tự chờ).
  - `site_quota` có câu riêng.
  - `signOut` xoá mọi nháp. <!-- Red Team #4, #10, #12 -->
- Target files and symbols: `js/community-api.js` (`CommunityError`, `statusMessage`, `codeMessage`, `api`, `signOut`).
- Steps:
  1. `CommunityError` nhận thêm `retryAfter = 0` và gán `this.retryAfter`.
  2. Trong `api`, sau khi có `response`: `const retryAfter = Number.parseInt(response.headers.get('retry-after') || '', 10) || 0;` và truyền vào mọi `new CommunityError(…)` của nhánh lỗi.
  3. `statusMessage(status, retryAfter = 0)`, nhánh `429`:
     - `retryAfter >= 3600`: `L(\`Bạn đã dùng hết lượt cho thao tác này hôm nay. Hãy thử lại sau khoảng ${Math.ceil(retryAfter / 3600)} giờ.\`, \`今天该操作的次数已用完，请约 ${Math.ceil(retryAfter / 3600)} 小时后再试。\`)`.
     - Ngược lại: giữ câu cũ.
     - Chỗ gọi `statusMessage(response.status)` truyền thêm `retryAfter`.
  4. `codeMessage` thêm:
     - `maintenance`: `L('Trang đang bảo trì. Vui lòng thử lại sau ít phút.', '网站正在维护，请几分钟后再试。')`.
     - `site_quota`: `L('AI đọc ảnh của cả trang đã hết lượt hôm nay. Bạn vẫn nhập tay và gửi được.', '全站今日的 AI 识图次数已用完。你仍可手动填写并提交。')`.
     - **Không** thêm `stale_client` (client mới không bao giờ gửi tiền tố hay payload cũ). <!-- Red Team #8 -->
  5. Nhánh `specific` của `api`: `throw new CommunityError(specific, { status: response.status, code, retryAfter, unavailable: code === 'maintenance' })`.
  6. `signOut`: import `TEAM_DRAFT_PREFIX` từ `./community-team-state.js`. Ngay trước lệnh tải lại trang, trong `try { … } catch {}`, duyệt `localStorage` từ cuối về đầu và `removeItem` mọi khoá bắt đầu bằng `TEAM_DRAFT_PREFIX`. Giữ nguyên phần PR #36 đã thêm.
- Success criteria: không đổi chữ của các mã khác.
- Verify: no verification needed (e2e ở task 4.10).

### Task 4.8 — Form mới <!-- Red Team #4, #5, #12 -->
- Goal:
  - Form một ảnh tự đọc, hiện số lượt còn lại.
  - Thân bài bằng editor, dự phòng `<textarea>`; đếm ký tự.
  - Nháp gắn với vòng đời view; đăng lại không ghi đè nháp.
- Target files and symbols: `js/community-team-form.js` (`mountTeamForm`); chữ ký mới `mountTeamForm(container, { season, locale, userId, repost = null, signal, getLexicon, teamHref, onSubmitted })`.
- Steps:
  1. Xoá `MAX_IMAGES`, `OPTIONAL_FIELDS`. Import thêm từ `./community-team-state.js`: `BODY_MAX`, `draftStorageKey`, `serializeDraft`, `parseStoredDraft`.
  2. `formMessage`: `invalid_text` → `L('Nội dung bài cần từ 10 đến 10 000 ký tự.', '正文需为 10–10000 个字符。')`; `invalid_uploads` → `L('Cần chọn 1 ảnh đội hình trước khi gửi.', '提交前需选择 1 张阵容图片。')`.
  3. Mỗi ô tướng/chiến pháp có `slot.userEdited`; `sync(slot)` do người dùng đổi ô đặt `slot.userEdited = true`. `applyDraft(next, { keepUserEdits = false } = {})` bỏ qua ô `userEdited` khi `keepUserEdits`.
  4. Ảnh: một ô, id `cm-team-image-0`, nhãn `L('Ảnh đội hình (bắt buộc)', '阵容图片（必填）')`; bỏ nút "Đọc bằng AI". Ghi chú: `L('Chọn ảnh là ảnh được tải lên và gửi ngay tới dịch vụ AI để điền nháp tướng và chiến pháp. Nên cắt bỏ tên tài khoản.', '选择图片后会立即上传并发送给 AI 服务以填写武将和战法草稿。建议裁掉账号名称。')`.
  5. Chuỗi ảnh với generation token và controller riêng cho từng generation: <!-- Updated: Kongming advice - mỗi generation một AbortController dùng xuyên upload→analyze -->
     - Biến: `let imageGeneration = 0; let imageAbort = null;`.
     - Khi `change`: `const gen = ++imageGeneration; imageAbort?.abort(); const controller = new AbortController(); imageAbort = controller;`; đặt `uploadId = null`, `normalized = null`, `choice = null`.
     - Mọi lời gọi của generation này dùng **biến cục bộ** `controller.signal`, không dùng `imageAbort.signal` và không dùng `signal` của view: thu nhỏ ảnh → `api('/api/community-teams/uploads', { method: 'POST', form, signal: controller.signal })`; có `uploadId` thì `api(\`/api/community-teams/uploads/${uploadId}/analyze\`, { method: 'POST', signal: controller.signal })` đúng một lần.
     - Sau **mỗi** `await` (thu nhỏ, upload, analyze), nếu `gen !== imageGeneration` hoặc `closed` thì `return`.
     - Nối với vòng đời view: không dùng `AbortSignal.any` (Safari chỉ có từ 17.4, dưới `build.target: 'safari16'`); listener `abort` của `signal` view ở bước 9 gọi `imageAbort?.abort()`, nên huỷ view cũng huỷ generation đang chạy.
     - Thành công: `normalized = normalizeTeamRead(body?.read)`; `applyRead()` dùng `applyDraft(…, { keepUserEdits: true })`; nếu `Number.isInteger(body?.remaining)` thì nối vào trạng thái ô ảnh `L(\`Còn ${body.remaining} lượt đọc AI hôm nay.\`, \`今天还剩 ${body.remaining} 次 AI 识别。\`)`.
     - Chọn phe dùng `normalized` đã có, không gọi lại AI.
     - Lỗi AI: giữ `uploadId`. `status === 429` thì hiện `describeError(error)` + `' '` + `L('Bạn vẫn nhập tay và gửi được; ảnh vẫn được gửi kèm.', '你仍可手动填写并提交，图片会一并提交。')`; lỗi khác hiện `describeError(error)`. `AbortError` bỏ qua im lặng.
  6. Thân bài — dựng `bodyField` gồm `node` (wrapper `div.cm-team-body-field`), getter/setter `value`, `focus()`:
     - Ban đầu `editor = el('cm-md-editor', { id: 'cm-team-body', 'data-label': L('Nội dung bài', '正文'), 'data-placeholder': L('Lối chơi, điểm mạnh, điểm yếu, khắc chế, thay thế… Dùng tiêu đề H2/H3 để chia mục.', '打法、优缺点、克制关系、替换方案……可用 H2/H3 标题分段。'), 'data-loading': L('Đang tải trình soạn…', '正在加载编辑器…'), 'data-error': L('Không tải được trình soạn.', '编辑器加载失败。'), 'data-file-rejected': L('Bài viết không hỗ trợ ảnh; ảnh đội hình chọn ở mục Ảnh.', '正文不支持图片；阵容图片请在“图片”处选择。'), 'data-tools': JSON.stringify({ /* nhãn vi/zh của 8 nút */ }) })`.
     - Giá trị chờ (`pendingBody`) **không** gán vào `editor.value` cho tới khi `customElements.whenDefined('cm-md-editor')` resolve (tránh thuộc tính riêng che getter trên phần tử chưa upgrade).
     - Dự phòng theo **sẵn sàng**, không theo đăng ký phần tử: <!-- Updated: Kongming advice - timeout 5 s tính tới editor-ready -->
       - Ngay khi tạo `editor`: `let fellBack = false; const readyTimer = setTimeout(fallBack, 5000);`.
       - Wrapper nghe `editor-ready`: nếu `fellBack` thì bỏ qua; ngược lại `clearTimeout(readyTimer)`.
       - Wrapper nghe `editor-error`: `fallBack()`.
       - `fallBack()`: nếu `fellBack` hoặc `closed` thì `return`; `fellBack = true; clearTimeout(readyTimer)`; lấy giá trị hiện có (`editor.value` nếu `customElements.get('cm-md-editor')` đã có, ngược lại `pendingBody`); thay `editor` bằng `el('textarea', { id: 'cm-team-body', class: 'cm-textarea', rows: '12' })` mang giá trị đó. Việc gỡ `editor` khỏi DOM gọi `disconnectedCallback` (task 4.4), nên chunk về muộn bị bỏ qua và không thay textarea.
       - Thêm ghi chú `L('Trình soạn không tải được; bạn vẫn viết Markdown trong ô này (## tiêu đề, **đậm**, - danh sách).', '编辑器加载失败；你仍可在此框中用 Markdown 书写（## 标题、**加粗**、- 列表）。')`.
       - Listener `abort` của view (bước 9) gọi `clearTimeout(readyTimer)`.
     - Đếm ký tự: `count = el('p', { class: 'scope-note cm-md-count' })`. Mỗi `input` bắn lên wrapper: `count.textContent = \`${Array.from(bodyField.value).length} / 10 000\``; `count.dataset.over` khi vượt `BODY_MAX`. Không chặn gõ.
     - Đặt vào form bằng `field('cm-team-body', L('Nội dung bài', '正文'), bodyField.node, count)` thay cho `playstyleInput` và `optional`.
  7. Gửi:
     - `teamPayloadFromDraft(draft, { title, troop, bodyMd: bodyField.value, lang: locale, uploadIds: uploadId ? [uploadId] : [] })`.
     - `showFieldError('invalid_text')` gọi `bodyField.focus()`; `invalid_uploads` focus ô ảnh.
     - **Trước** POST: `clearTimeout(saveTimer)`.
     - POST trả 201: `submitted = true`; **chỉ khi `autosave`** (luồng nháp thường) thì `localStorage.removeItem(key)` (trong `try`); rồi `onSubmitted()`. Gửi từ luồng đăng lại không đọc, không ghi, không xoá khoá nháp. <!-- Updated: Kongming advice - repost không xoá nháp thường -->
  8. Nháp:
     - `const key = draftStorageKey(userId, season.id)`; `const autosave = !repost`.
     - Có `repost`: áp `repost` (ô bằng `sureCell(id, labelOf(...))`, tiêu đề, binh chủng, `bodyField.value`) và hiện `L(\`Đang đăng lại từ bài bị từ chối “${repost.title}”. Hãy chọn lại ảnh; bài cũ vẫn giữ nguyên.\`, …)`. Không đọc, không ghi khoá nháp.
     - Không có `repost`: đọc `localStorage.getItem(key)` (trong `try`) → `parseStoredDraft(text, Date.now())`. Có thì áp như trên và hiện `L(\`Đã khôi phục nháp lưu lúc ${giờ}. Hãy chọn lại ảnh.\`, …)` kèm nút `L('Xoá nháp', '删除草稿')` (xoá khoá rồi `location.reload()`).
     - `saveDraft()`: `if (!autosave || submitted || closed) return;` rồi `localStorage.setItem(key, serializeDraft({ heroes: <id ô sure hoặc null>, title, troop, bodyMd: bodyField.value }, Date.now()))` trong `try`.
     - `scheduleSave()` = `clearTimeout(saveTimer); saveTimer = setTimeout(saveDraft, 800)`, gọi sau mỗi `change` ô, `input` tiêu đề, `change` binh chủng, `input` thân bài.
  9. Vòng đời: `signal?.addEventListener('abort', () => { clearTimeout(saveTimer); clearTimeout(readyTimer); saveDraft(); closed = true; imageAbort?.abort(); }, { once: true })`. Lời gọi `saveDraft()` trong listener chạy **trước** `closed = true`.
- Success criteria: không còn `playstyle`, `OPTIONAL_FIELDS`, `readButton`, `MAX_IMAGES`, `imageAbort.signal`, `AbortSignal.any` trong file; `removeItem(key)` chỉ nằm trong nhánh `autosave`.
- Verify: grep `playstyle|OPTIONAL_FIELDS|readButton|MAX_IMAGES|imageAbort\.signal|AbortSignal\.any` trong `js/community-team-form.js` trả 0 kết quả; `node --check js/community-team-form.js` exit 0. <!-- Updated: Kongming advice - grep signal sai -->

### Task 4.9 — Trang danh sách/chi tiết/của tôi và quản trị
- Goal: chi tiết và quản trị render `bodyMd`; tab "Viết bài"; nút "Đăng lại"; `render()` truyền `signal` cho form; CSS cho thân bài và editor.
- Target files and symbols: `js/community-teams.js`, `js/community-admin-teams.js`, `css/styles.css`.
- Steps:
  1. `community-teams.js`: import `markdownTree` từ `./markdown.js`, `treeToDom` từ `./view-tree.js`, `repostFields` từ `./community-team-state.js`; xoá `ANALYSIS_FIELDS`.
  2. Tab "Đăng đội" trong `nav`: chữ `L('Viết bài', '写文章')`. Tiêu đề `newView`: `L('Viết bài mới', '撰写新文章')`. Lời mời đăng nhập: `L('Đăng nhập để viết bài.', '登录后即可撰写文章。')`.
  3. `detailView`: thay khối `el('dl', { class: 'cm-team-analysis' }, …)` bằng `const body = el('div', { class: 'cm-md-body cm-team-body', lang: team.textLang === 'zh' ? 'zh-Hans' : 'vi' }); body.append(...markdownTree(String(team.bodyMd || ''), { profile: 'ugc', siteOrigin: location.origin }).map((node) => treeToDom(node)));`. Trong `article`, ở chỗ biến cũ, đặt `el('p', { class: 'cm-team-body-lang' }, langTag(team.textLang))` rồi `body`.
  4. `mineCard`: khi `team.status === 'rejected'`, thêm `el('p', {}, link({ new: '1', from: team.id }, L('Đăng lại', '重新发布'), 'cm-link cm-team-repost'))` vào phần thân thẻ.
  5. `render`: thêm biến cấp `initCommunityTeams` `let viewAbort = null;`. Ngay **trước** `mount.replaceChildren(view)`: `viewAbort?.abort(); viewAbort = new AbortController();`. Lấy `{ mode, id, from }` từ `modeFromSearch`; nhánh `new` gọi `newView(view, isCurrent, from, viewAbort.signal)`.
  6. `newView(view, isCurrent, from, signal)`:
     - Nếu `from` có giá trị: gọi `api(\`/api/community-teams/${encodeURIComponent(from)}\`)` (lỗi thì bỏ qua). Chỉ dùng khi `team.status === 'rejected' && team.author?.id === user.id`; truyền `repost: repostFields(team)`.
     - Luôn truyền `userId: user.id` và `signal` vào `mountTeamForm`.
  7. `community-admin-teams.js`: import `markdownTree`, `treeToDom`; xoá `ANALYSIS_FIELDS`; trong `detailNodes` thay vòng `ANALYSIS_FIELDS` bằng một `div.adm-team-body.cm-md-body` (giữ thuộc tính `lang` như cũ) chứa `markdownTree(String(detail.bodyMd || ''), { profile: 'ugc', siteOrigin: location.origin })` qua `treeToDom`; `summary` thành `L('Xem bài', '查看正文')`; chú thích đầu file đổi "phân tích" thành "thân bài".
  8. `css/styles.css`:
     - Xoá `.adm-team-field` và `.cm-team-analysis`, `.cm-team-analysis-item …`, `.cm-team-text`.
     - Thêm `.cm-md-body` vào các bộ chọn `.adm-md-preview > *`, `h2`, `h3`, `ul/ol`, `blockquote`, `pre`, `code` (không chép quy tắc).
     - Thêm `.cm-md-body { display: grid; gap: var(--space-10); overflow-wrap: anywhere; }`, `.cm-md-toolbar { display: flex; flex-wrap: wrap; gap: var(--space-8); }`, `.cm-md-editor-content { min-height: var(--size-col-200); padding: var(--space-12); border: var(--border-hair) solid var(--line); border-radius: var(--radius-8); }`, `.cm-md-count[data-over] { color: var(--avoid); }`.
     - Chỉ dùng token đã khai trong `:root`.
- Success criteria: grep `ANALYSIS_FIELDS|cm-team-analysis|cm-team-text|adm-team-field` trong `js` và `css` trả 0 kết quả.
- Verify: grep trên trả 0 kết quả; `npm run test:node` exit 0 và in `# fail 0` (gồm `design-tokens`, `browser-baseline`).

### Task 4.10 — E2E và mock
- Goal: Playwright kiểm các hành vi sau:
  - Hợp đồng payload; tự đọc ảnh; số lượt còn lại; generation token; quota.
  - Vòng đời nháp; đăng lại; chặn dán ảnh.
  - Dự phòng `<textarea>`.
  - Chi tiết, quản trị, đăng xuất xoá nháp.
- Target files and symbols: `tests-e2e/helpers/community-mock.mjs` (`json`, route đội); `tests-e2e/community-teams.spec.mjs`.
- Steps:
  1. Mock: `json(payload, status = 200, headers = {})` truyền `headers` vào `route.fulfill`; route đội dùng `await pick(...)` cho `teams.analyze`, `teams.create`, `teams.details` (cho phép trả Promise); kết quả có `headers` thì truyền vào `json`.
  2. Spec:
     - `teamDetail`: thay `analysis` bằng `bodyMd: "## Lối chơi\n\nMở đầu bằng khống chế.\n\nRồi dồn sát thương.\n\n## Điểm mạnh\n\nMạnh đầu trận"`.
     - Test "không có mùa mở": link `"Đăng đội"` → `"Viết bài"`.
     - Test bản zh: `.cm-team-analysis .cm-lang-tag` → `.cm-team-body-lang .cm-lang-tag` có chữ `[VI]`; `.cm-team-text` → `.cm-team-body` chứa `Mở đầu bằng khống chế.`, và `.cm-team-body h2` đầu tiên có chữ `Lối chơi`.
  3. Thay `uploadAndRead` bằng `chooseImage(page)` (chỉ `setInputFiles` vào `#cm-team-image-0`). Helper `typeBody(page, lines)`: click `cm-md-editor .ProseMirror`, gõ từng dòng, `Enter` giữa các dòng.
  4. Test đăng đội:
     - `analyze` trả `{ body: { read: AI_READ, remaining: 19 } }`. Sau `chooseImage`, ô được điền tự động; đúng **một** lời gọi `POST …/analyze`; trạng thái ô ảnh chứa `Còn 19 lượt`.
     - Thân bài `["## Lối chơi", "Mở đầu bằng khống chế rồi dồn sát thương."]`.
     - Body POST bằng `{ title, heroes: HEROES, tactics, troop: "ky", bodyMd: "## Lối chơi\n\nMở đầu bằng khống chế rồi dồn sát thương.", lang: "vi", uploadIds: ["tu-1"] }`.
  5. Test AI 503 và test `invalid_title`: bỏ nút "Đọc bằng AI"; thân bài bằng `typeBody`; body POST có `bodyMd` và không có `playstyle`.
  6. Thêm test "đổi ảnh giữa chừng": <!-- Updated: Kongming advice - kiểm request cũ bị huỷ -->
     - Trước `page.goto`, `page.addInitScript` bọc `window.fetch`: với mỗi lời gọi có `init.signal`, ghi `String(input)` vào `window.__aborted` khi signal đó bắn `abort`. (`js/community-api.js` `api` gọi `fetch` toàn cục và truyền `signal`, ≈`:166-176`.)
     - `analyze` cho `tu-1` trả Promise chỉ resolve sau khi `tu-2` đã trả, với một bản đọc khác (ví dụ tướng `劉備`). Mock bọc `route.fulfill` của request đã bị huỷ trong `try/catch`.
     - `tu-2` trả `AI_READ`. Chọn ảnh hai lần.
     - Cuối cùng `#cm-team-cell-0-0` = `Tào Tháo`.
     - `await page.evaluate(() => window.__aborted)` có đúng một phần tử chứa `/uploads/tu-1/analyze`, và không phần tử nào chứa `tu-2`.
  7. Thêm test "ô người dùng đã sửa không bị AI ghi đè": gõ `Quan Vũ` vào `#cm-team-cell-0-0` (dispatch `change`) rồi chọn ảnh; ô vẫn `Quan Vũ`; `#cm-team-cell-1-0` là `Quan Vũ`.
  8. Thêm test "hết lượt riêng":
     - `analyze` trả `{ status: 429, headers: { "Retry-After": "40000" }, body: { error: { code: "rate_limited", message: "x" } } }`.
     - Trạng thái ô ảnh chứa `hôm nay` và `nhập tay`.
     - Thêm ca `site_quota` (status 429, mã `site_quota`): trạng thái chứa `cả trang`. <!-- Red Team #12 -->
  9. Thêm test "nháp không mất khi rời trang trong 800 ms":
     - Gõ tiêu đề và thân bài, **ngay** sau đó bấm tab `Danh sách`, rồi bấm `Viết bài`.
     - Thấy `Đã khôi phục nháp`; editor chứa thân bài đầy đủ.
     - `localStorage.getItem("tqccl:team-draft:u1:s1")` không chứa `tu-`. <!-- Red Team #4 -->
  10. Thêm test "gửi xong không hồi sinh nháp": gõ thân bài, bấm Gửi ngay (mock 201), chờ chế độ `mine`, chờ 1 giây, bấm `Viết bài`; không có chữ `Đã khôi phục nháp`; `localStorage.getItem("tqccl:team-draft:u1:s1")` là `null`. <!-- Red Team #4 -->
  11. Thêm test "đăng lại": <!-- Updated: Kongming advice - repost gửi thành công vẫn giữ nháp -->
     - Danh sách `mine` có `m2` rejected (`author: PLAYER`). Link `Đăng lại` có `href` `/doi-tu-build/?new=1&from=m2`.
     - Trước khi mở, `page.evaluate` đặt nháp thường vào `tqccl:team-draft:u1:s1` và giữ chuỗi gốc `before`.
     - Bấm link; `details` trả đội rejected có `bodyMd`. Tiêu đề, ô tướng và editor đã điền; ô ảnh trống.
     - Chọn ảnh, gửi (mock 201), chờ chế độ `mine`, chờ 1 giây.
     - `await page.evaluate(() => localStorage.getItem("tqccl:team-draft:u1:s1"))` `===` `before` (so từng byte).
  12. Thêm test "dán ảnh vào thân bài bị chặn": `dispatchEvent` paste với `DataTransfer` chứa một `File` ảnh; thấy `Bài viết không hỗ trợ ảnh`; editor không có `img`.
  13. Thêm test "editor không tải → textarea dự phòng": <!-- Red Team #5 --> <!-- Updated: Kongming advice - chunk treo, rời view lúc tải, chunk về muộn -->
     - Helper `editorScripts()`: đọc `src` script `_astro` từ `dist/doi-tu-build/index.html` bằng `fs` → `entry`; mọi URL `_astro` khác là chunk. Helper `holdChunks(page)` chỉ giữ chunk động chứa TipTap: `page.route(/\/_astro\/md-editor-tiptap[^/]*\.js$/, async (r) => { held += 1; await gate; try { await r.continue(); } catch {} })`, trả `release()` resolve `gate`; mỗi ca dùng nó assert `held >= 1` để chứng minh route đã khớp. [UNVERIFIED] tên chunk động mang tên module (`chunkFileNames` mặc định của Astro là `_astro/[name].[hash].js`); nếu `held` là 0 thì Failure Protocol.
     - Ca (a) chặn cả entry: `page.route('**/_astro/**', (r) => r.abort())`; mở `?new=1`. Trong 7 giây `textarea#cm-team-body` hiện. Điền thân bài vào textarea, chọn ảnh, điền ô, gửi. Body POST có `bodyMd` đúng chữ đã điền.
     - Ca (b) chunk bị abort: `continue` entry, `abort` chunk → `textarea#cm-team-body` hiện.
     - Ca (c) **chunk treo**: `holdChunks`, không release. Trong 7 giây `textarea#cm-team-body` hiện, dù `customElements.get('cm-md-editor')` đã có (assert bằng `page.evaluate`).
     - Ca (d) **rời view lúc đang tải**: `holdChunks`; mở `?new=1`; trước 5 giây bấm tab `Danh sách`; `release()`; chờ 1 giây. `page.locator('.ProseMirror')` có count `0`; danh sách lỗi từ `page.on('pageerror')` rỗng.
     - Ca (e) **chunk về sau khi đã dự phòng**: `holdChunks`; chờ `textarea#cm-team-body` hiện; điền `"Nội dung viết trong ô dự phòng"`; `release()`; chờ 1 giây. `.ProseMirror` count `0`; textarea vẫn hiện và giữ đúng chữ đã điền.
  14. Thêm test "đăng xuất xoá nháp": `page.evaluate` đặt `localStorage["tqccl:team-draft:u1:s1"]`; mở menu tài khoản, bấm Đăng xuất (mock `POST /api/auth/sign-out` trả `{}`); sau khi trang tải lại, khoá đó là `null`.
  15. Quản trị: `"Xem phân tích"` → `"Xem bài"`; hàng chứa `Mở đầu bằng khống chế` và có `h2` `Lối chơi` trong `.adm-team-body`.
- Success criteria: spec đạt toàn bộ.
- Verify: `npx playwright test tests-e2e/community-teams.spec.mjs` exit 0 và output có `passed`, không có `failed`.

### Task 4.11 — Cổng của phase
- Goal: toàn bộ kiểm xanh; commit chỉ chứa file của phase.
- Target files and symbols: worktree `feat/doi-tu-build`.
- Steps:
  1. `npm run check`
  2. `npm run test:node`
  3. `npm run build`
  4. `npm run verify`
  5. `npm run test:dist`
  6. `npx playwright test tests-e2e/community-teams.spec.mjs`
  7. `cd community-worker && npm test && npm run typecheck`
  8. `python3 -m pipeline.site_localization check --root . --stage public`
  9. `git add package.json package-lock.json astro.config.mjs playwright.config.mjs src/scripts src/components/pages/CommunityTeamsPage.astro scripts/verify-astro-dist.mjs tests-js/astro-dist-contract.test.mjs tests-js/md-editor-roundtrip.test.mjs tests-js/community-team-state.test.mjs js/community-team-state.js js/community-team-form.js js/community-teams.js js/community-admin-teams.js js/community-api.js css/styles.css tests-e2e/community-teams.spec.mjs tests-e2e/helpers/community-mock.mjs plans/261022-1828-doi-tu-build/reports/release-log.md` <!-- Red Team #2 -->
  10. `git diff --cached --name-only`
  11. `git commit -m "feat(community): one-image auto-read form, TipTap editor with textarea fallback, drafts, repost, body_md rendering"`
- Success criteria: mọi lệnh exit 0; commit chỉ chứa file của bước 9.
- Verify: lệnh 1–8 exit 0; `node --test` in `# fail 0`; Playwright không có `failed`; bước 10 không có `docs/design/` hay `scripts/design-canvas/`.

### Task 4.12 — Preview một lần: chuyển hướng 302 (bắt buộc), IME (không bắt buộc) (DỪNG VÀ HỎI) <!-- Red Team #14 -->
- Goal: kiểm trên hạ tầng Pages thật rằng chuyển hướng giữ query và rule thiếu `/` chạy; cho user thử gõ trên thiết bị họ có; trả preview về bản `main` sau khi xong.
- Target files and symbols: alias `preview-community.tqccl.pages.dev`; `release-log.md` mục "Preview", "IME".
- Steps:
  1. **Hỏi user** cho phép deploy preview. Preview gọi Worker **production** (cũ), nên chỉ dùng để kiểm chuyển hướng và gõ chữ.
  2. Từ worktree `feat/doi-tu-build` (dùng `dist` của task 4.11): `community-worker/node_modules/.bin/wrangler pages deploy dist --project-name tqccl --branch preview-community`.
  3. Chạy:
     ```sh
     for p in "/doi-cong-dong/?id=abc" "/doi-cong-dong/?new=1" "/doi-cong-dong/?mine=1" "/doi-cong-dong" "/doi-cong-dong/" "/zh/doi-cong-dong/?id=abc" "/zh/doi-cong-dong"; do
       curl -sS -o /dev/null -w "%{http_code} $p -> %{redirect_url}\n" "https://preview-community.tqccl.pages.dev$p"
     done
     ```
     Ghi output vào mục "Preview".
  4. IME, không chặn phát hành; chỉ 3 tổ hợp user có: <!-- Updated: Validation Session 1 - IME chỉ 3 tổ hợp -->
     - (1) macOS + Telex của bộ gõ hệ thống (Safari);
     - (2) iPhone + Telex (Safari iOS);
     - (3) Windows + Unikey hoặc EVKey (Chrome).
     - Checklist cho user, làm trên từng tổ hợp: mở `/doi-tu-build/?new=1` trên preview, đăng nhập. **KHÔNG chọn ảnh, KHÔNG bấm Gửi.** Gõ `Trương Phi đánh trước, Quan Vũ giữ nhịp; Tào Tháo khống chế` trong đoạn thường, trong tiêu đề H2 và trong mục danh sách, rồi bấm Đậm giữa từ.
     - Ghi vào mục "IME" đúng 3 dòng (một dòng mỗi tổ hợp) dạng "đạt/lỗi + mô tả", hoặc "user không kiểm". Lỗi được ghi thành rủi ro, không chặn phase 6.
  5. Trả preview về `main`:
     - `git -C /Users/plateau/Project/worktrees/CamNangTQCCL-doi-tu-build worktree add --detach /tmp/dtb-preview-main origin/main`
     - `cd /tmp/dtb-preview-main && npm ci && COMMUNITY_API_ORIGIN=https://tqccl-community.nguyennlt-ncc.workers.dev npm run build && npm run verify`
     - `/Users/plateau/Project/worktrees/CamNangTQCCL-doi-tu-build/community-worker/node_modules/.bin/wrangler pages deploy dist --project-name tqccl --branch preview-community`
     - `git -C /Users/plateau/Project/worktrees/CamNangTQCCL-doi-tu-build worktree remove /tmp/dtb-preview-main`
- Success criteria: bước 3 đủ 7 dòng `302`, đích lần lượt kết thúc bằng `/doi-tu-build/?id=abc`, `/doi-tu-build/?new=1`, `/doi-tu-build/?mine=1`, `/doi-tu-build/`, `/doi-tu-build/`, `/zh/doi-tu-build/?id=abc`, `/zh/doi-tu-build/`; mục "IME" tồn tại (có thể ghi "user không kiểm"); preview đã về bản `main`.
- Verify:
  - So output bước 3 với Success criteria, khớp cả 7 dòng.
  - `release-log.md` có mục "IME".
  - Sau bước 5, `curl -sS -o /dev/null -w "%{http_code}\n" https://preview-community.tqccl.pages.dev/doi-cong-dong/` in `200` (route cũ của `main`).

## Risk

| Rủi ro | Khả năng × Tác động | Giảm thiểu |
|---|---|---|
| Cách gọi bản gốc trong `renderMarkdown` của Paragraph không như giả định | Trung bình × Thấp | Chốt trên bản cài ở task 4.3 bước 1 trước khi dựng editor; không có cơ chế thì Failure Protocol <!-- Updated: Kongming advice - chốt hợp đồng sớm --> |
| Tên chunk `_astro` khác dự kiến, verifier đóng sai tập | Trung bình × Trung bình | Closure đọc từ HTML thật và chuỗi literal; build + verify ở task 4.5 |
| Editor không tải (chunk 404 hoặc treo sau deploy, trình duyệt cũ) | Thấp × Trung bình | `<textarea>` dự phòng khi 5 s chưa có `editor-ready` hoặc khi `editor-error`; token vòng đời bỏ chunk về muộn; `build.target: 'safari16'`; e2e (a)–(e) <!-- Red Team #5 --> <!-- Updated: Kongming advice - timeout theo editor-ready --> |
| Nháp đua với gỡ view/gửi bài | Trung bình × Trung bình | `signal` từ `render()`, flush trước khi gỡ, chặn save sau 201, e2e (a)(b) <!-- Red Team #4 --> |
| Form mới gặp Worker cũ (trước cutover) | Chắc chắn nếu deploy lệch × Cao | Chỉ deploy Pages production ở task 6.15, sau migration 6.13 và Worker 6.14; workflow Pages tắt từ 6.5 tới 6.17; preview chỉ dùng để kiểm chuyển hướng và gõ <!-- Updated: Kongming advice - đánh số lại phase 6 --> |

## Security

- Thân bài chỉ hiển thị qua `markdownTree` profile `ugc`, kể cả trong khu quản trị.
- Editor chặn dán/thả file; HTML dán vào bị schema lọc; link chỉ nhận `http(s)` hoặc đường dẫn cùng site.
- TipTap cài `--ignore-scripts`, `npm audit signatures`, danh sách gói gián tiếp được ghi và rà. <!-- Red Team #13 -->
- Nháp chỉ ở `localStorage`, theo `user.id` + mùa, không chứa `uploadId`, hết hạn 30 ngày, xoá khi gửi và khi đăng xuất. <!-- Red Team #4 -->
- Preview: checklist cấm chọn ảnh (chọn ảnh là gửi AI tới Worker production); preview được trả về bản `main` ngay sau khi kiểm. <!-- Red Team #14 -->

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
