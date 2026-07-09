# Brainstorm: Goi y 5 team tu kho

Ngay: 2026-07-10

## Problem

User muon chup kho tuong + kho chien phap + team dang build, roi app tu de xuat 5 team nen build cho tai khoan do.

Muc tieu khong phai "AI tu nghi team". Muc tieu dung la:

- AI chi doc anh thanh du lieu co cau truc.
- Engine local chon team theo data da curate trong repo.
- Ket qua tranh sai logic chien phap va tranh goi ten meta sai khi thieu tuong loi.

## Codebase context

- Project la static site vanilla JS.
- Da co `Soi doi tu anh`: `js/analyze.js`, `js/analyze-map.js`, Worker Qwen/DashScope.
- Du lieu team co san: `data/teams.json`, `data/team-tier.json`, `data/coexist.json`.
- Tu dien co san: `data/heroes-dict.json`, `data/tactics.json`, `data/books-dict.json`.
- Chua co engine `owned heroes + owned tactics + locked teams -> 5 teams`.

## Input

User upload 3 nhom anh:

1. Danh sach tuong
   - Doc ten tuong.
   - Doc level/hot/do neu thay ro.
   - Trang thai dang trong doi/bo nhiem/uy nhiem chi la metadata phu.

2. Danh sach chien phap
   - Chi can doc ten chien phap user so huu.
   - Khong can doc `0/1`, `1/1`, loai hinh, phat dong, mo ta, co the thiet lap.
   - Loai hinh va co che lay tu `data/tactics.json`.

3. Team user da build
   - Doc tuong + chien phap dang gan.
   - Tao `lockedHeroes`, `lockedTactics`.
   - Day la nguon de check trung chien phap.

## Output

Khong hien danh sach dai. Ket qua chinh la:

```text
5 team nen build
```

Neu user da scan team dang build, nhung team do duoc coi la team da ton tai; app se goi y cac team tiep theo. Mac dinh khong pha team user dang dung.

Moi team hien:

- Ten team / nickname.
- Tier.
- Trang thai.
- Ly do chon.
- Thieu/trung chien phap neu co.
- Tuong/chien phap dang khoa neu lien quan.

## Recommendation modes

Chi can 2 option chinh:

```text
Uu tien:
[Meta T0 -> T1] [Nhieu hot]
```

Mac dinh: `Meta T0 -> T1`.

`Meta T0 -> T1`:

- Tier la trong so lon nhat.
- Sau do moi den do/hot/level.

`Nhieu hot`:

- Tang trong so cho tuong do/hot/level cao.
- Khong duoc vuot qua hard rule ve thieu tuong loi.

Optional filter phu:

```text
☐ Chi hien doi build ngay
```

Khong dung ten `Khong trung chien phap` vi de hieu nham thanh mode build.

## Full-box users

Co nhom user gan nhu day du tuong va chien phap. Voi nhom nay, bai toan khong phai "co build duoc khong", ma la:

```text
chon 5 team cung ton manh nhat
```

Rule:

- Uu tien tier tu `T0` xuong `T0.5`, `T1`, `T1.5`, nhung khong chia quota/slot theo tier.
- Toi uu tong bo 5 team. Co the chon nhieu team T0 neu khong conflict, va co the bo mot team T0 neu no lam tong 5 team yeu hon.
- Khong trung tuong.
- Khong trung chien phap.
- Uu tien tuong nhieu hot/do/level cao.
- Neu co data chien bao/meta da curate, dung lam bonus phu.

UI khong can hien mode full-box ngay tu dau. Nen auto-detect:

- user co nhieu tuong key,
- user co hau het chien phap key,
- it thieu trong tap T0/T0.5.

Khi do hien goi y:

```text
Tai khoan gan full box. Dung che do Full box T0?
[Chon 5 team cung ton manh nhat]
```

Neu user chon, engine chay mode rieng:

```text
fullBoxT0Coexist
```

Output:

```text
5 team cung ton manh nhat cho tai khoan full box
```

Khac voi user thuong, full-box mode co the can data curated:

```text
data/coexist-sets.json
```

De luu cac bo 5 team da duoc chon tay theo mua/kich ban, vi thuat toan thuan score co the chon to hop dung ve conflict nhung kem meta thuc chien.

## Relation with tab `Cung Ton`

Tab `Cung Ton` hien tai la catalog/preset meta chung. No khong biet user co tuong/chien phap nao.

Feature moi `Goi y doi tu kho` la personalization layer:

```text
scan account -> ownedHeroes/ownedTactics/lockedTeams
-> thu match preset Cung Ton curated truoc
-> neu khong fit, engine ghep tu teams.json
-> output 5 team ca nhan hoa
```

Khong nen maintain hai nguon su that.

Huong data dai han:

- `data/teams.json`: chi tiet tung team rieng le.
- `data/coexist-sets.json`: cac bo 5 team cung ton curated, reference `teamId`.
- Tab `Cung Ton`: render tu `coexist-sets.json` + `teams.json`.
- `Goi y doi tu kho`: dung `teams.json` + `coexist-sets.json` + scan result.

MVP co the dung `data/coexist.json` hien tai nhu seed/reference. Sau do migrate/normalize thanh `coexist-sets.json`.

## Team status

Team chinh trong output chi nen gom:

- `Build ngay`: du tuong, du chien phap, khong trung voi team da khoa.
- `Can chuyen chien phap`: du tuong, co chien phap, nhung chien phap dang bi team khac khoa.
- `Build bien the`: du tuong, thieu chien phap chinh nhung co alternative hop le trong data.

Khong dua team thieu tuong vao 5 team nen build.

`Thieu tuong` chi nam o phan phu:

