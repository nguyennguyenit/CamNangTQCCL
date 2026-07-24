# Research Report: Bac Phat Thuong SP Gia Cat Luong, Quan Hung, Truong Bao

---
type: research
date: 2026-07-13
topic: bac-phat-thuong-sp-gia-cat-luong-quan-hung-truong-bao
---

## Summary

Bac Phat Thuong / 北伐枪 / 北伐槍 / 北伐槍 / 북벌창 is a real meta shell across CN, TW/HK, JP, KR, VN communities. Core is fixed: SP Gia Cat Luong + Quan Hung + Truong Bao, usually spear; shield variant exists but needs treasure and is more coexist/second-team.

Current verdict: playable T0.5 to T1 depending red, tactics, and season environment. It is not a universal T0 in every region. Strong when Quan Hung has red and premium tactics, when SP Gia Cat moves first, and when target meta has cavalry/slow active teams. Weak if Quan Hung is low red, lacks Cuoi Ngua Nghin Dam, or enemy has burst headshot/control that kills SP Gia Cat.

Best evidence is CN/KR/JP. English/global has little useful gameplay analysis. VN public sources are mostly Facebook/community build requests, not deep logs.

## Sources Consulted

Project local:
- `data/teams.json`: `team-intro-7` Lượng Hưng Bào / Bắc Phạt Thương, meta shell.
- `data/coexist.json`: Cùng Tồn 1 and 5 include Bắc Phạt Thương coexist variants.

External:
- CN 17173, 2026-03-26: battle-report article with `Quân Dân + Thuyền Cỏ / Cưỡi Ngựa + Gió Táp / Cơ Hình + Không Đánh`, speed `Gia Cát > Trương Bào > Quan Hưng`: https://news.17173.com/content/03262026/161815467.shtml
- CN Tencent, 2025-08-16: post-buff Quan Hung analysis, small chain battle reports, core speed and build notes: https://news.qq.com/rain/a/20250816A051R200
- CN Tencent, 2025-11-21: post-buff spear/shield variants, report images, notes on `Biết Mình Biết Ta`, `Không Đánh`, and `Thịnh Khí` tech: https://news.qq.com/rain/a/20251121A05RIV00
- CN 233leyuan, 2026-05-28: current build-framework article, no fixed best build, speed/avoidance notes: https://www.233leyuan.com/post-detail/2060134172529000448
- TW/HK Bahamut, 2025-ish: `讓北伐再次偉大` thread; accessible via search result, page blocked by 403 during fetch. Snippet says cross-server/Korea battle reports and warns it still trails hard T0 teams: https://forum.gamer.com.tw/C.php?bsn=36815&snA=10909
- JP Hatena, 2023-03-19: deep mechanics and battle-history images, explains bond priority and speed order: https://www.sanguo-zhi.com/entry/season10-tyoho-kanko/
- JP Shinsen Navi, 2026-07 current pages: Guan Xing page and Hokubatsu page, recommended tactics/books: https://sangokushi-shinsen.com/kankou/ and https://sangokushi-shinsen.com/hokubatusou/
- JP Shinsen wiki, 2024-03-21: Hokubatsu shield analysis, speed/stat allocation and counters: https://sangokushi-shinsen.info/2024/03/21/s14%E3%80%80%E5%8C%97%E4%BC%90%E7%9B%BE/
- KR DCInside, 2024-10-06: Chencang season outlook and setup: https://gall.dcinside.com/mgallery/board/view/?id=3kingdoms&no=278458
- KR translated CN tier list, 2024-10-25: top/mid/budget Hokubatsu tiers and setups: https://spring2536.tistory.com/entry/%EC%82%BC%EA%B5%AD%EC%A7%80%EC%A0%84%EB%9E%B5%ED%8C%90-%EC%B5%9C%EC%8B%A0-%ED%8B%B0%EC%96%B4%ED%91%9C-241025-feat-%ED%95%AB%EC%82%B0%EC%8B%A0%EC%9E%85%EC%83%9D
- KR Tistory, 2024-05-07: battle-report image post, says all three need high promotion/red: https://gak2632.tistory.com/5
- VN Facebook result: public group build request exists, but content not deeply accessible/reliable: https://www.facebook.com/groups/tamquocchi.chienluoc/posts/1228199365482601/

