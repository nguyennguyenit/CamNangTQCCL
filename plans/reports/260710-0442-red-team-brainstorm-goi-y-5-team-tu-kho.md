# Red-Team Brainstorm: Goi y 5 team tu kho

Ngay: 2026-07-10

## Summary

Proposal `Goi y 5 team tu kho` dung huong, nhung rui ro lon nhat la output nghe nhu "auto build team chuan" trong khi input anh co the thieu/nhieu loi. MVP phai co guardrail manh: AI chi doc anh, user sua ket qua scan, engine deterministic chon team, va khong dua team thieu tuong loi vao 5 team chinh.

## Findings

### 1. Anh danh sach tuong khong du de ket luan "nhieu hot" chac chan

Red stars/hot o card nho de doc sai, bi che, hoac nham tien bac/thuc tinh. Neu scoring dua qua nhieu vao hot doc tu anh, team recommend co the sai.

Mitigation:

- Hot/level chi la bonus neu confidence cao.
- UI phai cho user sua hot/level sau scan.
- Mode `Nhieu hot` van phai hien "du lieu hot doc tu anh, can kiem tra".

### 2. Danh sach chien phap chi doc ten la dung, nhung anh co the khong day du

User co the chup mot trang chien phap, khong phai toan bo kho. Engine se tuong user thieu skill va ha team sai.

Mitigation:

- Cho upload nhieu anh chien phap.
- Hien so chien phap da doc va nut "them anh".
- Neu anh chien phap it bat thuong, can canh bao "co the chua scan het kho".

### 3. Team da build la nguon locked tactics, nhung co the user chua chup het team

Neu chi chup 1 doi dang dung, engine co the recommend trung chien phap voi doi khac user khong chup.

Mitigation:

- Sau scan hien "Da khoa X team / Y chien phap".
- Co input tay "them chien phap dang bi khoa".
- Ten nhom ket qua nen la "Build ngay theo du lieu da scan", khong phai "Build ngay 100%".

### 4. Chon 5 team la bai toan to hop, khong phai sort top 5

Neu sort tung team roi lay top 5, de trung tuong/chien phap hoac day team tot hon ra ngoai vi team truoc do an mat do.

Mitigation:

- Phase 1 co the greedy, nhung phai document la heuristic.
- Test case bat buoc: top 1 ca nhan lam tong 5 team te hon phuong an top 2.
- Neu can chinh xac hon, dung search/backtracking tren top N candidate.

### 5. Team 1 va team da build co logic khac nhau

Neu user chua co team, team 1 khong co "trung chien phap". Neu user da co team, recommend tiep theo phai check trung ngay. Nhap nhang case nay se tao output vo ly.

Mitigation:

- Engine phai co `mode: optimizeFromScratch | keepExistingTeams`.
- Mac dinh neu co anh team da build: `keepExistingTeams`.
- Chi toi uu lai 5 team tu dau khi user bam "toi uu lai toan bo".

### 6. Thieu tuong loi khong duoc coi la bien the

Day la loi product nghiem trong: thieu Hua Du ma van goi Hoang Ma Thuong lam mat niem tin.

Mitigation:

- Missing hero => status `Chua build duoc`, khong vao 5 team chinh.
- Chi thay tuong neu `data/teams.json` co alternative ro hoac co record team rieng.
- "Team manh nhung thieu tuong" la section phu.

### 7. Thieu chien phap co the thay, nhung replacement can curated rules

Neu tu dong thay skill theo "cung loai active/muu cong" se de sai logic, vi chien phap co vai tro rieng.

Mitigation:

- Ban dau chi dung alternatives co san trong team data.
- Sau do moi them `tactic-substitution-rules.json` duoc curate.
- Moi replacement phai hien "tran thap hon ban meta".

### 8. Vision prompt neu gom 3 loai anh vao 1 schema se kho on dinh

Danh sach tuong, chien phap, team da build co UI khac nhau. Mot prompt da nhiem co the doc nham cot, nham chien phap thanh binh thu.

Mitigation:

- Dung mode rieng:
  - `scanHeroes`
  - `scanTactics`
  - `scanBuiltTeams`
