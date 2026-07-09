# Red-Team Addendum: Goi y 5 team tu kho

Ngay: 2026-07-10

## Summary

Brainstorm da chot dung huong, nhung con 6 rui ro production can chan truoc plan.

Rui ro lon nhat: nham `data/coexist.json` hien tai la engine-ready. File nay phu hop render tab `Cung Ton`, nhung chua phai normalized data de may chon team.

## Findings

### 1. `coexist.json` hien tai khong nen dung thang cho engine

Du lieu co slash, ghi chu, ten team/tuong/chien phap dang display-oriented:

- `Gio Tap Mua Sa/Van Vo Song Toan`
- `Thai Binh Dao Phap/Thieu Dot Doanh Luy`
- `Chu Du (Thuong S)`
- `Tri LucToc 1`

Neu engine parse chuoi nay truc tiep, se sinh loi conflict/missing tactic.

Recommendation:

- MVP engine lay team tu `teams.json` la nguon chuan.
- `coexist.json` chi dung lam reference UI/catalog.
- Neu muon dung preset Cung Ton trong engine, phai co adapter normalize sang:
  - `teamId`
  - `heroIds`
  - `tacticSlots[{primary, alternatives}]`
  - `sourcePresetId`

Kill gate:

- Khong cho engine doc slash string bang split tuy tien.

### 2. `coexist-sets.json` de phase sau duoc, nhung contract phai ro ngay

Neu khong dinh nghia contract tu dau, phase sau se phai refactor engine output.

Minimum contract can co trong MVP output:

- `presetId: null | string`
- `presetReason: string`
- `coexistSetBonus: number`
- `source: "team" | "preset" | "search"`

Chua can data file, nhung can slot de sau gan preset khong pha UI.

### 3. "5 team nen build" can ro la 5 total hay 5 team moi

Neu user scan 4 team da build, output "5 team nen build" de gay hieu nham:

- La tong portfolio 5 team gom 4 team cu + 1 team moi?
- Hay la 5 team moi ngoai 4 team cu?

Recommendation:

- Default `keepExistingTeams`: output la **portfolio 5 team tong**, gom team da build + team de xuat them.
- Hien label:
  - `Dang giu: 4 team`
  - `Nen them: 1 team`
  - `Portfolio sau khi build: 5 team`
- Mode `optimizeFromScratch`: output 5 team moi tu dau, co canh bao se phai doi chien phap.

### 4. Full-box top N co the miss optimal neu loc sai

Search tren top N candidate la can thiet, nhung top N loc theo tier thuan co the miss team T1 cuc hop account nhieu hot va it conflict.

Recommendation:

- Candidate pool full-box khong chi la top tier.
- Lay:
  - all T0/T0.5,
  - top T1 theo faction/role diversity,
  - cac team dung tuong nhieu hot cua user,
  - preset-related teams.
- Ghi diagnostics: `searchedCandidates`, `prunedCandidates`, `pruneReason`.

### 5. Endpoint `mode` reuse tot, nhung prompt/schema phai tach hard

Them `mode` vao endpoint hien co dung, nhung neu worker dung chung prompt/schema se regression `Soi doi tu anh`.

Recommendation:

- Switch hard theo mode:
  - `analyzeTeamImage`
  - `scanHeroes`
  - `scanTactics`
  - `scanBuiltTeams`
- Moi mode co schema rieng.
- Existing `Soi doi tu anh` test snapshot khong duoc doi output.

### 6. UX review step can batch-edit, khong chi hien ket qua

Neu user phai sua tung item qua modal nho, feature se bi bo.

Recommendation:

- Sau scan hien 3 bang compact:
  - Tuong so huu
  - Chien phap so huu
  - Team dang khoa
- Cho remove nhanh item sai.
- Cho search-add nhanh item thieu tu dictionary local.
- Luu localStorage scan result de khong scan lai.

## Final Red-Team Recommendation

Truoc khi sang plan, them cac invariant vao acceptance criteria:

1. Engine source chuan la normalized data, khong parse chuoi display trong `coexist.json`.
2. Output voi built teams la portfolio 5 team tong, khong phai 5 team moi.
3. Worker mode tach schema/prompt, khong regression `Soi doi tu anh`.
4. Full-box search co diagnostics ve candidate/pruning.
5. Review step cho user sua nhanh scan result.
6. `coexist-sets.json` phase sau, nhung MVP output contract chua slot preset.

## Unresolved Questions

None.
