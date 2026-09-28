# Design "Sổ binh pháp" — bản chụp canvas

Bản chụp mã nguồn canvas Design dùng làm chuẩn thị giác cho đợt redesign. Contract và quyết định: [brainstorm-260923-2001-so-binh-phap-redesign.md](../../../plans/reports/brainstorm-260923-2001-so-binh-phap-redesign.md).

| | |
|---|---|
| Canvas gốc | <https://claude.ai/artifact/JshDEV8qspJo6VJ6rgiB71> (riêng tư — cần quyền của chủ canvas) |
| Phiên bản chụp | `1790191281-3a81` (StyleGuide bổ sung component; hồ sơ tướng hiện đủ + khối "Trong cẩm nang") |
| Ngày chụp | 2026-09-24 |
| Nội dung | `project/canvas.json` (vị trí, kích thước, tiêu đề artboard) + 28 artboard `project/*.dc.html` + `project/support.js` (shim tự viết, xem dưới) + 25 ảnh chuẩn `screens/*.png` |
| Ảnh chuẩn | Chụp lại 2026-09-24 bằng `scripts/design-capture.mjs` · **đã đối chiếu 2026-09-24 với canvas bản `1790202333-0a0d`** (xem mục đối chiếu) |

## Quy ước

- Canvas là chuẩn thị giác: lấy đúng màu, cỡ chữ, spacing, radius từ mã nguồn artboard; **không** copy inline style vào site — chuyển thành class/token CSS.
- Chiều cao artboard đã đo theo nội dung; canvas không phải chuẩn pixel tuyệt đối theo chiều dọc.
- Chữ mẫu, số liệu, dữ liệu đội trong artboard là mockup (mùa OG · Binh Diễn Xuân Thu); dữ liệu thật lấy từ `data/`.
- `[KÊNH LIÊN HỆ]`, `[NGÀY CẬP NHẬT]` là chỗ giữ, chưa có giá trị thật.
- 3 artboard hướng A/B/C (`DirA-ChienBao`, `DirB-BangTra`, `DirC-ThuyMac`) chỉ để so sánh — không implement.

## Xem artboard và ảnh chuẩn

- **Ảnh chuẩn** `screens/<Artboard>.png`: trạng thái mặc định của từng artboard, rộng đúng `w` trong `canvas.json`, DPR 1, chụp cả trang (nội dung dài hơn `h` vẫn giữ). Đây là ảnh đặt cạnh ảnh localhost khi soát mỗi bước.
- **Xem trên trình duyệt:** `node scripts/design-capture.mjs --serve` rồi mở URL được in ra. Bấm được menu thả/nút có `onClick` như trên canvas. Mở trực tiếp `file://` không chạy (shim phải đọc lại mã nguồn trang qua HTTP).
- **`project/support.js` là shim tự viết, không phải runtime gốc của canvas.** Nó chỉ hiểu `<x-dc>`, `<helmet>`, `<sc-if value>`, `<sc-for list as>`, `{{ đường.dẫn }}`, `onClick="{{ hàm }}"`, `baseVals()`/`renderVals()`, `this.props` (lấy `default` trong `data-props`), `this.state`/`this.setState`. Gặp thẻ `sc-*` lạ, biểu thức ngoài dạng đường dẫn, biến không có hoặc còn sót `{{` → hiện dải báo lỗi đỏ, script chụp dừng với mã lỗi 1.
- Artboard tải font từ Google Fonts như canvas → chụp cần mạng (~35 giây cho 25 artboard). Script tải **mọi** lát unicode-range của các font trước khi chụp (lát nào lỗi mạng thì chụp lại artboard đó, tối đa 3 lần); dừng nếu Be Vietnam Pro hoặc Noto Serif Display chưa tải. Chụp lại nhiều lần vẫn có thể lệch dưới 1 px ở vị trí nét chữ serif/chữ Hán (Chrome), không đổi bố cục — đừng commit ảnh chỉ vì lệch kiểu này.

### Đối chiếu shim với canvas (2026-09-24)

Canvas chỉ mở được trong Chrome profile của chủ canvas (tài khoản đã đăng nhập claude.ai). Hai cách đã kiểm:

