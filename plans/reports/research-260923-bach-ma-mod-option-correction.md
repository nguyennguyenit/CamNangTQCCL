# Tinh·Bạch Mã Nghĩa Tòng option-name correction

- Research date: 2026-09-23 (Asia/Saigon)
- Topic: Verify the four modification choices on the Binh Diễn Xuân Thu Lữ Quách Kiều source team.
- Scope: User-selected Binh Diễn Xuân Thu; server, live patch and user's modification unlocks unknown.

## Prior statement and inspected evidence

The [account season correction](research-260923-sanshi-lv-season-correction.md) cited the [SGSDeck Lữ Quách Kiều page](https://sgsdeck.com/recommended/og-bingyan-lvguoqiao-baima) as requiring Tinh·Bạch Mã Nghĩa Tòng. The team's saved note lists `【飛馳】【習武】【靈光】【久戰】` and says `久戰` removes the early-round limit of First Strike and the active-tactic activation increase.

The project's [SGSDeck troop modification snapshot](../../data/sgsdeck/troop-mods.json) for `白馬義從`, scoped to `兵演春秋`, lists exactly one corresponding choice in each tier:

| Tier | Available Chinese choice in Bạch Mã | Reviewed project Vietnamese name | Recorded effect |
| --- | --- | --- | --- |
| Special | `疾馳` | Phi Nhanh | Activation-rate increase scales with Speed |
| Basic | `習武` | Tập võ | All allies gain 14 Force |
| Intermediate | `靈光` | Linh Quang | Active tactic activation rate +3% |
| Advanced | `久戰` | Cửu chiến | Remove the round limit; reduce the activation-rate increase by 7% |

The Vietnamese option names and descriptions come from [lookup-catalog.json](../../data/lookup-catalog.json). The Bạch Mã source effect gives all allies First Strike and 5%–10% active tactic activation for the first two turns. The `久戰` team's note says its time-limit removal applies to both. The 7% reduction should not be silently interpreted as a verified final net percentage, because stacking/rounding on the user's current server was not observed.

`飛馳` is **not** an option listed under Bạch Mã in the same troop-mod snapshot. It is listed under `西涼鐵騎` (Tây Lương Thiết Kỵ), with a different effect. Thus the team page and modification catalog disagree on the first option. The actionable instruction is to choose the Bạch Mã special-tier option whose effect says activation increase depends on Speed, `疾馳` / project Vietnamese `Phi Nhanh`, then the other three named options. Treat the team's `飛馳` as a probable source typo, not as a verified alternate Bạch Mã choice.

## Status and budget

| Claim | Status | Basis |
| --- | --- | --- |
| Team note contains `飛馳`; Bạch Mã catalog contains `疾馳` and no `飛馳` | Đã đối chiếu | Published local SGSDeck team and troop-mod records |
| Four recommended choices and their recorded effects | Phương án từ nguồn | SGSDeck troop-mod snapshot plus project Vietnamese lookup |
| Exact current Global UI spelling, unlock and combat stacking | Chưa xác minh | User game screen and independent live mechanic test not provided |

Shared account/team research topic external-call ledger: default limit 5, previously used 7, this follow-up used 0, remaining 0. No external page was opened and no product data was changed.
