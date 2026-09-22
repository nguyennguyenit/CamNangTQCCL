---
phase: 1
title: "Ledger route handle và bộ sinh slug khóa"
status: pending
priority: P1
effort: "1d"
dependencies: []
---

# Phase 1 — Ledger route handle và bộ sinh slug khóa

## Goal

Sinh một lần rồi **đóng băng** handle URL cho đủ 1366 hàng Đội chuẩn và 166 đội Đội khác,
sao cho sửa `displayNameVi` về sau **không** đổi URL. Phase này không đổi generation đang
pin, không cần crawl; Phase 2 có thể rebind metadata sang successor provenance-only nếu
payload byte-identical và mọi final route giữ nguyên.

## Evidence and scope

- `src/data/recommended-reference/5202c942…/index.json`: 1366 hàng, mọi hàng có
  `sourceConfigId`, `displayNameVi` (0 hàng thiếu), `nameZh`, `sourceSeasonCode` (26 mùa,
  0 hàng thiếu), `tierOrder`, `value`, `listIndex`, `factionRaw`.
- `src/data/recommended-reference/5202c942…/other-teams.json`: 40 hàng admitted (không
  cần handle riêng — chúng trỏ về `legacyTeamId`).
- `data/teams.json`: 166 đội gốc, `id` dạng `team-intro-N` / `moi-phe-N`, nhãn Việt ở
  `nickname || name`, 0 nhãn chứa chữ Hán.
- `pipeline/recommended-identity-map.json` **không dùng được** làm nơi chứa handle: khoá
  theo alias tên (661 entry `kind: team` phủ 1366 hàng), còn handle là **theo từng hàng**.
- Số đo đã chốt (brainstorm mục 5c–5d): slug thuần từ tên chỉ cho 656/1366 giá trị khác
  nhau; `SC + slug(tên bỏ ngoặc)` cho **1264 khoá duy nhất, trong đó 1181 hàng có khoá
  riêng** còn 185 hàng nằm trong 83 nhóm trùng, và **cả 83 nhóm đều nằm gọn trong một mùa**.
  Không có tiền tố mùa thì 243 nhóm trùng / 1069 hàng — con số đó **không** phải khoá nhóm
  của luật sinh (xem mục Luật sinh).
- Bất biến bắt buộc: `isRoutableIdentifier` (`src/lib/team-detail-routes.ts:10-19`) —
  chuỗi khác rỗng, ≤128 byte UTF-8, không khớp
  `[\u0000-\u001f\u007f/\\?#%:*"<>|\s]`, và không bắt đầu/kết thúc bằng `.`.

## Files

- Create: `pipeline/team_route_handles.py` — bộ sinh + validator, CLI `--write` / `--check`.
- Create: `pipeline/team-route-handles.json` — ledger đã sinh, commit vào repo.
- Create: `tests/test_team_route_handles.py` — test cho luật sinh và validator.
- Intentionally unchanged: `pipeline/recommended-identity-map.json`,
  `pipeline/build_recommended_reference.py`, `pipeline/site_localization.py`, generation
  đang pin và `src/data/recommended-reference/current.json`.

## Shared contract — ledger và luật sinh

### Định dạng ledger

```json
{
  "schemaVersion": 1,
  "generationId": "5202c942d3e9bc7015fa5dc9556b146f5ac3d1b757e6657c1632d4fa4c47252a",
  "legacyTeamsSha256": "sha256:<64 ký tự hex của data/teams.json tại thời điểm sinh>",
  "note": "Handle URL đã review; gán một lần, không suy lại từ displayNameVi.",
  "handles": {
    "recommended": { "<sourceConfigId>": "<handle không kèm mùa>" },
    "legacy": { "<legacyTeamId>": "<handle>" }
  }
}
```

Handle **không kèm mùa**; tầng dựng route ghép `SC` (mã mùa viết thường, ký tự không phải
chữ/số đổi thành `-`). Mùa luôn lấy từ dữ liệu, không đóng băng hai lần.

### Luật sinh cho Đội chuẩn

`S(x)` = NFD bỏ dấu, `đ→d`, chữ thường, chuỗi ký tự không phải `[a-z0-9]` gom thành `-`,
cắt `-` hai đầu.