## Evidence Quality

Strong-ish:
- CN Tencent/17173 posts have text build + many battle-report images, recent 2025-2026.
- JP Hatena has detailed mechanics + battle-history image blocks.
- KR DCInside gives practical season-environment reasoning and specific matchups.

Medium:
- KR tier list gives score/tier/build but no raw battle logs.
- JP Shinsen Navi/wiki gives mechanics and build logic, limited raw logs.

Weak:
- Douyin/YouTube snippets claim high chain rates but hard to verify as text.
- VN/English public web has little analyzable material.
- Image-only battle reports cannot be fully text-verified from browser extraction. Treat them as proof of community testing, not statistical proof.

## Core Mechanics

The team works because SP Gia Cat Luong boosts active-prep reliability for Quan Hung and Truong Bao. Quan Hung and Truong Bao also share the father-spirit bond: first attribute/proc-rate boost per turn can be copied at reduced value. JP Hatena stresses priority: proc-rate boost matters more than raw attribute boost.

Practical consequence:
- SP Gia Cat must act early enough to enable the brothers.
- Quan Hung is main damage. His red count matters most.
- Truong Bao is hybrid support: defense/resist, raid-mark synergy, sometimes secondary damage.
- If SP Gia Cat dies early, Quan Hung/Truong Bao can still hit, but team loses reliability and sustain.

## Speed Rule

Consensus majority:

```text
SP Gia Cat Luong > Truong Bao > Quan Hung
```

Why:
- SP Gia Cat first: maximizes own command timing and/or support tactics, plus reliable active-rate engine.
- Truong Bao second: puts resist/raid-mark/defense before Quan Hung, helps Quan Hung's output and mirror survival.
- Quan Hung third: damage lands after setup.

Important nuance:
- CN 233leyuan suggests a special `Quan Hưng second, Trương Bào last` framework when using `Nhân Lợi Chế Quyền`/certain current mechanics to avoid bad interaction against Mãn Sủng aid/dispels. This conflicts with older consensus. I would not use this as default unless your target server has many Man Chong aid teams and you are deliberately playing that variant.
- Project data and most JP/CN/KR sources still align with `Gia Cát > Trương Bào > Quan Hưng`.

## Recommended Builds

### 1. Current Premium Spear

Best default if not constrained by coexist.

| General | Tactics | Books | Stats |
|---|---|---|---|
| SP Gia Cat Luong | An Ui Quan Dan / Tam Lanh + Thuyen Co | Tam Quan Chi Chung or Tan Cong Diem Yeu + Toc Chien + Khích Le | enough speed for 1st, rest Int/Command |
| Quan Hung | Cuoi Ngua Nghin Dam + Gio Tap Mua Sa or Vo Dich Can Truong | Danh Sau Trung Truoc + Quy Muu + Tuong Uy | full Force |
| Truong Bao | Co Hinh Tran + Khong Danh Ma Thang | Yeu Linh Thuong Dan + The Phong Thu/Giap Sat | Command, some speed to be 2nd |

Use when:
- Need main-team quality.
- Have `Cuoi Ngua Nghin Dam`.
- Have enough premium sustain for SP Gia Cat.

### 2. CN 2026 Anti-Burst Spear

Source: 17173, 2026.

| General | Tactics |
|---|---|
| SP Gia Cat Luong | Phu Tap Quan Dan + Thuyen Co |
| Quan Hung | Cuoi Ngua Nghin Dam + Gio Tap Mua Sa |
| Truong Bao | Co Hinh Tran + Khong Danh Ma Thang |

