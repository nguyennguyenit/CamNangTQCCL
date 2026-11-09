# Tra cứu

Tra cứu is the encyclopedia: a hub of seven groups, each group a searchable list, with Tướng and Chiến pháp opening a profile dialog (or a dedicated item page) from names the visitor types in Vietnamese, không-dấu, or chữ Hán.

## Sub-features

- `lookup-hub` lists seven group cards on `/tra-cuu/` without loading `app.js`.
- `lookup-heroes` opens `/tra-cuu/tuong/` from the `Tướng` card.
- `lookup-search` filters tướng from the `Tìm tướng` searchbox, including không-dấu `luu bi`.
- `lookup-profile` opens the first result's profile dialog and closes it with Escape.
- `lookup-item-page` follows a dedicated item URL under `/tra-cuu/tuong/<slug>/`.

## How to get to it (user POV)

- Choose `Tra cứu` in the floating quick nav.
- Open `/tra-cuu/` then a group card (`Tướng`, `Chiến pháp`, …).
- Open a group URL directly (`/tra-cuu/tuong/`).
- From a Đội chuẩn detail, follow a tướng / chiến pháp link into Tra cứu.

## Driving it with control-tqccl

Preconditions:

- The verification preview is healthy at `http://127.0.0.1:4175`.
- `control-tqccl doctor` reports that URL and the launch git revision.

- **Open hub.** Go to `/tra-cuu/`. Run `control-tqccl browser goto --path /tra-cuu/`. Do **not** wait `--boot`. The heading is `Tra cứu`. Seven `a.lookup-hub-card` links are visible. `GET` of this page has no `script[src="/js/app.js"]` in the HTML.
- **Enter Tướng.** Choose the `Tướng` card. Run `control-tqccl browser click --css "a.lookup-hub-card[data-group='heroes']"`. The URL is `/tra-cuu/tuong/`.
- **Boot the group page.** Run `control-tqccl browser wait --boot`. `body` has `data-lookup-group=heroes` and `data-boot=ready`. The heading is `Tướng`. The chip `Tướng` has `aria-current=page`.
- **Search không-dấu.** Type `luu bi`. Run `control-tqccl browser fill --role searchbox --name "Tìm tướng" --value "luu bi"`. The first `.lookup-card` contains `Lưu Bị` and its `.lookup-card-name` has no chữ Hán.
- **Open profile.** Choose the first result control. Run `control-tqccl browser click --css "#section-lookup [data-lookup-id]" --nth 0`. A `dialog` is visible, the URL contains `id=hero%3A` (or `id=hero:`), and the dialog text includes `Lưu Bị`.
- **Close profile.** Press Escape. Run `control-tqccl browser press --key Escape`. No `dialog` remains. The URL no longer has `id=`.
- **Dedicated item page.** Open a known tướng page from the same search result's native link if shown, or go to the path printed on the card. After search, run `control-tqccl browser click --role link --name "Lưu Bị" --nth 0` if that link's href is under `/tra-cuu/tuong/` and not `?id=`. The item page heading is `Lưu Bị` (or the published display name) and `#section-lookup` is not the group grid. If the card only opens the dialog, treat `lookup-item-page` as a second entry: run `control-tqccl browser goto --path /tra-cuu/tuong/luu-bi/` only when doctor-time HTML or the dialog's "trang riêng" link exposes that slug — do not invent a slug.
- **Proof.** Capture the populated search. After `luu bi` and before Escape, run `control-tqccl browser screenshot --path tra-cuu/luu-bi-dialog.png --feature tra-cuu --entry profile` and `control-tqccl browser snapshot --aria --path tra-cuu/luu-bi-dialog.aria.yml --feature tra-cuu --entry profile`. Artifacts show `Tướng`, `Lưu Bị`, and the open dialog.

## Gotchas

- `/tra-cuu/` never sets `data-boot`. Waiting for boot on the hub hangs.
- The search accessible name on the Tướng page is `Tìm tướng`, not `Tìm Đội chuẩn` and not a generic `searchbox` with no name when other searchboxes exist.
- Results update as you type; wait for the first card (or `.lookup-feedback` containing `Không có kết quả`) instead of a sleep.
- A query of `zzzqqq` is the empty-state proof, not a profile proof.
- Chiến pháp uses a table of name buttons, not `.lookup-card`. Do not reuse the Tướng CSS on `/tra-cuu/chien-phap/`.
- Slugs are frozen in `pipeline/lookup-route-handles.json`. Guessing `/tra-cuu/tuong/luu-bi/` without reading the handle (or the card href) is not a valid entry point; report it unreachable if the href is missing.