`SC(r)` = `sourceSeasonCode` viết thường, ký tự ngoài `[a-z0-9]` → `-` (`PK-S28` → `pk-s28`,
`OG` → `og`).

**Khoá nhóm va chạm = `(SC(r), base(r))` — cùng mùa và cùng base.** Đây là chỗ dễ đọc sai
nhất: nhóm theo `base` đơn thuần cho **243 nhóm / 1069 hàng** và sinh URL như
`pk-s25-ngo-ky-25-wu-qi`, `s3-ngo-ky-u-wu-qi`, lệch hẳn bảng 8 nhóm và baseline bên dưới.
Nhóm theo `(SC, base)` cho **83 nhóm / 185 hàng**, và cả 83 nhóm đều nằm gọn trong một mùa.

1. `base = S(tên đội đã bỏ phần trong ngoặc cuối)`.
2. Nhóm có khoá không trùng: handle = `base`.
3. Nhóm va chạm, hàng **có** ngoặc: handle = `base + "-" + S(đoạn đầu tiên trước dấu
   phẩy của phần trong ngoặc)`.
4. Nhóm va chạm, hàng **không** ngoặc: hàng xếp hạng cao nhất giữ `base`; xếp hạng theo
   `tierOrder` tăng → `value` giảm → không phải `factionRaw == "混"` → `listIndex` tăng →
   `sourceConfigId` tăng. Với generation đang pin, ba trường xếp hạng đều có mặt; generator
   phải fail và nêu `sourceConfigId` nếu hàng trong nhóm va chạm thiếu `tierOrder`, `value`
   hoặc `listIndex`, thay vì tự đặt thứ tự ngầm.
5. Tag cho các hàng còn lại, theo thứ tự ưu tiên:
   - Hai hàng khác `factionRaw` → `S(nhãn Việt của factionRaw)` lấy từ
     `pipeline/recommended-display-map.json` → `labels.faction` (`群`→`quan`,
     `混`→`hon-hop`).
   - Cùng faction → delta của `sourceConfigId` sau khi bỏ tiền tố mùa và tiền tố chung của
     nhóm; ánh xạ `zhuanyou`→`chuyen-huu`, `qun`→`quan`, `hun`→`hon-hop`.
   - Delta rỗng → `goc`.
   - Delta còn ký tự ngoài `[a-z0-9-]` (đuôi chữ Hán, ví dụ `yxms-031-惇惇盾`) → lấy phần
     ASCII của `sourceConfigId`.
6. **Bỏ token mùa trùng ở đầu handle** — phần của luật, không phải ngoại lệ gán tay: nếu
   handle bằng `SC` hoặc bắt đầu bằng `SC + "-"` thì cắt tiền tố đó. Đúng **1 hàng** dính:
   `s3-wei-s3-dingpei-sima` (`displayNameVi = "S3 Tư Mã cấu hình tối ưu"`, `SC = s3`) →
   handle `tu-ma-cau-hinh-toi-uu` → `/doi-chuan/s3-tu-ma-cau-hinh-toi-uu/`. Không có bước
   này thì handle sinh ra vi phạm chính validator ở dưới, và `--write` rồi `--check` không
   thể cùng xanh.

### Luật sinh cho Đội khác

1. `base = S(nickname || name)`.
2. Nhóm không trùng: handle = `base`.
3. Nhóm trùng: phần số ở cuối `id` làm tag (`team-intro-23` → `-23`).

### Kết quả đã đo (baseline để đối chiếu, không phải mục tiêu cần "đạt")

- Đội chuẩn: **1366 `SC + handle` khác nhau**, 0 hàng `None`, 0 handle rỗng, 0 handle bắt
  đầu bằng `SC`, độ dài trung bình **22.83**, dài nhất **55**.
- **Bất biến là trên `SC + handle`, không phải trên handle trần.** Handle trần chỉ có
  **638 giá trị khác nhau** (mùa là thứ tách phần lớn các nhóm). Đừng đọc "1366/1366 handle
  khác nhau" thành yêu cầu handle trần duy nhất toàn cục rồi đi gắn thêm tag.