```text
Team manh nhung chua build duoc
```

## Hard rules

1. Thieu tuong loi thi khong duoc goi la team meta do.
   - Vi du thieu `Hua Du` thi khong duoc goi la `Hoang Ma Thuong`.
   - Chi duoc thay tuong neu `data/teams.json` co alternative ro rang hoac co record team rieng da curate.

2. Team 1 neu user chua co team nao thi khong co khai niem trung chien phap.
   - Team 1 chi co `Build ngay`, `Thieu chien phap`, `Thieu tuong`.
   - Team 2 tro di moi co trung chien phap vi team truoc da khoa do.

3. Neu user da scan team dang build, cac team do tao khoa ngay tu dau.
   - Team de xuat tiep theo phai check trung voi `lockedHeroes`, `lockedTactics`.

4. Chien phap thieu co the thay the.
   - Chi thay bang alternatives trong data hoac rule curate.
   - Phai hien `Build bien the`, khong goi ngang ban meta goc.

5. AI khong duoc tu quyet team.
   - AI chi doc anh.
   - Engine local deterministic chon team.

6. Logic chien phap phai sanity-check.
   - Khong gan `Ho Bao Ky` cho team chu dong/muu luoc.
   - `Doc Suc Tinh Ke` phai di voi active khac cung nguoi cam.
   - `Phi Hung Quan` can nguon hoi thuc.
   - Khong coi skill chuan bi 1 hiep lap lai la no ngay.
   - Khong gan `Binh Vo Thuong The` cho tuong khong danh thuong du nhieu.

## Scoring

Can tach hai bai toan:

### Case A: user chua co team

1. Chon team chu luc manh nhat:
   - tier cao
   - du tuong
   - du chien phap
   - nhieu hot/level

2. Khoa tuong + chien phap cua team 1.

3. Chon team 2-5 theo cung ton:
   - khong trung tuong
   - khong trung chien phap
   - uu tien tier/hot

### Case B: user da co team

1. Scan team da build -> lock truoc.
2. Goi y cac team tiep theo.
3. Mac dinh giu team hien co, khong toi uu lai toan bo tai khoan.

### Case C: user full box

1. Lay candidate theo tier uu tien tu T0 xuong cac tier thap hon, khong quota theo tier.
2. Uu tien preset trong `data/coexist-sets.json` neu co.
3. Neu khong co preset, chay search/backtracking tren top candidate de toi uu bo 5 team.
4. Score theo tong tier + khong trung + hot/do/level.
5. Giai thich team T0 nao bi loai vi trung tuong/chien phap hoac lam tong 5 team yeu hon.

## Suggested modules

- `js/roster-scan-map.js`
  - Map output Vision sang ten Viet canonical.

- `js/team-recommend-engine.js`
  - Pure deterministic engine.
  - Input: `ownedHeroes`, `ownedTactics`, `lockedTeams`, `mode`.
  - Output: `recommendedTeams`, `blockedStrongTeams`, diagnostics.

- `js/roster-recommend-ui.js`
  - Tab UI upload anh + ket qua.

- Worker:
  - Them endpoint hoac mode doc anh moi:
    - `rosterHeroes`
    - `ownedTactics`
    - `builtTeams`

- Tests:
  - `tests-js/team-recommend-engine.test.mjs`
  - Test missing core hero, tactic conflict, team 1 no conflict, locked teams, mode meta vs hot.

## Phases

### Phase 1: Data extraction MVP

- Scan anh tuong -> ownedHeroes.
- Scan anh chien phap -> ownedTactics.
- Scan anh team da build -> lockedTeams.
- UI cho user sua ket qua doc sai.

### Phase 2: Recommendation engine

- Chon 5 team.
- Tach case user chua co team / da co team.
- Phan loai `Build ngay`, `Can chuyen chien phap`, `Build bien the`.
- User full-box: search/backtracking gioi han tren top candidate, khong sort top 5 doc lap.

### Phase 3: UX and explanation

- Hien ly do chon.
- Hien team manh nhung thieu tuong o phan phu.
- Export/import ket qua scan.

### Phase 4: Battle-report data, later

- Chua can cho MVP.
- Sau nay them `battle-report-data.json` de tang evidence bonus va giai thich chien bao.

### Phase 5: Full-box coexist presets

- Them `data/coexist-sets.json`.
- Curate cac bo 5 team cung ton theo mua/kich ban.
- Dung cho user day du tuong/chien phap muon xep doi hinh manh nhat.
- Phase sau MVP, nhung schema/engine nen chua slot `presetId`, `presetReason`, `coexistSetBonus` tu dau.

## Final recommendation

Lam feature `Goi y 5 team tu kho` theo huong:

- tab moi `Goi y doi tu kho`,
- input 3 loai anh,
- Worker dung endpoint hien co voi `mode`, khong can endpoint moi luc dau,
- AI chi doc anh,
- engine local chon team,
- mac dinh giu team user da build,
- output 5 team nen build,
- thieu tuong loi thi loai khoi recommend chinh,
- thieu chien phap thi cho build bien the neu co alternative hop le.
- neu user full box, goi y mode `Full box T0 coexist` de chon bo 5 team cung ton manh nhat theo tier tu T0 xuong, khong chia slot T0/T1, uu tien nhieu hot khi tier/logic ngang nhau.
- `Cung Ton` la catalog/preset chung; `Goi y doi tu kho` la ca nhan hoa theo account.

## Resolved decisions

- Full-box search lam trong MVP nhung gioi han top N candidate.
- Worker dung endpoint hien co voi `mode`.
- UI tao tab moi `Goi y doi tu kho`.
- `data/coexist-sets.json` de phase sau, nhung chua contract tu dau.

## Open questions

None.
