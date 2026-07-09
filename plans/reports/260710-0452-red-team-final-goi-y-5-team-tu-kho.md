# Red-Team Final: Goi y 5 team tu kho

Ngay: 2026-07-10

## Summary

Feature dang dung huong neu giu 3 nguyen tac:

- AI chi doc anh, khong quyet team.
- Engine deterministic chon 5 team theo data local.
- Output chinh khong bao gio chua team thieu tuong loi.

Rui ro con lai khong nam o UI upload anh, ma nam o scoring va cach goi ten team. Neu sai logic meta, user se mat niem tin nhanh hon loi OCR.

## Red-Team Findings

### 1. Full-box khong quota la dung, nhung can objective ro

Quyet dinh moi: khong chia slot T0/T0.5/T1, uu tien tu T0 xuong va toi uu tong 5 team.

Day la dung. Nhung neu objective mapp mo, engine co the lam 2 loi:

- Chon 5 team T0 doc lap nhung conflict chien phap/giam suc manh tong.
- Bo team T0 rat manh ma khong giai thich, user nghi app sai.

Guardrail:

- Score theo portfolio, khong score tung team.
- Moi team T0 bi bo phai co ly do: trung tuong, trung chien phap, can chien phap core cho 2 team khac, hoac thua preset curated.
- Test bat buoc: bo top-1 ca nhan de lay bo 5 co tong diem cao hon.

### 2. Greedy de sai voi full-box

User full-box co nhieu candidate. Sort roi lay dan la nguy hiem vi team dau co the an chien phap core cua 2 team sau.

Guardrail:

- MVP user thuong co the greedy co diagnostics.
- Full-box nen backtracking/search tren top N candidate tu dau.
- Gioi han N de khong no: vi du top 40-80 team da loc tier/meta.

### 3. `data/coexist-sets.json` khong bat buoc MVP, nhung bat buoc neu muon "recommend nhat"

Algorithm co the chon to hop hop le ve conflict nhung kem thuc chien. Meta cung ton trong game co nhieu quy tac ngam: ai giu Thuyen Co, ai can Phong Thi Tran, team nao can uu tien chien phap xịn.

Guardrail:

- Phase 1: engine score + giai thich, noi ro "theo data hien co".
- Phase 2: them `data/coexist-sets.json` curated cho full-box / whale users.
- Preset curated co priority cao hon raw search khi cung mua/kich ban.

### 4. Missing core hero phai la hard reject

Vi du thieu Hua Du thi khong duoc goi la Hoang Ma Thuong. Day la rule product, khong phai scoring.

Guardrail:

- Team thieu tuong loi khong vao `recommendedTeams`.
- Chi vao `blockedStrongTeams`.
- Khong auto thay tuong neu khong co record team rieng trong data.

### 5. Missing tactic duoc thay, nhung khong duoc doi ten thanh meta goc

Thieu chien phap co the dung alternative. Nhung neu alternative lam doi khac ban meta, output phai noi thang.

Guardrail:

- Status: `Build ngay`, `Build bien the`, `Thieu chien phap`, `Thieu tuong`.
- `Build bien the` phai ghi slot nao thay, tu chien phap nao sang chien phap nao.
- Alternative chi lay tu data curated, khong suy tu "cung loai hinh".

### 6. Anh chien phap chi doc ten la dung, nhung can completion warning

Khong can doc 0/1, loai hinh, co the thiet lap. Data da co. Nhung user co the chup thieu trang.

Guardrail:

- Cho upload nhieu anh chien phap.
- Hien danh sach ten da doc de user sua.
- Neu so chien phap doc qua it so voi nguong, canh bao "co the chua scan het".

### 7. Team da build la locked source, nhung default phai ro

Neu user gui anh team da build, mac dinh nen giu team do va build tiep. Neu muon toi uu lai ca account, do la mode khac.

Guardrail:

- Default: `keepExistingTeams`.
- Secondary action: `Toi uu lai tu dau`.
- Trong `keepExistingTeams`, team da build khoa tuong va chien phap truoc khi chon team moi.

### 8. Toggle "khong trung chien phap" de gay hieu nham

Neu hien toggle ten nay, user co the nghi tat toggle la app duoc phep recommend trung chien phap trong 5 team. Voi coexist, khong trung la invariant.

Guardrail:

- Khong trung chien phap la hard rule khi output "cung ton".
- Neu can filter, dat ten `Chi hien doi build ngay`.
- Khi tat filter, van khong trung trong 5 team, chi hien them team thieu skill/variant o section phu.

### 9. Need confidence review, khong duoc recommend ngay sau scan

Anh card nho de doc nham ten, hinh, hot. Neu khong co buoc user sua, loi OCR bien thanh loi build team.

Guardrail:

- Sau scan: man hinh review `tuong`, `chien phap`, `team da khoa`.
- Recommend chi chay sau khi user xac nhan.
- Low confidence item phai co badge can kiem tra.

### 10. Tests phai chong "meta logic bugs"

Test UI upload khong du. Can test logic de khong lap lai loi kieu Ho Bao Ky gan sai team chu dong.

Test bat buoc:

- HBP/Ho Bao Ky chi bonus dung voi dot kich, khong cham diem cao cho team chu dong.
- Phi Hung Quan can healing/trigger phu hop.
- Doc Suc Tinh Ke can active tactic phu hop, khong cham sai team thieu active.
- Team 1 from scratch khong co duplicate conflict.
- Team 2-5 co conflict voi locked teams.
- Missing core hero bi loai khoi 5 team chinh.
- Full-box search co the bo mot T0 va giai thich ly do.

## Final Recommendation

Nen chot feature theo model:

- Tab moi: `Goi y doi tu kho`.
- 3 scan modes: `scanHeroes`, `scanTactics`, `scanBuiltTeams`.
- Worker dung endpoint hien co voi `mode` de reuse Turnstile/upload/error handling.
- Review step bat buoc.
- 2 preference modes: `Meta T0 -> T1` mac dinh, `Nhieu hot`.
- No duplicate tactics la invariant, khong phai main mode.
- Main result: 5 team nen build.
- Side sections: `Team manh nhung thieu tuong`, `Team thieu chien phap`, `Can scan/sua them`.
- Full-box: search/backtracking portfolio 5 team, tier priority tu T0 xuong, khong quota tier.
- Tab `Cung Ton` la catalog/preset meta chung; `Goi y doi tu kho` la personalization layer theo account.
- `data/coexist-sets.json` de phase sau, nhung engine contract nen chua `presetId`, `presetReason`, `coexistSetBonus` tu dau.

## Kill Criteria

Khong nen implement/ship neu:

- Chua co step user sua ket qua scan.
- Engine chi sort top 5 doc lap.
- Team thieu core hero van vao ket qua chinh.
- Alternative tactic suy tu loai hinh chung, khong curated.
- Full-box khong giai thich vi sao bo T0.
- Chua co unit test cho conflict, missing hero, full-box, va logic chien phap dac thu.

## Resolved Decisions

- Full-box search lam trong MVP, gioi han top N candidate.
- Worker them `mode` vao endpoint hien co.
- Tao tab moi `Goi y doi tu kho`.
- `data/coexist-sets.json` curate phase sau MVP, khong tao hai nguon su that voi tab `Cung Ton`.

## Unresolved Questions

None.
