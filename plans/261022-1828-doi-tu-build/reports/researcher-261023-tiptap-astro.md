# Nghiên cứu: TipTap vanilla + Astro/Vite cho editor "Đội tự build"

Ngày 2026-10-23 · HEAD 0f89e2e · Phạm vi: chỉ đọc repo. Phép thử thực nghiệm chạy ngoài repo, trong `/tmp/tiptap-probe`, gồm npm install, esbuild và Playwright Chromium.

## Kết luận trước

1. **Dùng TipTap 3.32.0, pin chính xác mọi gói `@tiptap/*` cùng một bản.** Các peer dependency là bản chính xác: `@tiptap/core` yêu cầu `"@tiptap/pm": "3.32.0"` ([registry](https://registry.npmjs.org/@tiptap/core/latest)), `@tiptap/markdown` yêu cầu core và pm `3.32.0` ([registry](https://registry.npmjs.org/@tiptap/markdown/latest)). Nên liệt kê từng extension thay vì dùng StarterKit. Kích thước gần như bằng nhau (140 KB so với 142 KB gzip), còn danh sách tường minh chính là allowlist cú pháp, và lần nâng StarterKit sau sẽ không lặng lẽ bật thêm node mới. StarterKit v3 đã từng tự thêm Link và Underline ([docs](https://tiptap.dev/docs/editor/extensions/functionality/starterkit)).
2. **Markdown do `@tiptap/markdown` xuất ra KHÔNG khớp với renderer hiện tại** (`js/community-admin.js:39-141`). Đã kiểm thực tế:
   - Có entity `&amp;`, `&lt;`, `&gt;` và `&nbsp;`.
   - Có escape bằng backslash (`a\_b`, `\*`).
   - Heading `##` sẽ thành h3.
   - Code chứa backtick dùng hàng rào hai backtick.
   - List lồng thụt 2 hoặc 3 dấu cách.
   - Ký tự `# ` hoặc `- ` ở đầu đoạn không được escape.

   Vì vậy renderer `ugc` mới bắt buộc phải giải mã escape và entity, và cần quyết định cách ánh xạ heading. Đây là rủi ro lớn nhất, lớn hơn cả bundle.
3. **Nạp qua một `<script>` Astro có xử lý (không thuộc tính, không `slot`) trong `CommunityTeamsPage.astro`.** Script này chỉ định nghĩa custom element `<cm-md-editor>`. `connectedCallback` gọi `import()` TipTap, còn `disconnectedCallback` gọi `destroy()`. `js/community-team-form.js` (vẫn phục vụ thô qua `/js/`) chỉ cần tạo element đó. Cách này khớp sẵn với `mount.replaceChildren(view)` (`js/community-teams.js:603`) và `popstate` (`js/community-teams.js:622`), nên không cần cầu nối toàn cục.
4. **Repo có hai chỗ cản và phải sửa**: allowlist dist (`scripts/verify-astro-dist.mjs:271-305`) sẽ báo lỗi với file `_astro/*`, và nếu muốn cache immutable cho `/_astro/*` thì phải sửa test `_headers` (`tests-js/pages-headers-contract.test.mjs:90-96`). Ngoài hai chỗ đó, cấu hình Astro và Vite không cản gì.
5. **Playwright test được TipTap.** Đã chạy được `keyboard.type`, `locator.fill` lên `.ProseMirror`, `editor.getMarkdown()` và IME giả lập qua CDP. Playwright chưa có API IME chính thức. Kết quả với tiếng Việt khi dùng Telex/Unikey thật, Gboard và Pinyin iOS phải kiểm tay trên thiết bị.

---

## 1. TipTap vanilla và Markdown

### 1.1 Phiên bản và gói (đã kiểm)
- Bản mới nhất trên npm của `@tiptap/core` và `@tiptap/markdown` là **3.32.0** ([core](https://registry.npmjs.org/@tiptap/core/latest), [markdown](https://registry.npmjs.org/@tiptap/markdown/latest)). `@tiptap/markdown` phụ thuộc `marked ^17.0.1`; lúc cài thử, npm phân giải ra 17.0.6. Cũng lúc cài thử: prosemirror-view 1.42.7, prosemirror-model 1.25.12, linkifyjs 4.3.3.
- Chạy vanilla không cần React: `new Editor({ element, extensions, content, contentType: 'markdown' })` từ `@tiptap/core` ([docs Markdown basic usage](https://tiptap.dev/docs/editor/markdown/getting-started/basic-usage)). Probe dùng đúng cách này.
- Cách tắt extension trong StarterKit là `StarterKit.configure({ undoRedo: false, heading: { levels: [...] } })`. Trùng tên extension thì phải tắt bản trong StarterKit ([docs StarterKit](https://tiptap.dev/docs/editor/extensions/functionality/starterkit)). Đã đo: tắt bớt extension trong StarterKit **không** làm bundle nhỏ đi (a-starter 142 428 B gzip so với b-minimal 139 884 B), vì StarterKit import tĩnh mọi extension.

**Danh sách khuyến nghị**, tất cả pin `3.32.0`:

| Gói | Dùng |
|---|---|
| `@tiptap/core`, `@tiptap/pm` | Editor, ProseMirror |
| `@tiptap/markdown` | `Markdown`, `editor.getMarkdown()`, `editor.markdown.parse/serialize` |
| `@tiptap/extension-document`, `-paragraph`, `-text` | Khung tối thiểu |
| `@tiptap/extension-heading` | `Heading.configure({ levels: [2, 3] })` |
| `@tiptap/extension-bold`, `-italic`, `-code` | Đậm, nghiêng, code inline |
| `@tiptap/extension-list` | `BulletList`, `OrderedList`, `ListItem`, `ListKeymap` |
| `@tiptap/extension-blockquote` | Trích dẫn |
| `@tiptap/extension-link` | `Link.configure({ openOnClick: false, autolink: false, defaultProtocol: 'https', isAllowedUri })` |
| `@tiptap/extensions` | `UndoRedo`, `Placeholder` (không dùng `CharacterCount` để chặn cứng, xem §2) |

Không bật các extension sau: `CodeBlock`, `HorizontalRule`, `Strike`, `Underline`, `Image`, `HardBreak`, `Table`, `TaskList`. Lý do bỏ `HardBreak`: nó xuất `"  \n"` (đã kiểm: `"dòng một  \ndòng hai"`), còn renderer hiện tại nối các dòng của đoạn bằng dấu cách (`js/community-admin.js:82-83`). Nếu giữ `HardBreak` thì renderer phải hỗ trợ `<br>`.

**Danh sách có hay không lồng.** `ListItem` mặc định cho phép list lồng: đã kiểm, Tab cho ra `"- mục một\n  - mục lồng"`, còn list có số thụt 3 dấu cách (`"1. a\n   1. b"`). Renderer hiện tại làm phẳng list lồng, vì regex `^\s*([-*+]|\d+[.)])` bỏ qua thụt lề (`js/community-admin.js:107-119`). Có hai lựa chọn:
- (A, khuyến nghị theo KISS) cấm lồng bằng `ListItem.extend({ content: 'paragraph' })`. Khi đó Tab không thể `sinkListItem`, và tiêu điểm rời editor đúng hành vi bàn phím.
- (B) Renderer hiểu thụt 2 hoặc 3 dấu cách cho ít nhất một cấp lồng.

`content: 'paragraph'` theo cú pháp schema ProseMirror đã kiểm trong source, nhưng **chưa chạy thử** cách A.

### 1.2 API Markdown (đã kiểm)
- `Markdown.configure({ indentation: { style, size }, marked, markedOptions })` ([API](https://tiptap.dev/docs/editor/markdown/api/extension)). Chỉ có các tùy chọn này. **Không có tùy chọn "chỉ xuất tập con"**: tập con được quyết định bởi extension nào được bật, vì mỗi extension tự khai `parseMarkdown` và `renderMarkdown`.
- Có `editor.getMarkdown()`, `setContent(md, { contentType: 'markdown' })`, `editor.markdown.parse(md)` và `editor.markdown.serialize(json)` ([basic usage](https://tiptap.dev/docs/editor/markdown/getting-started/basic-usage)). `new MarkdownManager({ extensions })` cũng chạy trong Node mà không cần DOM (probe đã chạy), nên làm được test round-trip bằng `node --test`.
- Tài liệu tự ghi: *"The markdown extension is a early release and can be subject to change or may have edge cases"* ([intro](https://tiptap.dev/docs/editor/markdown)).

### 1.3 Định dạng Markdown thực tế xuất ra
Đã kiểm bằng Editor trong Chromium và bằng `MarkdownManager` trong Node, cùng bộ extension ở trên.

| Nhập | `getMarkdown()` | Renderer hiện tại hiển thị |
|---|---|---|
| Gõ `## Tiêu đề hai` | `## Tiêu đề hai` | **h3**, vì `#`→h2 (`js/community-admin.js:95-99`) |
| Chữ `R&D a_b *x* <b>` | `R&amp;D a\_b \*x\* &lt;b&gt;` | **hiện nguyên `&amp;`, `\_`** vì không giải mã |
| Code chứa backtick | ``` ``a`b`` ``` | Sai, vì regex chỉ nhận một backtick (`js/community-admin.js:53`) |
| Link `https://x.com/a_(b)` | `[link](https://x.com/a_(b))` | Gãy, vì `[^)\s]+` (`js/community-admin.js:53`) |
| Hai đoạn rỗng liên tiếp | `\n\n\n\n&nbsp;` | Hiện chữ `&nbsp;` |
| Gõ `# không phải tiêu đề` (levels [2,3]) | `# không phải tiêu đề` (không escape) | Thành **tiêu đề**. Lỗi upstream [tiptap#8134](https://github.com/ueberdosis/tiptap/issues/8134) (open) |
| Đậm, nghiêng, quote | `**đậm**`, `*nghiêng*`, `> trích dẫn` | Đúng |

Nguồn: `escapeMarkdownSyntax` escape ``\ ` * _ [ ] ~``, còn `encodeHtmlEntities` mã hoá `& < >` ([MarkdownManager.ts](https://github.com/ueberdosis/tiptap/blob/main/packages/markdown/src/MarkdownManager.ts), [htmlEntities.ts](https://github.com/ueberdosis/tiptap/blob/main/packages/core/src/utilities/htmlEntities.ts)). Các issue upstream còn mở: [#8471](https://github.com/ueberdosis/tiptap/issues/8471) (escape thừa, entity), [#8519](https://github.com/ueberdosis/tiptap/issues/8519)/[PR #8520](https://github.com/ueberdosis/tiptap/pull/8520) (round-trip escape không ổn định). Hành vi này có thể đổi ở bản vá sau, nên phải pin bản và có test round-trip.

**Hệ quả bắt buộc cho renderer `ugc`** (suy luận từ bảng trên):
- Giải mã backslash escape theo CommonMark và entity `&amp; &lt; &gt; &quot; &nbsp; &#N; &#xN;` trong text ngoài code. Việc này an toàn vì renderer dựng text node, không dùng `innerHTML`.
- Hỗ trợ code fence N backtick.
- Ánh xạ heading: khuyến nghị kẹp `##`→h2, `###`→h3, `#`→h2, `####+`→h3 cho profile `ugc`, và giữ nguyên mapping cũ cho `admin`.
- Bỏ đoạn chỉ có `&nbsp;`, nên làm ở client trước khi gửi hoặc ở Worker khi chuẩn hoá.
- Lỗi #8134: thêm `Paragraph.extend` với `renderMarkdown` để escape `#`, `-`, `+` và `\d+[.)]` ở đầu đoạn. Cơ chế `this.parent` cho `renderMarkdown` **chưa kiểm**.
- Link: hộp nhập link mã hoá `(`, `)` và dấu cách thành `%28`, `%29`, `%20`, hoặc renderer chấp nhận dấu ngoặc cân bằng.

### 1.4 An toàn khi parse
Đã kiểm trong Chromium với `setContent(md, { contentType: 'markdown' })`:
- `[js](javascript:alert(1))` **vẫn giữ link mark có href `javascript:`**. `isAllowedUri` không được áp khi parse Markdown, nên renderer phải tự lọc như `safeHref` đang làm (`js/community-admin.js:39-44`).
- `# Một` vẫn thành heading level 1 dù `levels: [2,3]`: JSON có `"level":1` và serialize lại thành `# Một`. Nhánh trả paragraph trong `parseMarkdown` (`heading.ts`) không được kích hoạt. Điều này ảnh hưởng nháp và "đăng lại" có chứa `#`.
- `![a](…)` thành text `a`; `<img onerror>` thành đoạn rỗng.

### 1.5 Chặn dán HTML hoặc ảnh (đã kiểm trong Chromium)
- **Mặc định** khi không có handler, schema đã lọc HTML dán vào. Dán `<h1>…<b>…<img>…<a href=javascript:>…<span style>…<table>` cho ra `"Lớn\n\nx **đậm** j đỏ\n\nô"`: h1 thành đoạn, ảnh bị bỏ, link `javascript:` bị bỏ, style bị bỏ, bảng thành đoạn.
- **Dán file ảnh** khi không có handler: nội dung giữ nguyên, nhưng `defaultPrevented=false`. Trình duyệt hoặc ProseMirror không chèn gì; tuy vậy nên chặn rõ ràng để báo người dùng.
- **Khuyến nghị**, đã chạy và chặn được:
  ```js
  editorProps: {
    handlePaste(view, event) {
      const dt = event.clipboardData; if (!dt) return false;
      if (dt.files?.length) { /* báo "không hỗ trợ ảnh trong bài" */ return true; }
      if (dt.types.includes('text/html')) { view.pasteText(dt.getData('text/plain')); return true; } // tuỳ chọn
      return false;
    },
    handleDrop: (view, event) => Boolean(event.dataTransfer?.files?.length),
  }
  ```
  `pasteText` và `pasteHTML` có trong prosemirror-view 1.42.7 (`dist/index.d.ts:569-573`). Dòng ép văn bản thuần là tuỳ chọn: giữ HTML thì người dùng giữ được đậm và link khi dán, và schema đã lọc rồi.

### 1.6 Kích thước bundle
Đã đo bằng esbuild 0.28.2, `--minify`, `gzip -9` và Brotli q11:

| Biến thể | min | gzip | brotli |
|---|---|---|---|
| Danh sách khuyến nghị + Markdown + Link | 442 KB | **140 KB** | 120 KB |
| StarterKit (tắt bớt) + Markdown | 453 KB | 142 KB | 122 KB |
| Như trên nhưng bỏ Link (linkifyjs) | 413 KB | 127 KB | 110 KB |
| Không Markdown | 378 KB | 120 KB | 103 KB |
| Chỉ core + doc/paragraph/text | 296 KB | 91 KB | 80 KB |

Thành phần (bytes trong output): prosemirror-view 96 KB, @tiptap/core 88 KB, prosemirror-model 44 KB, marked 40 KB, prosemirror-transform 32 KB, extension-list 21 KB, @tiptap/markdown 21 KB, linkifyjs 19 KB.

Đối chiếu Bundlephobia: `@tiptap/starter-kit@3.32.0` 106 KB gzip và `@tiptap/core` 36.8 KB gzip, cả hai không tính peer dependency ([bundlephobia](https://bundlephobia.com/package/@tiptap/starter-kit@3.32.0)). Vite 8 dùng Rolldown và Oxc nên con số có thể lệch vài phần trăm (suy luận). Cloudflare phục vụ Brotli, nên con số thực tế khi tải là khoảng **120 KB**, và chỉ tải ở `?new=1`.

---

## 2. IME: tiếng Việt và Pinyin

**Đã kiểm (thực nghiệm):** trong Chromium, Playwright gửi composition qua CDP (`Input.imeSetComposition` với "vie", "việ", "việt", rồi `Input.insertText`) cho ra `"Xin việt Nam"` đúng. Đây chỉ là đường composition chuẩn của Chromium, **không** phải Unikey, EVKey, Gboard hay iOS thật.

**Issue đã biết** (nguồn chính thức, chưa tái hiện):

| Môi trường | Issue | Trạng thái | Liên quan |
|---|---|---|---|
| Safari/WebKit + IME Trung trong **Heading** | [tiptap#7271](https://github.com/ueberdosis/tiptap/issues/7271): pinyin còn sót cạnh chữ Hán | open (v3) | Trực tiếp: có h2/h3 |
| Safari + IME ở đầu **list item** tạo bằng `- ` | [tiptap#6825](https://github.com/ueberdosis/tiptap/issues/6825) | open (3.2) | Trực tiếp |
| iPhone Pinyin, đổi đoạn thành heading giữa lúc composition | [prosemirror#1395](https://github.com/ProseMirror/prosemirror/issues/1395) | open | Khi bấm nút H2 lúc đang gõ |
| Chrome Android Gboard, mark bị mất khi composition | [prosemirror#1043](https://github.com/ProseMirror/prosemirror/issues/1043) | open | Bật đậm giữa từ |
| CharacterCount + IME CJK cắt chữ khi chạm giới hạn | [tiptap#5928](https://github.com/ueberdosis/tiptap/issues/5928) | open | Giới hạn 10 000 |
| Lexical maxLength + Telex | [mdx-editor#808](https://github.com/mdx-editor/editor/issues/808) | open | Cùng lớp lỗi: chặn cứng theo độ dài khi đang IME |
| Unikey/EVKey trên Windows nuốt dấu cách (editor khác: Jodit) | [jodit#1522](https://github.com/xdan/jodit/issues/1522) | open | Unikey không dùng composition mà gửi Backspace rồi gõ lại; khác macOS/iOS Telex |

ProseMirror vẫn liên tục vá composition trên Android và Safari: changelog prosemirror-view có các mục *"Chrome no longer fires key events for backspace during composition"*, *"Safari issue that broke composition right after changing the set of active marks"*, *"SwiftKey on Android… interpreted as Enter"* ([CHANGELOG](https://github.com/ProseMirror/prosemirror-view/blob/master/CHANGELOG.md)). Không tìm thấy issue nào về tiếng Việt trên tracker TipTap, ProseMirror hay forum discuss.prosemirror.net (search API trả 0 kết quả). Như vậy là chưa có bằng chứng, không có nghĩa là không có lỗi.

**Giảm rủi ro:**
- Không chặn cứng độ dài trong editor. Đếm `getMarkdown().length` (debounce khi có `update`) để hiển thị, rồi kiểm lúc submit và kiểm lại ở Worker.
- Không đổi loại block khi `view.composing` đúng: thanh công cụ bỏ qua hoặc chờ `compositionend`.
- Làm checklist kiểm tay: Windows Chrome với Unikey và EVKey (Telex, VNI), macOS Safari Telex, iOS Safari với bàn phím Việt và Pinyin, Android Chrome với Gboard tiếng Việt và Laban Key.
- Giữ textarea làm phương án dự phòng khi `import()` lỗi (đã có trong thiết kế).

---

## 3. Astro 7.1.3 và Vite

### Đã kiểm
- **Script có xử lý phải không có thuộc tính nào ngoài `src`.** Có thuộc tính khác thì Astro không xử lý ([docs](https://docs.astro.build/en/guides/client-side-scripts/#unprocessed-scripts)). Đã thử bằng `@astrojs/compiler` 2.13.1 (bản trong repo): `<script slot="scripts">` được xuất **nguyên văn**, còn `<script>` không thuộc tính thành `$$renderScript(... ?astro&type=script&index=0&lang.ts)`. Vì vậy **không được** đặt script editor vào `slot="scripts"` như `CommunityTeamsPage.astro:24`, mà phải đặt `<script>` trong nội dung mặc định. Nó sẽ render tại chỗ, trong `<main>`, qua `<slot />` (`src/layouts/SiteLayout.astro:582`).
- Từ Astro 5, script được render đúng chỗ khai báo, không hoist lên `<head>`, và các script trên một trang không còn bị gộp chung ([upgrade v5](https://docs.astro.build/en/guides/upgrade-to/v5/#script-tags-are-rendered-directly-as-declared)).
- **Script có `import()` không bị inline vào HTML.** `shouldInlineScriptChunk` loại chunk có dynamic import (`node_modules/astro/dist/core/build/plugins/plugin-scripts.js:3-15`). Do đó HTML chứa `<script type="module" src="/_astro/…">`, còn TipTap nằm ở một chunk riêng, chỉ tải khi gọi `import()` (code splitting của Vite: [docs](https://vite.dev/guide/features#dynamic-import)).
- **Tên file**: `${build.assets}/${name}.[hash].js` cho cả entry lẫn chunk client (`node_modules/astro/dist/core/build/vite-build-config.js:137-142`). `build.assets` mặc định là `'_astro'` ([config ref](https://docs.astro.build/en/reference/configuration-reference/#buildassets)).
- Repo dùng Vite **8.1.5** (node_modules). Target build mặc định là `baseline-widely-available`, tức `chrome111, edge111, firefox114, safari16.4, ios16.4` (`node_modules/vite/dist/node/chunks/node.js:610-617`). Baseline của repo cho `js/` là ES2022/Safari 16 (`tests-js/browser-baseline.test.mjs:8-12`). Nếu cần khớp Safari 16.0 đến 16.3 thì đặt `vite.build.target`.
- Hiện **không có** script Astro nào được bundle trong `src/` để làm mẫu: mọi `<script>` đều là `is:inline` (grep `<script` trong `src/`, ví dụ `src/components/pages/CommunityTeamsPage.astro:24`, `src/layouts/SiteLayout.astro:376-712`). Test còn khẳng định `/doi-chuan/` và Landing không có `_astro/` (`tests-js/astro-dist-contract.test.mjs:923,926`). Editor sẽ là entry Vite đầu tiên.

### Cấu hình repo: cái gì cản
| Chỗ | Cản? | Việc phải làm |
|---|---|---|
| `astro.config.mjs:33-35` (`vite.plugins: [denyPrivateArtifacts()]`) | Không. Plugin chỉ là middleware dev chặn đường dẫn private (`astro.config.mjs:15-28`) | Không cần đổi |
| `src/pages/js/[file].js.ts:6-13` + `src/lib/public-artifact-manifest.mjs:17-108` | Không với `_astro`. Route này chỉ phục vụ nguyên byte các file `js/` có trong manifest | Module `js/` mới (vd `js/markdown.js`) phải thêm `entry("js", "markdown")` |
| `scripts/verify-astro-dist.mjs:271-305` (allowlist dist chính xác) | **Có.** `_astro/*.js` sẽ nằm trong `unexpectedFiles` và `npm run verify` thất bại | Thêm tập `_astro/` được phép: lấy từ `src="/_astro/…"` trong HTML trang cộng đồng cùng các import tĩnh và động của các chunk đó; không được rỗng; không trang nào khác tham chiếu tới |
| `scripts/verify-astro-dist.mjs:659-669` (`COMMUNITY_PAGES` mount, entry) | Không, chỉ cần vẫn còn `src="/js/community-teams.js"` | Cập nhật đường dẫn `doi-tu-build` khi đổi URL |
| `public/_headers` (không có rule `/_astro/*`) | Không cản về đúng sai: Pages mặc định đã gửi `public, max-age=0, must-revalidate` ([CF docs](https://developers.cloudflare.com/pages/configuration/serving-pages/)) | Tuỳ chọn: thêm `/_astro/*` với `max-age=31536000, immutable`. Khi đó phải sửa `tests-js/pages-headers-contract.test.mjs:8-43,90-96`, vì test này đòi đúng danh sách rule và mọi rule cùng một policy |
| Không có CSP trong repo (grep `Content-Security-Policy` không ra kết quả) | Không | — |
| Deploy Pages ghi đè chunk hash cũ | Rủi ro runtime | Tab mở trước lúc deploy sẽ nhận 404 khi `import()`. Bắt lỗi rồi hiện nút tải lại (thiết kế đã có) |

### Cách nạp khuyến nghị
```astro
<!-- CommunityTeamsPage.astro, nội dung mặc định, KHÔNG slot -->
<script>
  import '../../scripts/md-editor-element.ts';
</script>
```
- `src/scripts/md-editor-element.ts` (nhỏ, tải ở mọi chế độ của trang cộng đồng) định nghĩa `customElements.define('cm-md-editor', …)`. `connectedCallback` gọi `await import('./md-editor-tiptap.ts')`, tức chunk TipTap khoảng 120 KB br. Element có thuộc tính `value` (Markdown), phát sự kiện `input`, gắn `<textarea>` dự phòng khi import lỗi, và gọi `editor.destroy()` trong `disconnectedCallback`.
- `js/community-team-form.js` tạo `el('cm-md-editor', …)`. Thứ tự chạy không quan trọng: custom element sẽ được upgrade khi `define` chạy (suy luận theo chuẩn Custom Elements). Có thể chờ `customElements.whenDefined`.
- Đánh đổi: phần 0-dep trong `js/` không bị phá. Chỉ có thêm một entry Vite với ranh giới rõ, và toàn bộ trao đổi đi qua DOM.

---

## 4. Module ESM thuần trong `js/` dùng chung cho build và client bundle

**Đã kiểm (build và SSR):** `.ts` và `.astro` đang import `js/` theo đường dẫn tương đối và chạy lúc build:
- `src/lib/lookup-pages.ts:27` và `src/lib/team-ssr.ts:10` import `treeToHtml`/`treeToText` từ `../../js/view-tree.js`.
- `src/lib/llms-documents.ts:15` import `treeToText`.
- `src/lib/team-section-ssr.js:23` import `disableButtons`.
- `src/components/pages/CommunityTeamsPage.astro:6` import `pick` từ `js/i18n.js`.

`js/view-tree.js` không import gì và không chạm `document` ở top level (`js/view-tree.js:6,30,44`). `treeToDom` nhận `doc = globalThis.document` làm tham số, nên `js/markdown.js` dựa trên view-tree sẽ chạy được trong Node.

**Suy luận (chưa build):** script Astro có xử lý import `../../js/markdown.js` cũng sẽ được Vite bundle như mọi file trong project root, vì SSR và client dùng cùng resolver và `js/` nằm trong workspace root. Lưu ý thêm:
- Module sẽ có **hai bản**: một bản trong chunk `_astro` và một bản thô ở `/js/markdown.js` cho `community-teams.js`. Với hàm thuần thì vô hại, chỉ tốn thêm vài KB. Tránh đặt state module-level, ví dụ setter kiểu `setZhNameResolver`, trong module dùng chung.
- Editor không cần renderer. Nếu có xem trước thì nên để `community-team-form.js` dùng bản `/js/`, chunk editor khỏi import.
- Module trong `js/` không được import gói npm, nếu không route `/js/` sẽ phục vụ một file không chạy được.

---

## 5. Playwright với TipTap

**Đã kiểm** bằng Playwright 1.61.1 (bản của repo) trên Chromium:
- `page.locator('.ProseMirror').click()` rồi `keyboard.type('## Tiêu đề hai')`, `Enter`, `- mục`, `Tab`: input rule chạy đúng, và `page.evaluate(() => editor.getMarkdown())` trả `"## Tiêu đề hai\n\nĐoạn có **đậm** …\n\n- mục một\n  - mục lồng\n\n> trích dẫn"`. Gõ `**đậm**` thì input rule chuyển thành mark.
- `locator.fill()` chạy trên `[contenteditable]` ([Playwright docs](https://github.com/microsoft/playwright/blob/main/docs/src/api/class-locator.md)). Đã kiểm: `"Nội dung fill tiếng Việt có dấu: Trương Phi"`.
- Dán: `dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt }))` với `DataTransfer` chứa HTML hoặc File, như bảng ở §1.5.
- IME: Playwright chưa có API ([issue #5777](https://github.com/microsoft/playwright/issues/5777) open; [PR #9535](https://github.com/microsoft/playwright/pull/9535) không merge). Với Chromium dùng CDP `Input.imeSetComposition` và `Input.insertText` ([CDP](https://chromedevtools.github.io/devtools-protocol/tot/Input/#method-imeSetComposition), experimental). Đã chạy được.
- **WebKit chưa chạy được**: cache máy có `webkit-2272`, còn Playwright 1.61.1 đòi `webkit-2311`.

**Mẫu cho `tests-e2e/community-teams.spec.mjs`:** giữ nguyên cách mock `page.route` và đọc `calls` như đang làm (`tests-e2e/community-teams.spec.mjs:202-224`), chỉ thay `#cm-team-playstyle.fill(...)` bằng gõ vào `cm-md-editor .ProseMirror`, rồi assert `body.bodyMd`. Không nên đọc `editor` toàn cục trong e2e. Hãy assert payload POST, vì đó là hợp đồng thật.

---

## Ma trận lựa chọn (đã xếp hạng)

**Cách nạp TipTap**
| # | Phương án | Hiệu năng | Độ phức tạp | Bảo trì | Hợp kiến trúc |
|---|---|---|---|---|---|
| 1 | **Script Astro có xử lý + custom element + `import()`** | Chỉ tải ở chế độ new | Thấp, cộng thêm allowlist dist | npm pin, Vite tự hash | Tốt: tách khỏi `js/` 0-dep |
| 2 | Bundle sẵn bằng esbuild vào `js/vendor/tiptap.js` + manifest | Tương đương | Cần script build riêng và commit file 440 KB đã sinh | Mỗi lần nâng phải sinh lại; không có hash nên cache chỉ dựa revalidate | Kém: file sinh nằm trong `js/` |
| 3 | CDN (esm.sh) | Phụ thuộc bên thứ ba | Thấp | Rủi ro supply chain, không pin integrity | Kém |

**Bộ extension**: (1) danh sách tường minh, vì đó là allowlist; (2) StarterKit tắt bớt, chỉ lớn hơn 2.5 KB nhưng rủi ro tự mở rộng khi nâng bản.

## Rủi ro chấp nhận (adoption)
- TipTap: MIT, đội ngũ có trả lương duy trì, bản phát hành dày (3.32.0, cùng ngày cho mọi gói). `@tiptap/markdown` tự nhận "early release" và đang có 3 issue escape mở. **Pin chính xác và có test round-trip ở Node** là điều kiện bắt buộc.
- ProseMirror: rất trưởng thành, nhưng IME trên Safari và Android là lớp lỗi kéo dài nhiều năm (xem §2).
- Bundle khoảng 120 KB br chỉ ở `?new=1`. Chấp nhận được, nhưng trên 3G nên có trạng thái "đang tải trình soạn".

## Chưa kiểm chứng
- Gõ tiếng Việt thật bằng Unikey/EVKey (Windows, Telex/VNI), macOS/iOS Telex, Gboard và Laban trên Android, cùng Pinyin iOS trong TipTap 3.32.0. Hành vi cụ thể, kể cả có lỗi hay không, phải kiểm tay trên thiết bị.
- WebKit trong Playwright (thiếu browser bản 2311) và Firefox.
- Một lần `astro build` thật: tên chunk, kích thước sau Rolldown/Oxc, và liệu `modulePreload` polyfill có chèn thêm file `_astro` nào không.
- Cách A cấm list lồng (`ListItem.extend({ content: 'paragraph' })`) và `Paragraph.extend` với `renderMarkdown` để escape đầu đoạn: chưa chạy thử.
- Nguyên nhân `levels: [2,3]` không hạ `#` xuống paragraph khi parse; mới chỉ quan sát được hiện tượng.
- Lỗi escape có thay đổi ở bản vá sau 3.32.0 hay không (PR #8520 chưa merge).

## Câu hỏi còn mở (cho người lập plan)
1. Ánh xạ heading cho profile `ugc`: kẹp `##`/`###` thành h2/h3 (khuyến nghị), hay đổi editor sang `levels [1,2]`?
2. Có cho list lồng không: cấm (A) hay để renderer hỗ trợ một cấp (B)?
3. Có giữ `HardBreak` (Shift+Enter) không? Nếu giữ thì renderer phải xuất `<br>`.
4. Dán HTML: để schema tự lọc (giữ đậm và link) hay ép văn bản thuần?
