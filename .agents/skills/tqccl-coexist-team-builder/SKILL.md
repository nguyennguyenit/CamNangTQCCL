---
name: tqccl-coexist-team-builder
description: Build Tam Quốc Chí Chiến Lược coexist team recommendations for the CamNangTQCCL project. Use when the user asks to ghép team cùng tồn, build thêm team, chọn team không trùng chiến pháp, ưu tiên tướng nhiều hột/red copies, research chiến báo/meta đa nguồn Trung-Nhật-Hàn-Anh, or asks for team recommendations that must follow the project's prebuilt team data and tier order from T0 through T1.
---

# TQCCL Coexist Team Builder

## Workflow

1. Use the project data first, not memory.
   - Main teams: `data/teams.json`
   - Tier map: `data/team-tier.json`
   - Preset coexist groups: `data/coexist.json`
2. Prefer prebuilt teams with tiers in this order: `T0`, `T0.5`, `T1`.
3. Reject any candidate that duplicates a locked tactic unless the user explicitly allows moving that tactic.
4. Prefer higher-red or higher-copy generals only after tier and tactic-conflict constraints are satisfied.
5. Run a tactic-logic sanity check before recommending. Do not attach tactics to teams they do not support.
6. Explain tradeoffs plainly: team strength, missing tactics, overlap cost, and whether the result is main-team quality or only a fifth/sixth coexist team.

## Quick Data Check

From the project root, run:

```bash
python3 /Users/plateau/.agents/skills/tqccl-coexist-team-builder/scripts/list_candidate_teams.py --project .
```

Useful filters:

```bash
python3 /Users/plateau/.agents/skills/tqccl-coexist-team-builder/scripts/list_candidate_teams.py \
  --project . \
  --available-heroes "Tào Tháo,SP Quách Gia,CO Chân Cơ,Vương Dị,Giả Hủ" \
  --used-tactics "Đoạt Hồn Hiệp Phách,Đương Phong Thôi Quyết,Thuyền Cỏ Mượn Tên" \
  --max-tier T1 \
  --require-available \
  --no-conflicts \
  --limit 20
```

Read `references/coexist-team-rules.md` when the request involves multiple existing teams, red-copy prioritization, or a final recommendation.

Read `references/chat-context-team-notes.md` when the user refers to "team của mình", "4 team hiện tại", "như đã hỏi", "nội dung chat này", or asks about the same TQCCL account context from prior discussion.

Read `references/multi-source-research-and-logic-checks.md` when the user asks for research, chiến báo, meta proof, cross-server evidence, or when a build uses unfamiliar tactics/mechanics.

## Recommendation Rules

- Do not invent a team when a matching prebuilt T0-T1 team exists.
- If no exact prebuilt team fits the roster, propose the closest prebuilt team and state substitutions as weaker variants.
- Never recommend a duplicated tactic silently. Show the duplicated tactic and the team currently using it.
- If the user gives current teams from screenshots, extract locked tactics first, then run candidate filtering.
- If the user references prior chat context, load `references/chat-context-team-notes.md`, then verify against the newest screenshots or roster before answering.
- If recommending a build from web/meta research, search across Chinese, Japanese, Korean, English, and Vietnamese sources when useful; cite the sources and say which region/server each source reflects.
- Before finalizing, check tactic type compatibility: assault tactics need basic attacks, active tactics need activation support, troop/formation tactics must match the team's actual role, and healing-dependent tactics need real healing sources.
- If red-copy counts are known, prefer the line that uses the user's higher-red generals, but do not downgrade from T0/T0.5 to an unranked novelty unless the user asks for fun/off-meta.
- If two choices are close, pick the one with fewer premium tactic conflicts.

## Output Shape

Keep answers compact:

1. Chốt team recommend.
2. List build: tướng, chiến pháp, binh thư, điểm cộng/tốc.
3. Conflict table: duplicated tactics or missing tactics.
4. Why this over the alternatives.
5. Optional weaker variants.
