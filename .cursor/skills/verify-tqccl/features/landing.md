# Landing

Landing is the public home page: it tells a visitor what the handbook holds, shows counts baked at build time, and sends them into Đội chuẩn (or Gợi ý đội từ kho) without requiring an account or JavaScript.

## Sub-features

- `landing-identity` shows the Cẩm Nang brand, kicker, and the heading asking which team to play this season.
- `landing-stats` shows the five build-time figures (Đội chuẩn configs, T0, seasons, heroes, tactics).
- `landing-cta-standard` follows the primary button into Đội chuẩn.
- `landing-cta-roster` follows the secondary button into Gợi ý đội từ kho.
- `landing-tiles` follows the Đội chuẩn tile in the section grid.

## How to get to it (user POV)

- Open `/` (or the site origin with an empty path).
- From any inner page, choose the Cẩm Nang brand lockup in the header (the logo is not a link on Landing itself).
- Open a legacy hash such as `/#team-pk` only as a redirect off Landing, not as a Landing proof.

## Driving it with control-tqccl

Preconditions:

- The verification preview is healthy at `http://127.0.0.1:4175`.
- `control-tqccl doctor` reports that URL and the launch git revision.
- Do not wait `--boot` on this page.

- **Open home.** Go to `/`. Run `control-tqccl browser goto --path /`. The document title contains `Cẩm Nang Game Tam Quốc Chí` and the heading is `Mùa này chơi đội nào?`.
- **Read identity.** Confirm the kicker and lead. Run `control-tqccl browser text --css ".landing-hero-kicker"` and `control-tqccl browser text --css ".landing-lead"`. The kicker contains `Cẩm nang cộng đồng` and `Tam Quốc Chí Chiến Lược`. The lead mentions cấu hình đội, tướng, and chiến pháp, and does not mention `SGSDeck`.
- **Read stats.** Run `control-tqccl browser text --css ".landing-stat-number" --nth 0`. The text is non-empty digits (thousands may use `.`).
- **Primary CTA.** Choose `Mở Đội chuẩn`. Run `control-tqccl browser click --role link --name "Mở Đội chuẩn"`. The URL is `/doi-chuan/` (optional default-season query is allowed). The heading `Đội chuẩn` is visible.
- **Return and secondary CTA.** Go home again, then choose `Gợi ý đội từ kho`. Run `control-tqccl browser goto --path /` and `control-tqccl browser click --role link --name "Gợi ý đội từ kho" --nth 0`. The URL is `/goi-y-doi-tu-kho/`.
- **Section tile.** Go home and choose the Đội chuẩn tile. Run `control-tqccl browser goto --path /` and `control-tqccl browser click --css "a.landing-tile[href='/doi-chuan/']"`. Same Đội chuẩn URL as the primary CTA.
- **Proof.** Capture Landing before leaving. Run `control-tqccl browser goto --path /`, `control-tqccl browser screenshot --path landing/home.png --feature landing --entry home`, and `control-tqccl browser snapshot --aria --path landing/home.aria.yml --feature landing --entry home`. Both artifacts show `Cẩm Nang` and `Mở Đội chuẩn`.

## Gotchas

- Landing does not set `data-boot`. `wait --boot` times out here.
- Several links share the name `Gợi ý đội từ kho` (hero ghost button and a tile). Use `--nth 0` for the hero button or the tile CSS href.
- The brand lockup on Landing is a `div.brand`, not a home link.
- Stats are baked at `npm run build`. A `--reuse-dist` launch after a data change is not proof of the new numbers.
- Hash aliases (`/#team-pk`) immediately replace the URL with `/doi-khac/`. That is Đội khác, not Landing.
