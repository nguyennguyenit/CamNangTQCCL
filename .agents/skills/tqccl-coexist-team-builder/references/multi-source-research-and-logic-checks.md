# Multi-Source Research And Logic Checks

Use this reference when a recommendation needs evidence beyond project data, especially battle reports, cross-server meta, or tactic mechanics.

## Source And Language Coverage

Search multiple markets when the answer depends on current meta or battle reports:

- Chinese mainland: `三国志战略版`
- Traditional Chinese/Taiwan/HK: `三國志戰略版`
- Japanese: `三國志 真戦`
- Korean: `삼국지 전략판`
- English/global communities: `Three Kingdoms Tactics`, `Sangokushi Tactics`, exact hero/tactic names if known
- Vietnamese: in-game Vietnamese names, local community names, and the CamNangTQCCL project data

Prefer official patch notes, large strategy sites, battle-report articles, season tier lists, and repeated player reports. Treat isolated screenshots or single forum comments as weak evidence.

## Query Pattern

For team research, combine:

- exact hero names in the source language,
- exact tactic names in the source language,
- keywords for battle reports or coexist:
  - CN: `战报`, `共存`, `阵容`, `搭配`, `赛季`, `白板`
  - JP: `戦報`, `共存`, `編成`, `テンプレ`
  - KR: `전보`, `공존`, `덱`, `조합`
  - EN: `battle report`, `coexist`, `lineup`, `build`

When possible, check at least two languages or regions before calling a team "proven". If only one region has evidence, say so.

## Evidence Grading

- Strong: multiple battle reports plus build details plus season context.
- Medium: one detailed article or repeated community consensus with exact tactics.
- Weak: image-only post, comment-only claim, or build without results.
- Project-local: valid for this repo, but still check mechanics before recommending.

Do not claim "có chiến báo chứng minh" unless at least one source clearly includes battle reports or explicit battle-record discussion. If images are inaccessible or image-only, say the source claims/provides battle reports but details are not text-verifiable.

## Logic Sanity Checklist

Before finalizing any team, reject or flag these mismatches:

- Assault/basic-attack support on active-magic teams.
  - Example: `Hổ Báo Kỵ` supports assault/basic-attack tempo; do not recommend it as support for a chủ động/mưu lược Phi Hùng team.
- Active-rate boosters paired with non-active tactics.
  - Example: `Dốc Sức Tính Kế` must be paired with another non-self active tactic on the same holder; not `Tạm Lánh`, formations, troop tactics, passives, or command-only setups.
- Preparation tactics on repeat-active engines when reliability is the goal.
  - Repeating a 1-turn preparation tactic does not make it instant.
- Healing-dependent tactics without active healing.
  - Example: `Phi Hùng Quân` wants real healing sources; pure damage/status skills do not feed its healing-value plan.
- Main-commander-scaling tactics on the wrong commander.
  - If a tactic's damage or buff follows the chủ tướng, put the intended damage/core general as chủ tướng.
- Self-control risk ignored.
  - Example: `Giả Hủ` can disrupt allies with Hỗn Loạn; mention this risk when pairing with SP Quách Gia active damage.
- Basic-attack proc tactics on generals that do not basic attack enough.
  - Example: `Binh Vô Thường Thế` is weak on a general that is not expected to attack repeatedly.
- Formation/troop mismatch.
  - Do not recommend a troop tactic that does not match the chosen troop type or a formation that undermines the team's damage distribution.

## Final Research Statement

When answering with researched evidence, include:

- region/source names,
- whether evidence is battle reports, tier list, or mechanics article,
- exact build from source if it differs from the user's coexist build,
- what was changed for no-overlap coexist and what that costs.
