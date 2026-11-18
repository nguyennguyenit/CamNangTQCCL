# Phase D — Worker nhận locale ja, alias tên Nhật, eval ảnh client Nhật

Branch: `feat/ja-locale-d-worker`. Rủi ro: cao theo `AGENTS.md` (mọi thay đổi `worker/` cần review Astra → Fable). Effort 6h. Không deploy Worker (ngoài phạm vi).

D gồm hai phần để giữ sở hữu file rời với C:

- **D1** (chạy ngay, song song với A/B/C): Worker nhận `locale`, prompt theo locale, test Worker, ảnh eval + fixture.
- **D2** (sau khi C gộp, vì cần `js/locale-name-aliases.js` của C3): bộ chấm eval dùng alias tên Nhật; test chấm fixture Nhật.

## Bối cảnh

- `explainSubstitute`: `ExplainContext.locale: "vi" | "zh"` (`worker/src/schema.ts:66`), validator đòi đúng khóa và từ chối locale khác (`:264-268`); prompt chỉ có hai nhánh ngôn ngữ (`worker/src/model.ts:110`).
- Đọc ảnh: request là JSON lỏng (`payload?.mode`, `payload?.image`, `payload?.turnstileToken`, `worker/src/index.ts:89`, `:109`, `:127-131`); prompt `VISION_PROMPT` ép mọi chữ Hán về **giản thể** và có đoạn riêng cho client tiếng Việt (`worker/src/model.ts`, khối `VISION_PROMPT`); ba prompt quét kho (`SCAN_HEROES_PROMPT`, `SCAN_TACTICS_PROMPT`, `SCAN_BUILT_TEAMS_PROMPT`) cũng ép giản thể. Không có trường locale.
- Khớp tên: `createEntityIndex` lập bảng khớp chắc từ `chinese` + `aliases` (`js/analyze-map.js:170-185`); `worker/eval/score.ts:5` và `:54-60` dùng chính hàm này để chấm.
- Eval hiện có 5 ảnh `.jpg` + fixture (`worker/eval/images/`, `worker/eval/fixtures/`); runner đã nhận `.webp` (`worker/eval/run-eval.ts`, bảng `MIME`). Chạy AI thật cần khóa, máy chưa có (issue #113): lần này chỉ thêm ảnh + fixture và unit test.
- `worker/src/schema.ts` nằm trong `policy.sourceFiles` (`pipeline/site-localization-policy.json`), nên sửa file này cần ghim lại localization (commit ghim riêng, người ghép làm lại ở H).

## Hợp đồng với C (chốt trước khi làm song song)

1. Request đọc ảnh nhận thêm `locale` **tuỳ chọn**: vắng → hành vi cũ (byte prompt không đổi cho vi/zh); có thì phải thuộc danh sách locale của Worker, sai → `400` JSON có CORS với thông điệp cố định. Áp cho cả bốn mode ảnh (`analyzeTeamImage`, `scanHeroes`, `scanTactics`, `scanBuiltTeams`).
2. `locale: "ja"` nối thêm vào prompt một đoạn: ảnh từ client Nhật 三國志 真戦 (chữ in như 戦報, 主将/副将, 勝利/敗北); chép **nguyên tự dạng Nhật** đang in vào `nameCn`/`tacticsCn`/`booksCn`, không đổi sang giản thể, không dịch, kana giữ nguyên; quy tắc ép giản thể không áp cho locale này. Mọi quy tắc khác (chỉ chép chữ, không đoán qua chân dung, thứ tự phe) giữ nguyên.
3. `explainSubstitute` nhận `locale: "ja"` và trả lời tiếng Nhật; dữ kiện hiệu ứng client gửi là chữ Trung nguồn.
4. Danh sách locale của Worker là bản ghi kiểu `satisfies Record<SiteLocale, string>` cho câu chỉ dẫn ngôn ngữ (TypeScript báo lỗi khi danh sách site thêm locale mà Worker chưa có câu). Worker import `SITE_LOCALES` từ `js/i18n.js` (`worker/tsconfig.json` có `allowJs: true`, eval đã import `../../js/analyze-map.js`). Vì `'ja'` chỉ vào `SITE_LOCALES` ở commit cuối của C, D1 khai danh sách cục bộ `["vi","zh","ja"]` và thêm `tests-js/worker-locales-parity.test.mjs` khẳng định trùng `SITE_LOCALES`; test này chạy xanh sau khi C bật ja (thứ tự ghép C trước D đảm bảo điều đó). Nếu wrangler bundle `js/i18n.js` có vấn đề, giữ danh sách cục bộ + test parity là phương án chính thức.

## D1 — Worker

Sở hữu: `worker/src/schema.ts`, `worker/src/model.ts`, `worker/src/index.ts`, `worker/test/schema.test.ts`, `worker/test/model.test.ts`, `worker/test/index.test.ts`, `worker/test/scan-modes.test.ts`, `worker/eval/images/battle-ja-1.webp`, `worker/eval/images/battle-ja-2.webp`, `worker/eval/fixtures/battle-ja-1.json`, `worker/eval/fixtures/battle-ja-2.json`, `worker/README.md`, `tests-js/worker-locales-parity.test.mjs`.

Bước (TDD):

1. Test đỏ: `validateExplainContext` nhận `ja`, từ chối `ko`/rỗng/sai kiểu; `explainPrompt` cho `ja` chứa câu chỉ dẫn tiếng Nhật; byte prompt vi/zh không đổi (so chuỗi cố định); request ảnh với `locale` sai → 400; vắng `locale` → prompt cũ từng byte; `locale: "ja"` → prompt có đoạn tự dạng Nhật và không có câu ép giản thể; bốn mode ảnh đều nhận.
2. Sửa `schema.ts` (kiểu + validator theo danh sách), `model.ts` (`promptByMode(mode, locale)`, bảng câu ngôn ngữ cho explain), `index.ts` (đọc `payload?.locale` sau `resolveAnalyzeMode`, trước khi gọi model; giữ thứ tự guard rẻ → đắt của `docs/code-standards.md` mục Worker).
3. Ảnh eval: lấy 2 ảnh chiến báo client Nhật (nguồn chờ Q6), che tên người chơi/liên minh, xuất `.webp`; viết fixture theo mẫu `worker/eval/fixtures/battle-trad-1.json` (ghi `source`, phần đã che, ô không chấm để `null`), ID canonical lấy từ Tra cứu.
4. `npm test` và `npm run typecheck` trong `worker/`; cập nhật `worker/README.md` (trường `locale`, chính sách prompt ja).
5. Ghim lại localization cho `worker/src/schema.ts` (commit riêng).

## D2 — Eval dùng alias Nhật (sau C)

Sở hữu: `worker/eval/score.ts`, `worker/eval/run-eval.ts`, `worker/test/eval-score.test.ts`.

1. Test đỏ: `buildIndexes` nhận tuỳ chọn `jaEntries` (từ `data/lookup-ja.json`); fixture Nhật với `nameCn` là tên Nhật (shinjitai, kể cả tên ngoại lệ) chấm `sure` đúng ID; không có `jaEntries` thì kết quả chấm fixture cũ không đổi.
2. `score.ts` gọi `withLocaleAliases` (`js/locale-name-aliases.js` của C3) khi có `jaEntries`; `run-eval.ts` tự nạp `data/lookup-ja.json` cho fixture có trường `locale: "ja"`.
3. `npm test`, `npm run typecheck`.

## Cách kiểm

| Loại | Nội dung |
|---|---|
| Unit Worker | schema/model/index/scan-modes như bước D1.1 |
| Unit eval | `eval-score.test.ts` với fixture Nhật (D2) |
| Parity | `tests-js/worker-locales-parity.test.mjs` sau khi C bật ja |
| Thủ công (không bắt buộc, cần khóa) | `npm run eval:vision -- --only battle-ja-1` khi có khóa; không chặn Done |

## Rủi ro

| Rủi ro | Khả năng × Tác động | Giảm thiểu |
|---|---|---|
| Đổi prompt làm giảm chất lượng đọc ảnh vi/zh | Thấp × Cao | Prompt vi/zh giữ nguyên từng byte (test); đoạn ja chỉ nối khi `locale = ja` |
| Model vẫn đổi tự dạng Nhật sang giản thể | Trung bình × Trung bình | Alias của C3 gồm tên Nhật; bộ khớp hiện có vẫn khớp `aliases` giản thể; eval thật khi có khóa |
| Client cũ không gửi `locale` | Chắc chắn × Thấp | Trường tuỳ chọn, vắng = hành vi cũ |
| Ảnh eval lộ tên người chơi | Trung bình × Cao | Che trước khi commit, reviewer kiểm ảnh |
| Deploy Worker trước Pages hoặc ngược lại | Thấp × Thấp | Tương thích hai chiều (trường tuỳ chọn); deploy ngoài phạm vi |

## Rollback

Revert merge D; Worker production không đổi vì không deploy. Nếu đã ghim localization cho `schema.ts`, chạy lại chuỗi ghim sau revert.

## Done khi

Test và typecheck `worker/` xanh; `explainSubstitute` và bốn mode ảnh nhận `ja`; 2 ảnh `.webp` đã che + 2 fixture; test chấm fixture Nhật bằng alias xanh; parity locale xanh.
