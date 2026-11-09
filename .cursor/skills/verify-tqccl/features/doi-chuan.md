# Đội chuẩn

Đội chuẩn is the recommended-team browser: a visitor searches and filters the current season's published configs, switches Thẻ / Thẻ gọn / Bảng, and opens a static detail page for one team without an account.

## Sub-features

- `chuan-open` opens the list at `/doi-chuan/` with cards of the default season already in the page.
- `chuan-search` filters the list from the `Tìm Đội chuẩn` searchbox and reflects `?q=` in the URL.
- `chuan-view` switches to Thẻ gọn and Bảng.
- `chuan-detail` follows `Chi tiết` on a card into `/doi-chuan/<mùa>-<handle>/`.
- `chuan-nav` reaches the list from the inner-page quick nav labelled `Đội chuẩn`.

## How to get to it (user POV)

- Choose `Mở Đội chuẩn` on Landing.
- Choose the `Đội chuẩn` tile on Landing.
- Choose `Đội chuẩn` in the floating quick nav on any inner page (desktop).
- Open `/doi-chuan/` directly.
- From a Tra cứu hồ sơ, choose `Tìm tướng này trong Đội chuẩn` (deep link; not required for the baseline recipe).

## Driving it with control-tqccl

Preconditions:

- The verification preview is healthy at `http://127.0.0.1:4175`.
- `control-tqccl doctor` reports that URL and the launch git revision.
- Viewport is the harness default 1280×800 so `.quick-nav` is used rather than the mobile menu.

- **Open list.** Go to `/doi-chuan/`. Run `control-tqccl browser goto --path /doi-chuan/` and `control-tqccl browser wait --boot`. `body` has `data-boot=ready` and `data-page-section=team-chuan`. The heading is `Đội chuẩn`. At least one `.reference-team-card` is visible inside `#section-team-chuan`.
- **Quick-nav current page.** Run `control-tqccl browser text --css ".quick-nav a[aria-current='page']"`. The accessible name is `Đội chuẩn`.
- **Search.** Type `Lưu Bị` in the list search. Run `control-tqccl browser fill --role searchbox --name "Tìm Đội chuẩn" --value "Lưu Bị"`. The URL contains `q=` (encoding of the query). Either at least one card remains whose text includes `Lưu Bị`, or the empty status `Không có đội khớp bộ lọc.` is visible — both are success of search applying; a non-empty match is required to continue into `chuan-detail` from this query.
- **Clear to the default list.** Reload the bare list. Run `control-tqccl browser goto --path /doi-chuan/` and `control-tqccl browser wait --boot`. Cards of the default season are visible again.
- **View Thẻ gọn.** Choose `Xem dạng thẻ gọn`. Run `control-tqccl browser click --role button --name "Xem dạng thẻ gọn"`. The URL contains `view=luoi` and `aria-pressed` is true on that button.
- **View Bảng.** Choose `Xem dạng bảng`. Run `control-tqccl browser click --role button --name "Xem dạng bảng"`. The URL contains `view=bang` and a table is visible inside `#section-team-chuan`.
- **Open detail.** Return to default cards, then choose the first `Chi tiết`. Run `control-tqccl browser goto --path /doi-chuan/`, `control-tqccl browser wait --boot`, and `control-tqccl browser click --role link --name "Chi tiết" --nth 0`. The URL matches `/doi-chuan/[^/]+/$`. `#team-detail-body` is visible and `h1#team-detail-title` is non-empty.
- **Proof.** On the detail page run `control-tqccl browser screenshot --path doi-chuan/detail.png --feature doi-chuan --entry detail` and `control-tqccl browser snapshot --aria --path doi-chuan/detail.aria.yml --feature doi-chuan --entry detail`. Artifacts show the Cẩm Nang header, the team `h1`, and `#team-detail-body` content (tướng / chiến pháp). On the list, also capture `doi-chuan/list.png` and `doi-chuan/list.aria.yml` with `--entry list` after `--boot` so cards are visible.

## Gotchas

- Cards exist in the SSR HTML before boot; do not click `Chi tiết` until `data-boot=ready` or the client may fight the prerender.
- `Chi tiết` matches every card. `--nth 0` is the first visible card, not a named team. Assert the resulting `h1`, not a hard-coded handle — handles are frozen in `pipeline/team-route-handles.json` and differ by generation.
- `Lưu Bị` may be absent from the default season. Empty-state text `Không có đội khớp bộ lọc.` proves search; it does **not** prove `chuan-detail`. Open detail from the unfiltered list instead, and report the search-miss in the run notes.
- Season `<select aria-label="Mùa">` rewrites `?season=` and rebuilds the list. Do not leave a non-default season selected when proving the default detail path.
- Mobile (`<1280px`) hides `.quick-nav`; use `#section-menu-toggle` (`aria-label` `Mở menu trang`) instead. This recipe is desktop.
- `#team-detail-body` is the detail marker. `#section-team-chuan` is the list. A 404-looking "Không có cấu hình này" on a bogus `?config=` is not a successful detail open.
- Detail pages mount a comments/community frame. With this launch (no `/api/*`) a status `Tính năng cộng đồng tạm thời không khả dụng` is expected and is **not** a Đội chuẩn failure. Do not treat it as proof of comments.