- **166 hàng** nhận tag (165 hàng trong 83 nhóm va chạm + 1 hàng của luật bước 6). Lệch con
  số này nghĩa là khoá nhóm đang sai — xem lại `(SC, base)`.
- Đội khác: 166 handle, 14 nhóm trùng được tag bằng số id.
- 8 nhóm va chạm và kết quả chốt (tái lập **16/16 dòng** bằng luật trên):

| Nhóm | Handle giữ URL trơn | Hàng còn lại |
| --- | --- | --- |
| `pk-s28-on-hau-cung` | `…-on-hau-cung` (混, T0, 113) | `…-quan` (群, T1.5, 90) |
| `pk-s25-on-hau-cung` | `…-on-hau-cung` (混, T0, 113) | `…-quan` (群, T1.5, 90) |
| `pk-s27-on-hau-cung` | `…-on-hau-cung` (混, T0, 113) | `…-quan` (群, T1, 98) |
| `pk-s28-hoang-ma` | `…-hoang-ma` (群, T0, 113) | `…-hon-hop` (混, T0, 113) |
| `pk-s25-hoang-ma` | `…-hoang-ma` (群, T0, 113) | `…-hon-hop` (混, T0, 113) |
| `pk-s27-hoang-ma` | `…-hoang-ma` (群, T0, 113) | `…-hon-hop` (混, T0, 113) |
| `pk-s26-don-don-thuan` | `…-don-don-thuan` (T0.5, 105) | `…-yxms-031` (T1, 98) |
| `pk-s11-do-doc-cung` | `…-do-doc-cung` (T1, 100) | `…-chuyen-huu` (T1, 100) |

### Validator (fail-loud, chạy trong `--check`)

- Ledger phải khai đúng `generationId` đang pin và `legacyTeamsSha256` phải đúng
  `sha256:<hex>` của bytes hiện tại trong `data/teams.json`; thiếu bất kỳ `sourceConfigId`
  nào của generation, hoặc thừa khoá lạ, đều **fail**.
- Mọi `legacyTeamId` trong `data/teams.json` phải có handle; thừa khoá lạ **fail**.
- `SC + handle` phải khác nhau toàn cục; handle legacy phải khác nhau toàn cục. (Handle
  trần **không** phải duy nhất toàn cục — 638 giá trị khác nhau là đúng.)
- Mọi handle phải qua đúng contract `isRoutableIdentifier`, gồm C0/DEL, khoảng trắng,
  punctuation cấm, giới hạn 128 byte UTF-8 và dấu chấm đầu/cuối; handle không được bằng `SC`
  hoặc bắt đầu bằng `SC + "-"` (luật bước 6 bảo đảm điều này, không phải gán tay).
- `--write` phải tính lại và in các baseline sinh ban đầu: số khoá, số nhóm va chạm, số hàng
  được tag, độ dài trung bình/tối đa và các nhóm lệch; đếm tag phải bằng **166** hàng trước
  khi ghi ledger. `--check` không sinh lại assignment từ tên hiện tại: nó có thể in chẩn
  đoán name-derived nhưng chỉ gate schema, integrity publication, generation/hash, exact
  key-set, routability, cấm lặp tiền tố mùa và uniqueness của final path đã đóng băng.

## Steps

- [x] Viết `pipeline/team_route_handles.py` đọc generation đang pin + `data/teams.json`, sinh
      ledger theo luật trên; `--write` ghi file, `--check` chỉ kiểm và trả mã lỗi.
- [x] Viết `tests/test_team_route_handles.py`: phủ luật 2–6 bằng fixture nhỏ (nhóm không
      trùng, nhóm có ngoặc, nhóm cùng mùa khác faction, nhóm cùng faction khác đuôi id, đuôi
      chữ Hán, delta rỗng, hàng có tên bắt đầu bằng mã mùa của chính nó) và validator (thiếu
      khoá, thừa khoá, hash đội gốc sai, trùng `SC+handle`, handle không routable, handle lặp
      `SC` ở đầu). Test parity routable phải có C0, DEL, khoảng trắng ECMAScript (gồm U+FEFF
      nhưng không coi U+0085 là whitespace), `/`, `%`, dấu chấm đầu/cuối và biên 128/129 byte
      UTF-8.
