# Gợi ý đội từ kho

Gợi ý đội từ kho lets a guest type tướng they own, confirm that list, and ask the local engine for up to five Đội chuẩn configs of the selected season that fit the kho — without reading a screenshot and without an account.

## Sub-features

- `roster-open` opens `/goi-y-doi-tu-kho/` with the review stage and empty tướng / chiến pháp panels.
- `roster-add-hero` adds a published tướng by name through `Thêm tướng ảnh chưa đọc ra…`.
- `roster-confirm` enables gợi ý after `Xác nhận dữ liệu đã đọc`.
- `roster-suggest` runs `Gợi ý 5 đội` and shows `.roster-results`.
- `roster-persist` still has the confirmed kho after reload.

## How to get to it (user POV)

- Choose `Gợi ý đội từ kho` on Landing (ghost hero button or tile).
- Choose `Gợi ý đội từ kho` in the floating quick nav (Beta group).
- Open `/goi-y-doi-tu-kho/` directly.

## Driving it with control-tqccl

Preconditions:

- The verification preview is healthy at `http://127.0.0.1:4175`.
- `control-tqccl doctor` reports that URL and the launch git revision.
- This run's Playwright profile has **no** `tqccl.rosterRecommend.scanState.v1` key yet.
- Image "Đọc ảnh" is out of scope: the harness aborts the production vision Worker. If the only way a step can proceed is that button, report `verified-unreachable` and stop — do not stub the Worker.

- **Open tool.** Go to `/goi-y-doi-tu-kho/`. Run `control-tqccl browser goto --path /goi-y-doi-tu-kho/` and `control-tqccl browser wait --boot`. The heading is `Gợi ý đội từ kho`. Panels `Tướng đã đọc` and `Chiến pháp đã đọc` are visible. `Xác nhận dữ liệu đã đọc` and `Gợi ý 5 đội` are disabled.
- **Add Lưu Bị.** In the tướng add field type `Lưu Bị` and choose `Thêm`. Run `control-tqccl browser fill --role searchbox --name "Thêm tướng ảnh chưa đọc ra…" --value "Lưu Bị"` and `control-tqccl browser click --role button --name "Thêm" --nth 0`. A chip for `Lưu Bị` appears. `Xác nhận dữ liệu đã đọc` becomes enabled; `Gợi ý 5 đội` stays disabled.
- **Add Quan Vũ and Trương Phi.** Repeat fill+`Thêm` with `Quan Vũ`, then `Trương Phi`. Three tướng chips are visible.
- **Confirm.** Choose `Xác nhận dữ liệu đã đọc`. Run `control-tqccl browser click --role button --name "Xác nhận dữ liệu đã đọc"`. `Gợi ý 5 đội` is enabled.
- **Suggest.** Choose `Gợi ý 5 đội`. Run `control-tqccl browser click --role button --name "Gợi ý 5 đội"`. `.roster-results` appears (one results region). The flow step `Gợi ý` is current. Either complete teams or a `Thiếu món` / coverage block is visible — both are engine output from this kho. A blank `.roster-results` with no child sections is a failure.
- **Persist.** Reload. Run `control-tqccl browser goto --path /goi-y-doi-tu-kho/` and `control-tqccl browser wait --boot`. The summary or review still lists `Lưu Bị`, `Quan Vũ`, and `Trương Phi`. `Gợi ý 5 đội` works again without re-adding names.
- **Proof.** After the first successful suggest, run `control-tqccl browser screenshot --path roster/suggest.png --feature goi-y-doi-tu-kho --entry suggest` and `control-tqccl browser snapshot --aria --path roster/suggest.aria.yml --feature goi-y-doi-tu-kho --entry suggest`. Artifacts show `Gợi ý đội từ kho` and at least one of: named recommended teams, `Thiếu món`, or `Độ phủ kho`. Capture the three chips before confirm as `roster/kho.png` / `roster/kho.aria.yml` with `--entry add`.

## Gotchas

- Two `Thêm` buttons exist (tướng and chiến pháp). `--nth 0` is tướng if that panel is first; prefer clicking the button in the panel whose heading is `Tướng đã đọc` via `--css ".roster-review-panel:has(h3) .ana-btn"` only if the name-based click hits the wrong one — then record the CSS in the run notes.
- Adding a name that is not in the published dictionary still creates a chip; gợi ý may then yield only thiếu-món rows. Prefer the exact published Vietnamese names `Lưu Bị`, `Quan Vũ`, `Trương Phi`.
- Changing the kho after confirm disables `Gợi ý 5 đội` until the next `Xác nhận dữ liệu đã đọc`.
- `Xóa toàn bộ kho` uses `confirm()`. The harness must not auto-dismiss it as success. Do not click it in the baseline recipe.
- Season `<select>` labelled in the settings region changes which Đội chuẩn generation is used. Leave the default season.
- Sync / `Đăng nhập` for cloud kho is unreachable on this launch (`/api/roster` is not served). Do not treat a missing sync bar as a product failure.