- Moi mode co schema va prompt rieng.
- Frontend bat user chon loai anh truoc khi upload.

### 9. Chi phi va quota Vision co the tang nhanh

Feature moi khuyen user upload nhieu anh. Neu moi anh goi model rieng, cost/quota tang hon tab soi doi hien tai.

Mitigation:

- Nen batch multi-image neu provider ho tro, hoac gioi han anh/lien.
- Compress client nhu hien tai.
- Cache local ket qua scan trong browser.
- Cho user export/import scan result de khong phai goi lai.

### 10. Data tier/meta co the khong du cho "5 team tot nhat"

`team-tier.json` chi co tier cho mot phan team. Neu engine phat hien user co team unranked nhung thuc te manh, co the bo sot. Nguoc lai, team T0 nhung thieu context mua/kich ban co the duoc uu tien qua muc.

Mitigation:

- MVP: chi noi "theo data hien co".
- Hien source tier trong tooltip.
- Khong cho team unranked chen len T0/T1 tru khi user chon filter/off-meta.

### 11. Logic "khong trung chien phap" can xu ly alternatives

Neu team data co tactic alternative A/B, conflict phai biet co the chon B khi A bi khoa. Neu chi check main tactic, engine se reject qua tay.

Mitigation:

- Model tactic slot la `{primary, alternatives}`.
- Khi primary conflict/missing, thu alternative neu owned va khong locked.
- Output phai ghi ro slot nao dung alternative.

### 12. UI co nguy co qua phuc tap

3 loai anh + 2 mode + ket qua 5 team + diagnostics co the qua tai tren mobile.

Mitigation:

- Wizard 3 buoc:
  1. Quet kho
  2. Kiem tra ket qua doc
  3. Xem 5 team
- An diagnostics sau details.
- Chi giu 2 mode uu tien: `Meta T0 -> T1`, `Nhieu hot`.

## Recommended Design Adjustments

1. Them `scan confidence review` bat buoc truoc khi recommend:
   - user co the sua ten tuong/chien phap doc sai.

2. Tach extraction mode thay vi mot endpoint/prompt chung:
   - `scanHeroes`, `scanTactics`, `scanBuiltTeams`.

3. Engine co hai mode ro:
   - `keepExistingTeams` mac dinh khi co team da build.
   - `optimizeFromScratch` khi user muon toi uu lai toan bo.

4. Dung greedy cho MVP nhung de interface engine mo de thay bang backtracking:
   - `recommendFiveTeams(candidates, constraints, mode)`.

5. Data schema can co diagnostic:
   - `missingHeroes`
   - `missingTactics`
   - `lockedTacticConflicts`
   - `usedAlternatives`
   - `confidenceWarnings`

6. Section ket qua:
   - `5 team nen build`
   - `Team manh nhung thieu tuong`
   - `Can scan them / can sua du lieu`

## Kill Criteria

Khong nen ship neu:

- Output khong cho user sua ket qua scan.
- Engine co the dua team thieu tuong vao top 5.
- Engine goi team bien the bang nickname meta goc khi thieu core hero.
- Chua co unit tests cho conflict chien phap va missing hero.
- Chi co sort top 5 doc lap, khong co co che tranh trung to hop.

## MVP Acceptance Criteria

- User upload nhieu anh tuong/chien phap/team da build.
- App doc va cho sua `ownedHeroes`, `ownedTactics`, `lockedTeams`.
- App tra toi da 5 team chinh, khong gom team thieu tuong.
- Neu thieu chien phap nhung co alternative hop le, hien `Build bien the`.
- Neu co team da build, recommendation mac dinh giu team do va goi y team tiep theo.
- Tests cover:
  - team 1 no conflict when from scratch,
  - locked teams create conflicts,
  - missing core hero excludes team,
  - alternative tactic resolves missing/conflict,
  - meta vs nhieu hot changes ordering.

## Open Questions

- Greedy MVP co du chap nhan khong, hay can backtracking ngay tu dau?
- Co can scan va luu nhieu account rieng nhu tracker chieu mo khong?
- Co nen reuse tab `Soi doi tu anh` hay tao tab moi `Goi y doi tu kho`?
