# Theo dõi chiêu mộ

Theo dõi chiêu mộ lets a guest count daily cheap pulls toward the 5★ pity on the default account, entirely in this browser. Sign-in is optional and is **not** part of this recipe.

## Sub-features

- `recruit-onboard` starts tracking from a pity count the player types (or from 0).
- `recruit-log-free` records the `2 miễn phí` miss shortcut and advances today's meter.
- `recruit-undo` restores the previous count from the Hoàn tác toast.
- `recruit-persist` still shows the count after a reload (localStorage, no account).

## How to get to it (user POV)

- Choose `Theo dõi chiêu mộ` in the floating quick nav (Beta group).
- Choose the matching tile on Landing.
- Open `/theo-doi-chieu-mo/` directly.

## Driving it with control-tqccl

Preconditions:

- The verification preview is healthy at `http://127.0.0.1:4175`.
- `control-tqccl doctor` reports that URL and the launch git revision.
- This run's Playwright profile has **no** `tqcclRecruitTracker` key yet (fresh launch, or a new `--run-id`).
- The guest path must work with `/api/*` absent. A chip offering `Đăng nhập` is expected; clicking it is out of scope.

- **Open tool.** Go to `/theo-doi-chieu-mo/`. Run `control-tqccl browser goto --path /theo-doi-chieu-mo/` and `control-tqccl browser wait --boot`. The heading is `Theo dõi chiêu mộ`. A notice says data is only in this browser. The onboard heading `Bắt đầu theo dõi` is visible.
- **Start from 0.** Choose `Bắt đầu từ 0`. Run `control-tqccl browser click --role button --name "Bắt đầu từ 0"`. Onboard is gone. A meter for bảo hiểm 5★ shows `0` / `30` lượt (or `aria-valuenow` `0` and `aria-valuemax` `30`). `Hôm nay 0/4` is visible.
- **Log two cheap misses.** Choose `2 miễn phí`. Run `control-tqccl browser click --role button --name "2 miễn phí (ghi 2 lượt không ra)"`. The daily meter / `Hôm nay` text becomes `2/4`. Pity `aria-valuenow` is `2`. A status toast includes `Hoàn tác`.
- **Undo.** Choose `Hoàn tác` on the toast. Run `control-tqccl browser click --role button --name "Hoàn tác"`. `Hôm nay` returns to `0/4` and pity `aria-valuenow` is `0`.
- **Log again and persist.** Repeat the `2 miễn phí` click. Run `control-tqccl browser click --role button --name "2 miễn phí (ghi 2 lượt không ra)"`. Then reload. Run `control-tqccl browser goto --path /theo-doi-chieu-mo/` and `control-tqccl browser wait --boot`. Onboard stays hidden. `Hôm nay 2/4` and pity `2` are still shown.
- **Proof.** After the persisted reload, run `control-tqccl browser screenshot --path chieu-mo/after-reload.png --feature theo-doi-chieu-mo --entry persist` and `control-tqccl browser snapshot --aria --path chieu-mo/after-reload.aria.yml --feature theo-doi-chieu-mo --entry persist`. Capture once **before** undo (`chieu-mo/after-log.png`) so the action is evidenced, not only the restored state. Artifacts show `Theo dõi chiêu mộ` and `Hôm nay 2/4`.

## Gotchas

- The `2 miễn phí` accessible name includes the parenthetical `(ghi 2 lượt không ra)` until today is full. Matching only `2 miễn phí` without `--loose` fails.
- After four cheap pulls the same button's name becomes `(hôm nay đã đủ 4 lượt)` and it is disabled. A leftover profile from a previous recipe will skip `recruit-log-free` — use a fresh run id.
- `Bắt đầu` (submit) requires a number in `Trong game bạn đang ở lượt mấy?`. Prefer `Bắt đầu từ 0` for the baseline.
- Native `alert`/`confirm` must not appear. If a dialog opens, the tool has regressed; fail the run.
- The cloud chip `Đăng nhập` must not be followed here. It needs Google + community-worker. Report that entry `verified-unreachable` on this launch.
- Do not `eval` a write into `tqcclRecruitTracker` to skip onboard. Reading it after the UI action is allowed as supporting evidence only.