- **Runtime gốc:** menu xuất của một artboard (Play full screen → Export → HTML .zip) kèm `support.js` + `vendor/react*.js` của canvas. Dựng cả 25 artboard của bản chụp này bằng runtime gốc trong thư mục tạm (không commit runtime) rồi so với ảnh do shim dựng: **24/25 trùng từng pixel**; `StyleGuide` lệch 143 px ở dòng mã màu phe (khử răng cưa chữ, nhìn không khác).
- **Canvas đang chạy:** Export PDF toàn bộ 28 artboard từ canvas bản `1790202333-0a0d`, raster 96 dpi, so với ảnh shim cắt đúng `h`: kích thước 28/28 khớp `canvas.json`; sau khi thu nhỏ 25% để bỏ nhiễu khử răng cưa, lệch ≤ 0,3% ở mọi artboard (chỉ viền chữ Hán) → nội dung canvas hiện tại trùng bản chụp `1790191281-3a81`.

Lần sau canvas đổi: chụp lại theo mục dưới và lặp lại một trong hai cách trên. Lệch → sửa `support.js` rồi chụp lại; không sửa `.dc.html`.

## Token & component

`tokens.json` là **golden master vi mô** (plan.md quyết định #15) và là nguồn duy nhất: màu sáng/tối/phe, font, vai trò chữ (`type`: size + line-height + weight + letter-spacing), thang `space`/`radius`/`control`/`shadow`/`border`/`z`/`motion`/`focus`, và **danh mục component** ở mục `components` (selector, cấu tạo, biến thể, trạng thái, bảng thuộc tính → token, artboard nguồn, phase sở hữu, phase dùng). Mỗi token ghi `source` (artboard, `renderVals`, StyleGuide hoặc CSS cũ). Không chép lại bảng giá trị ra tài liệu khác.

| Việc | Lệnh |
|---|---|
| Báo cáo tần suất giá trị artboard + giá trị thô của `css/styles.css` | `node scripts/design-tokens.mjs --extract [--report <file>]` |
| Soát khối `:root` khớp `tokens.json`, không mã màu ngoài khối token, không giá trị thô ngoài khối legacy | `node scripts/design-tokens.mjs --check` |
| So ảnh bố cục (vĩ mô, người duyệt — không pass/fail pixel) | `npm run build && npm run preview` rồi `node scripts/design-compare.mjs --phase NN [--theme dark]` |
| Đo computed style so với token (vi mô, tự động) | `node scripts/design-compare.mjs --tokens --phase NN [--theme dark] [--base http://127.0.0.1:4321]` |

Quy tắc:

- **Thêm token trước, dùng sau.** Giá trị mới phải có mục trong `tokens.json` kèm `source`, rồi CSS mới dùng `var(--…)`; không viết px/hex/`rgba()` trực tiếp. `--check` chặn giá trị thô và mã màu ngoài khối token.
- **Hai theme.** Token chỉ khai ở `color.light`/nhóm dùng chung = áp cho cả hai theme; chỉ khai `dark` khi bảng tối StyleGuide có giá trị tương ứng, hoặc khi ngưỡng tách lớp/tương phản của theme tối (`meta.contrast`) đòi giá trị khác — ghi lý do và tỉ lệ đo được ở `source`/`note`. Theme tối 2026-09-28 đã rời `renderVals dark` ở nền/thẻ/viền/son để đạt các ngưỡng đó.
- **Danh mục trước CSS.** Component mới phải có mục trong `components` trước khi viết CSS (thiếu thì bổ sung danh mục, không viết CSS riêng cho một trang).
- **Khối `legacy`** trong `css/styles.css` là CSS cũ đang thu dần: mỗi phase xóa phần mình viết lại khỏi khối và hạ `ceiling` trong comment `/* legacy:start ceiling=N */` xuống đúng số còn lại (không phase nào được tăng); Phase 10 đưa về 0.
- **Giá trị artboard không làm tròn**; chỗ contract thắng artboard (brainstorm §11.4) ghi ở `note` của token (ví dụ vùng bấm 40px → 44px).
- Vai trò chữ sinh ra `--type-<vai trò>` (font shorthand) và `--type-<vai trò>-spacing` khi có letter-spacing; thứ tự khai trong `tokens.json` chính là thứ tự trong `:root`.

## Font self-host

Font nằm ở `public/fonts/` (deployment copy nguyên trạng vào `dist/fonts/`, `_headers` có rule `/fonts/*`, verifier khóa từng byte). `@font-face` khai trong `css/styles.css` với `font-display: swap`, giữ đúng `unicode-range` ba subset của Google Fonts; `SiteLayout.astro` (mọi trang, kể cả Landing) preload 4 file dùng ngay màn đầu: Be Vietnam Pro 400 và Noto Serif Display 700, mỗi font hai subset latin và vietnamese (chữ có dấu nằm ở subset vietnamese).

**Nguồn gốc (tải 2026-09-25)** bằng `curl` với User-Agent Chrome hiện đại (Chrome/140):

```
https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Noto+Serif+Display:wght@700&display=swap
```

| File | Font | Subset | Byte | SHA-256 | URL nguồn (gstatic) |
| --- | --- | --- | --- | --- | --- |
| `be-vietnam-pro-400-vietnamese.woff2` | Be Vietnam Pro 400 | vietnamese | 4720 | `b0d9b8aec7f47207ce4065be34286203e0741c8329be6d05986b149f991f84c1` | `https://fonts.gstatic.com/s/bevietnampro/v12/QdVPSTAyLFyeg_IDWvOJmVES_Hw4BXoYZ7AjSh8.woff2` |
| `be-vietnam-pro-400-latin-ext.woff2` | Be Vietnam Pro 400 | latin-ext | 6880 | `c2ae124f149371e1b6209cbba234852310caeee3c32990a56ccb93ac1c7edb9a` | `https://fonts.gstatic.com/s/bevietnampro/v12/QdVPSTAyLFyeg_IDWvOJmVES_Hw5BXoYZ7AjSh8.woff2` |
| `be-vietnam-pro-400-latin.woff2` | Be Vietnam Pro 400 | latin | 12908 | `d25f70ff7404fddbeb150c9c687bf37069468a5cdf59117b2a30226d1ebfa5c0` | `https://fonts.gstatic.com/s/bevietnampro/v12/QdVPSTAyLFyeg_IDWvOJmVES_Hw3BXoYZ7Aj.woff2` |
| `be-vietnam-pro-500-vietnamese.woff2` | Be Vietnam Pro 500 | vietnamese | 5100 | `e83829fe40a88cff1c6ee213801661468bfed922771d1c382b4c1fdc269a5648` | `https://fonts.gstatic.com/s/bevietnampro/v12/QdVMSTAyLFyeg_IDWvOJmVES_HTEJm86Rb0JcBaoUUU.woff2` |
| `be-vietnam-pro-500-latin-ext.woff2` | Be Vietnam Pro 500 | latin-ext | 7184 | `83b86791eb0ebfca23daa3f70ee179f13638c69441b69a6d2deb6b96a95385ea` | `https://fonts.gstatic.com/s/bevietnampro/v12/QdVMSTAyLFyeg_IDWvOJmVES_HTEJm87Rb0JcBaoUUU.woff2` |
| `be-vietnam-pro-500-latin.woff2` | Be Vietnam Pro 500 | latin | 13324 | `0336df67f25be86ea38a6f37b11ffb4901c1ed65ce06ba99d6a304913e997e52` | `https://fonts.gstatic.com/s/bevietnampro/v12/QdVMSTAyLFyeg_IDWvOJmVES_HTEJm81Rb0JcBao.woff2` |
| `be-vietnam-pro-600-vietnamese.woff2` | Be Vietnam Pro 600 | vietnamese | 5124 | `843908240371827470dd178e284ffbbeb85f1563bf47e5b9c9db58526fb7f6e0` | `https://fonts.gstatic.com/s/bevietnampro/v12/QdVMSTAyLFyeg_IDWvOJmVES_HToIW86Rb0JcBaoUUU.woff2` |
| `be-vietnam-pro-600-latin-ext.woff2` | Be Vietnam Pro 600 | latin-ext | 7152 | `90c10a1f4fdd8aa634b70bfc22ca991f12bba15b1661ea2390443e31888e1f5b` | `https://fonts.gstatic.com/s/bevietnampro/v12/QdVMSTAyLFyeg_IDWvOJmVES_HToIW87Rb0JcBaoUUU.woff2` |
| `be-vietnam-pro-600-latin.woff2` | Be Vietnam Pro 600 | latin | 13428 | `14950d0af319bbc1f7a26ed08bf1ba7a9e18324111056bb0c81eef0983a931c0` | `https://fonts.gstatic.com/s/bevietnampro/v12/QdVMSTAyLFyeg_IDWvOJmVES_HToIW81Rb0JcBao.woff2` |
| `be-vietnam-pro-700-vietnamese.woff2` | Be Vietnam Pro 700 | vietnamese | 5132 | `141f6c45010274d7d3625d0554476ec1161274d9eb09a38135977ea1b2b84895` | `https://fonts.gstatic.com/s/bevietnampro/v12/QdVMSTAyLFyeg_IDWvOJmVES_HSMIG86Rb0JcBaoUUU.woff2` |
| `be-vietnam-pro-700-latin-ext.woff2` | Be Vietnam Pro 700 | latin-ext | 7164 | `f446d28e986c5695283afcb13a7719dabd9f2cec28ab49ecb43a328efa009f05` | `https://fonts.gstatic.com/s/bevietnampro/v12/QdVMSTAyLFyeg_IDWvOJmVES_HSMIG87Rb0JcBaoUUU.woff2` |
| `be-vietnam-pro-700-latin.woff2` | Be Vietnam Pro 700 | latin | 13348 | `cf841d2b615f068e77a918114f44c17d51d0b73314fdff81eae95f528387c391` | `https://fonts.gstatic.com/s/bevietnampro/v12/QdVMSTAyLFyeg_IDWvOJmVES_HSMIG81Rb0JcBao.woff2` |
| `noto-serif-display-700-vietnamese.woff2` | Noto Serif Display 700 | vietnamese | 5488 | `c2d298af7f9d27b5c981cc08f47092d155c54bf8e90a64928e61db89738bd54d` | `https://fonts.gstatic.com/s/notoserifdisplay/v29/buERppa9f8_vkXaZLAgP0G5Wi6QmA1QaeYah2sovLCDq_ZgLyt3idQfktOG-PVq65egCYjQfg-zDkf4QrQ.woff2` |
| `noto-serif-display-700-latin-ext.woff2` | Noto Serif Display 700 | latin-ext | 55068 | `c2a0e6354dd75490e665692a6c5e81c7ea88d4e04a15ad5c52d9de6dff188a9d` | `https://fonts.gstatic.com/s/notoserifdisplay/v29/buERppa9f8_vkXaZLAgP0G5Wi6QmA1QaeYah2sovLCDq_ZgLyt3idQfktOG-PVq65egDYjQfg-zDkf4QrQ.woff2` |
| `noto-serif-display-700-latin.woff2` | Noto Serif Display 700 | latin | 14484 | `efa81fbf31ef67ef4964f66e4404d72d462da368f2ea8711940a8b2bdccb40e8` | `https://fonts.gstatic.com/s/notoserifdisplay/v29/buERppa9f8_vkXaZLAgP0G5Wi6QmA1QaeYah2sovLCDq_ZgLyt3idQfktOG-PVq65egNYjQfg-zDkf4.woff2` |

Tổng **176.504 byte** (15 file, đúng ngân sách 150–250 KB). Mỗi dòng kèm URL `fonts.gstatic.com` mà CSS2 API trả về cho đúng weight/subset — tải lại bằng URL đó (UA Chrome hiện đại) phải ra đúng byte và SHA-256 trong bảng. `public/fonts/OFL.txt` giữ nguyên văn bản quyền + SIL Open Font License 1.1 của cả hai font (`google/fonts`: `ofl/bevietnampro/OFL.txt`, `ofl/notoserifdisplay/OFL.txt`).

Cập nhật font: tải lại CSS2 như trên (UA Chrome), giữ đúng ba subset, ghi lại URL + SHA-256 ở bảng này, rồi chạy `npm run verify`.

### Ấn 兵

Glyph 兵 vẽ bằng SVG path (không tải font CJK) và lưu trong `tokens.json` ở component `an-binh-phap` (`svg.viewBox`, `svg.path`, `svg.provenance`). Nguồn: **Noto Serif TC** (variable, instance `wght=700` trên Google Fonts), tải 2026-09-25:

```
https://raw.githubusercontent.com/google/fonts/main/ofl/notoseriftc/NotoSerifTC%5Bwght%5D.ttf
sha256: 0077e18f57c6908f4a000969880940bdb0dad057c0e8d98b49dc364c3d1b09c6
```

Trích một lần bằng `fontTools==4.59.2` trong venv tạm **ngoài repo** (`python3 -m venv /tmp/tqccl-seal-venv && pip install fonttools==4.59.2`); font CJK không được commit. Script trích (chạy trong venv đó, cần `NotoSerifTC[wght].ttf` cùng thư mục):

```python
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen

font = TTFont('NotoSerifTC.ttf')
instance = instantiateVariableFont(font, {'wght': 700}, inplace=False, updateFontNames=False)
glyphs, name = instance.getGlyphSet(), instance.getBestCmap()[0x5175]
bounds = BoundsPen(glyphs)
glyphs[name].draw(bounds)
x_min, y_min, x_max, y_max = bounds.bounds

class Flipped(SVGPathPen):  # hệ trục font (y lên) → SVG (y xuống)
    def _moveTo(self, pt): super()._moveTo((pt[0] - x_min, y_max - pt[1]))
    def _lineTo(self, pt): super()._lineTo((pt[0] - x_min, y_max - pt[1]))
    def _curveToOne(self, *pts): super()._curveToOne(*[(p[0] - x_min, y_max - p[1]) for p in pts])
    def _qCurveToOne(self, *pts): super()._qCurveToOne(*[(p[0] - x_min, y_max - p[1]) for p in pts])

pen = Flipped(glyphs, ntos=lambda value: f'{round(value, 1):g}')
glyphs[name].draw(pen)
print(f'viewBox="0 0 {x_max - x_min:g} {y_max - y_min:g}"')
print(pen.getCommands())
```

Kết quả: `viewBox="0 0 939.199 940.119"`, 7 subpath (U+5175, `wght=700`). Phase 3 chép path vào SVG tĩnh trong Astro.

### Ảnh chia sẻ `og:image`

`public/og-image.png` (1200×630, khai ở `og:image` mọi trang) là logo `public/logo.png` trên nền `--bg` sáng cùng tên logo "Cẩm Nang Game Tam Quốc Chí - Chiến Lược" (ngắt 2 dòng sau "Game") bằng Noto Serif Display 700 self-host. Sinh lại 2026-09-28 bằng Chromium của Playwright, chạy ở gốc repo; màu theo token sáng (`--bg`, `--ink`):

```bash
node --input-type=module <<'EOF'
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const logo = (await readFile('public/logo.png')).toString('base64');
const font = async (name) => (await readFile(`public/fonts/${name}`)).toString('base64');
const faces = await Promise.all(['latin', 'latin-ext', 'vietnamese'].map(async (subset) =>
  `@font-face{font-family:"Noto Serif Display";font-weight:700;src:url(data:font/woff2;base64,${await font(`noto-serif-display-700-${subset}.woff2`)}) format("woff2");}`));
const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>${faces.join('')}
html,body{margin:0;width:1200px;height:630px;background:#F3EEE3;}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:36px;}
img{width:200px;height:auto;display:block;}
h1{margin:0;font:700 72px/1.15 "Noto Serif Display",serif;color:#1E1B16;text-align:center;}
</style></head><body><img src="data:image/png;base64,${logo}" alt=""><h1>Cẩm Nang Game<br>Tam Quốc Chí - Chiến Lược</h1></body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: 'public/og-image.png', type: 'png' });
await browser.close();
EOF
```

Sinh lại ảnh thì chạy `npm run verify` (verifier so byte `public/og-image.png` với `dist/og-image.png`).

## Artboard → bước trong plan

| Bước | Nội dung | Artboard |
|---|---|---|
| 1 | Token sáng/tối, font, component chung | `StyleGuide` |
| 2 | Header 1 hàng + menu thả Công cụ/Game, menu mobile | header của mọi artboard trang trong, `LandingMenu`, `LandingMenuMobile` |
| 2b | Landing `/`, footer toàn site, mục Tải game | `Landing`, `LandingMobile` |
| 3 | Đội chuẩn/Đội khác: lọc, thẻ, Thẻ/Bảng | `Main`, `MainTable`, `MobileList`, `MobileTable`, `MobileFilters` |
| 4 | Chi tiết đội | `TeamDetail` |
| 5 | Tra cứu + hồ sơ | `Lookup`, `LookupTactics`, `LookupProfile`, `LookupMobile` |
| 6 | Cùng Tồn + Khai hoang | `Coexist`, `CoexistMobile`, `Khaihoang`, `KhaihoangMobile` |
| 7 | 3 công cụ Beta | `Recruit`, `RecruitMobile`, `Analyze`, `AnalyzeMobile`, `Roster`, `RosterMobile` |

## Cập nhật bản chụp

Khi canvas thay đổi: đọc lại toàn bộ `project/` từ canvas, ghi đè `*.dc.html` và `canvas.json` (**giữ nguyên `support.js`**), chạy `node scripts/design-capture.mjs` (ảnh của artboard đã bỏ khỏi canvas tự bị xóa), cập nhật "Phiên bản chụp", "Ngày chụp", "Ảnh chuẩn" ở trên, commit chung một commit `docs(design): …`. Không sửa tay file `.dc.html` ở đây — sửa trên canvas rồi chụp lại. Artboard mới dùng cấu trúc shim chưa hiểu → script báo lỗi; bổ sung shim trong cùng commit.