Notes:
- Good into early Zhang Fei/other main-carry teams because `Co Hinh` reduces headshot risk.
- `Gio Tap` adds pressure and anti-heal utility in sustain-heavy meta.
- Strong but expensive: burns Quân Dân, Thuyền Cỏ, Không Đánh.

### 3. Post-Buff CN Quan Hung Burst

Source: Tencent 2025-08-16.

| General | Tactics |
|---|---|
| SP Gia Cat Luong | Thuyen Co + Tam Lanh, or Quan Dan + Thuyen Co |
| Quan Hung | Cuoi Ngua + Vo Dich Can Truong for burst, or Cuoi Ngua + Gio Tap for anti-heal |
| Truong Bao | flexible support; protect and enable |

Notes:
- Quan Hung post-buff can concentrate repeated damage hits; source shows small-chain reports and high single-damage examples.
- Best when Quan Hung red is high. Source says red advantage is core, especially Quan Hung.

### 4. `Biết Mình Biết Ta` / `Không Đánh` Newer Tech

Source: Tencent 2025-11-21 and CN 233leyuan.

| General | Tactics |
|---|---|
| SP Gia Cat Luong | Tam Lanh + Biet Minh Biet Ta, or Thuyen Co variant |
| Quan Hung | Cuoi Ngua + Van Vo / Vo Dich |
| Truong Bao | Nhan Loi Che Quyen / Co Hinh + Khong Danh |

Notes:
- More coexist-friendly if Thuyền Cỏ/Quân Dân are locked elsewhere.
- Damage can be lower unless Quan Hung is well-built.
- Good as fifth/sixth team, not automatic main team.

### 5. Shield Variant

JP Shinsen wiki build:

| General | Tactics |
|---|---|
| Truong Bao | An Ui Quan Dan + Vo Phong Tran |
| Quan Hung | Cuoi Ngua Nghin Dam + Vo Dich Can Truong |
| SP Gia Cat Luong | Ham Tran Doanh + Khong Danh Ma Thang |

Notes:
- Needs shield treasure, often not first-team.
- Better coexist because saves some popular heals/cleanse.
- Good into bow-heavy environments; worse into control cavalry and headshot cavalry.

### 6. Project-Local Coexist Variant

From `data/coexist.json`:

| General | Tactics |
|---|---|
| SP Gia Cat Luong | Tam Lanh or Thinh Khi + Biet Minh Biet Ta |
| Quan Hung | Gio Tap / Van Vo + Cuoi Ngua |
| Truong Bao | Khong Danh + Nhan Loi Che Quyen |

Verdict:
- Valid as coexist line.
- Lower safety than premium because no Thuyen Co/Quan Dan package.
- Good when premium tactics are locked by higher-priority teams.

## Tactic Priority

Must-have / near must-have:
- `Cuoi Ngua Nghin Dam` on Quan Hung. Without it, stability drops hard.
- One real protection package for SP Gia Cat: `Thuyen Co`, `Quan Dan`, `Tam Lanh`, `Co Hinh`, `Khong Danh`, depending version.

High value:
- `Gio Tap Mua Sa`: damage + anti-heal in sustain meta.
- `Vo Dich Can Truong`: burst ceiling.
- `Co Hinh Tran`: anti-main-carry, anti-headshot.
- `Khong Danh Ma Thang`: sustain via damage conversion, very high value.

Avoid / conditional:
- Overloading SP Gia Cat with only short-duration mitigation and no cleanse in control-heavy meta.
- Putting active-rate boosters on holders without meaningful active tactics.
- Using `Thuyen Co` on slow Truong Bao if the goal is early cleanse.
- Running low-red Quan Hung as main team just because the shell is famous.

## Matchups

### Favored / Good Targets

| Target | Reason |
|---|---|
| Many cavalry lines | Spear advantage; KR notes Dengfeng cavalry and Zhang-Wang-Guo style teams were food in buffed season. |
| Slow active teams | Bắc Phạt can win by going first, triggering setup, and bursting through. |
| Some Zhang Fei / Guan-Guan-Zhang lines | `Co Hinh` and early mitigation reduce headshot risk; CN 17173 shows this target class. |
| Non-elite field teams | Low 18C team can finish early and farm tempo. |