- [x] Chạy `--write` sinh ledger, đối chiếu baseline ở trên (1366 khoá `recommended` với
      `SC+handle` duy nhất, 166 tag, 166 khoá `legacy`, avg 22.83 / max 55).
- [x] `--check` phải xanh trên ledger vừa sinh, **không cần sửa tay dòng nào**; chạy lại phải
      cho cùng kết quả. `--write` lặp lại với ledger byte-identical là no-op; nếu candidate
      khác ledger đã tồn tại thì fail thay vì âm thầm gán lại URL đã đóng băng.
- [x] Kiểm bất biến "URL không phụ thuộc bản dịch" **trên bản copy publication hợp lệ**:
      `--generation-root <dir>` nhận root chứa `current.json` + thư mục generation (mặc định
      `src/data/recommended-reference`). Copy cả publication root sang thư mục tạm, đổi
      `displayNameVi` của `s11-wu-dudu-zhuanyou` sang tên duy nhất để cố ý làm tan nhóm va
      chạm `PK-S11/Đô Đốc Cung`, rồi cập nhật `manifest.files["index.json"]` (`bytes`,
      `sha256`) và `current.json.manifestSha256` trong bản copy. Chạy `--check
      --generation-root <bản copy>` ⇒ vẫn xanh, ledger bytes và mọi final route segment giữ
      nguyên. Bản copy chưa sửa hash phải bị snapshot validator từ chối. Không bỏ qua snapshot
      validator và **không** sửa file trong `src/data/recommended-reference/`: file đó bị
      manifest pin hash.

## Success criteria

- `python3 -m pipeline.team_route_handles --check` trả mã thoát 0.
- Ledger chứa đúng 1366 khoá `recommended` và 166 khoá `legacy`.
- 0 handle rỗng, 0 handle bằng/bắt đầu bằng `SC` của chính hàng đó.
- `python3 -m pytest tests/test_team_route_handles.py` xanh.
- Phép kiểm bản copy ở Step 5 xanh (chứng minh URL không phụ thuộc bản dịch).

## Failure protocol

`--check` đỏ vì integrity/key-set/routability/uniqueness, hoặc `--write` sinh số khoá/tag
lệch baseline ⇒ **STOP**, không sửa ledger bằng tay để ép xanh. Báo lại: invariant nào hỏng;
nếu là generation thì kèm danh sách `sourceConfigId` và nhóm `(SC, base)` liên quan.

Ghi chú thực thi: `isRoutableIdentifier` trong `src/lib/team-detail-routes.ts:10-19` là
**nguồn chuẩn** của bất biến routable; Python cài lại đúng regex, giới hạn byte và dấu chấm,
với test parity trên các biên nêu ở Step 2. Tầng thứ hai là catalog TS ở phase 2: nó **ném
lỗi** nếu bất kỳ handle nào không qua `isRoutableIdentifier`, nên hai bản cài lệch nhau sẽ
đổ ở `npm run build` chứ không âm thầm phát hành URL hỏng.

## Trạng thái hoàn tất

Đóng ngày 2026-09-22. Cả năm step đã xong, không có mục nào chưa gán vào checklist.

- `pipeline/team_route_handles.py` có `--write` / `--check` / `--generation-root`, từ chối gán
  lại ledger đã tồn tại; `pipeline/team-route-handles.json` đóng băng **1366** handle
  `recommended` + **166** handle `legacy` với `schemaVersion` 1 và `legacyTeamsSha256`.
- `tests/test_team_route_handles.py` phủ luật 2–6 và validator, gồm phép kiểm bản copy
  publication ở Step 5: helper `rewrite_index` cập nhật `manifest.files["index.json"]` cùng
  `current.json.manifestSha256` chỉ trong bản copy rồi chạy CLI qua `--generation-root`.
- Baseline phase 1 không đổi sau khi rebind sang successor generation: `PINNED_BASELINE` của
  generation `7f02c639…` vẫn ghi 1366 khoá, 83 nhóm va chạm, 166 hàng được tag, 166 khoá
  legacy, avg 22.83 / max 55 và 8 nhóm va chạm đã chốt.
- Gate chốt: `python3 -m pipeline.team_route_handles --check` xanh; bộ Python 48/48 xanh.