### Even / Depends Build

| Target | Notes |
|---|---|
| Tai Uy shield / bulky shields | Needs anti-heal or high Quan Hung burst. Without it, draws often. |
| Wu spear / Shu spear mirrors | Red, speed, gear and `Co Hinh` decide. |
| SP Ma Chao / Huang Ma | Can tech `Thinh Khi`/anti-basic, but not guaranteed. |
| Dengfeng cavalry in later seasons | KR notes earlier advantage weakened when season buffs disappear and new anti-physical tactics arrive. |

### Bad / Avoid

| Target | Why |
|---|---|
| Strong bows | Project data says avoid "Team Cung các phe"; spear is naturally exposed. |
| Control cavalry: Fu Gui, Wang Zuo, SP Wei law variants | JP shield article flags these as bad matchups; control disrupts active engine and can kill SP Gia Cat. |
| Zhang Liao / headshot cavalry | SP Gia Cat can be deleted before engine stabilizes. |
| High-red, high-tempo active/control teams with proper tech | Bắc Phạt is not universal T0; TW/KR/CN sources all imply it still depends environment. |

## Gear / Specialty Tips

Best:
- SP Gia Cat: speed/Int gear; `Thiên Cơ` if available; `Viện Trợ`/aid armor can help depending variant.
- Quan Hung: damage gear; `Long Tương` good but not mandatory.
- Truong Bao: `Hổ Trĩ` strong; support/aid gear if he is tanking.

Speed gear:
- Do not accidentally make Quan Hung faster than Truong Bao in default build.
- `Tốc Chiến` on SP Gia Cat is common because every point saved from speed can go into Int/Command.

Stat allocation:
- SP Gia Cat: enough speed for 1st, then Int or Command depending sustain package.
- Quan Hung: full Force.
- Truong Bao: Command for defensive builds; Force only in low/field or damage-focused versions.

## Comparison

| Team | Relative to Bac Phat |
|---|---|
| Guan-Guan-Zhang / popular spear variants | Often better raw popularity and stable control; Bắc Phạt can beat but needs red/timing. |
| Dengfeng cavalry | Bắc Phạt had good season-specific matchup, but newer KR analysis says advantage drops after buff environment changes. |
| Tai Uy / law shields | Bắc Phạt needs anti-heal/high burst; otherwise draw or lose long. |
| Premium bow teams | Bad target for spear unless red/tech advantage. |
| Shield Bắc Phạt | More coexist and bow-answering potential, but treasure-gated and usually later-team. |

## Final Recommendation

If building for this account without seeing conflicts:

```text
SP Gia Cat Luong: Quan Dan / Tam Lanh + Thuyen Co
Quan Hung: Cuoi Ngua + Gio Tap or Vo Dich
Truong Bao: Co Hinh + Khong Danh
Speed: SP Gia Cat > Truong Bao > Quan Hung
```

If coexist pressure is high:

```text
SP Gia Cat Luong: Thinh Khi / Tam Lanh + Biet Minh Biet Ta
Quan Hung: Cuoi Ngua + Gio Tap / Van Vo
Truong Bao: Khong Danh + Nhan Loi Che Quyen
```

Use as main team only if:
- Quan Hung red is high.
- `Cuoi Ngua` is available.
- SP Gia Cat can reliably move first and survive.
- You can afford at least one premium sustain/cleanse/protection package.

Use as coexist/fifth team if:
- Premium tactics locked elsewhere.
- Quan Hung is not high red.
- Your server has many bows/control cavalry.

## Unresolved Questions

- User's actual red counts for SP Gia Cat, Quan Hung, Truong Bao.
- Locked tactics from current teams.
- Current server season/environment: many SP Ma Chao, Tai Uy, bows, Dengfeng, or Guan-Guan variants?
- Whether shield treasure / spear treasure / key gear is available.
