# Phase 2 data validation and mapping inventory

Date: 2026-09-12. Python/CSV/data slice under `--auto --advice --tdd`. Controller owns integration and publication gates; no deployment or commit.

## Delivered data

Five sidecars only. Configs/evaluations remain empty because there are zero verified VN rulesets. Content links contain five scenario-attributed source groups (25 teams, 75 hero positions) and five unknown legacy groups. Khai hoang is outside seasonal classification. Nine original JSON artifacts retain baseline bytes.

The dedicated CSV adapter uses the complete pinned real snapshot as its checksum fixture. It preserves multiline/CRLF, empty ordered slots, group notes/opening suggestions, raw C suffixes, decorated identities, annotations and coupled slash bundles. J remains unit-tactic effects; nonempty continuation J rejects unverified ownership. No global fill-down or Cartesian combinations. Team locators are 1-based inclusive `{csvRecordStart,csvRecordEnd,lineStart,lineEnd}`, spanning exactly three CSV records.

`pipeline/coexist-source-record-map.json` stores opaque group/team IDs assigned once independently of row/fingerprint. The reviewed map attaches IDs to accepted content revisions; duplicates, missing records and edits reject. Reordering complete groups preserves group/team IDs. Within-group order remains meaningful source data. These are source-owned IDs, not guessed canonical identities. `build_content_links` reproduces all five curated source links exactly.

## TDD evidence

| Slice | Actual Red | Green / regression |
|---|---|---|
| Publication | One test, two failed assertions: second `os.replace` failure left changed/new first output | Rollback passes for previous and new outputs; repeated with all five artifacts and unrelated sibling |
| Bundle validator | Nine tests, 20 failed assertions after real copy/encoder scaffold accepted optional evidence field; no import errors in meaningful Red | Exact scope, dictionaries, slot counts, config evidence, score selection and legacy locators pass |
| Raw CSV | Nine tests, 11 failed assertions and one `csv.Error` instead of required domain `ValueError`; count/blank-slot positives already passed | Header drift, orphan/interruption/truncation, checksum, malformed CSV, raw preservation and physical locators pass |
| Score source binding | One test, four failed assertions: wrong URL/season/snapshot or pending evaluation accepted | Exact source/config/selection/review binding passes |
| Source-link binding | Four tests, three failed assertions: wrong source hash/URL or missing observation evidence | Matching observation hash/URL and attribution URL required |
| Tier evidence | One failed assertion: scenario-only proof accepted for reviewed tier | Exact config applicability proof required |
| Canonical ambiguity | One failed assertion: conflicting dictionary identities still resolved | Referenced conflicting IDs rejected; identical duplicate dictionary rows do not invent conflicts |
| Public inventory | One failed assertion: only two seasonal routes existed | Exactly five data routes and resolver registered with files |
| Focused final | `python3 -m unittest tests.test_build_season_data tests.test_parse_coexist_csv` | 49 passed |
| Asset focused | Seasonal routes and runtime JSON | 3 + 6 passed |

Reviewed-ID-map reproduction/reordering/mutation and golden-vector checks were added as regression tests after implementation; they have no separately recorded pre-implementation Red. No Red claim is made for them.

Full Python discovery during parallel work ran 185 tests with two failures in the controller's active Recommended streamed-field Red. No unrelated tests were changed. Final combined integration gate is pending controller completion. Before extension, phase 1 full Python discovery passed 145 tests.

## Interfaces

`build_season_data(registry,evidence,*,configs=None,evaluations=None,content_links=None,legacy_data=None,identity_catalog=None)` retains two outputs when extensions are omitted; supplying any extension requires all three. With supplied legacy/dictionary context candidate processing is pure; defaults read local teams/coexist/dictionaries. Non-null canonical evidence refs resolve against actual canonical dictionaries. Hero SP/CO/base and Vietnamese slug semantics match current identity helpers.

`pipeline/season_validation.py` owns configuration/evaluation/link validation and canonical fingerprints. Registry/evidence validation stays in the builder. CLI defaults now read all five curated inputs; `--configs`, `--evaluations`, `--content-links` supplement `--registry`, `--evidence`, `--output-dir`. Candidate example: `python3 -m pipeline.build_season_data --output-dir /tmp/season-candidate`.

Publication serializes every candidate before I/O, stages bytes/backups, then replaces scoped outputs. A handled replacement failure restores changed files and removes new outputs. This is not crash-atomic or power-loss-atomic across files; OS failure during rollback is an operational error. Sibling files remain untouched.

Config projection: `schemaVersion,id,teamId,scenarioId,rulesetId,unitTypes,heroSlots,requirements,effectBundles`; nested objects unchanged, arrays ordered. Canonical bytes sort object keys, retain literal Unicode, omit whitespace/newline, reject unsafe/fractional numbers. Shared vectors: `tests/fixtures/season-fingerprint-vectors.json`. Optional evidence `configFingerprint` belongs only to ruleset-applicability claims; reviewed configs/ranks require the exact config/content/pair proof. Requirement records cannot contain self-certified `supported`/`status`; runtime derives readiness.

Source scores require reviewed config/evaluation, matching provider/region/URL/sourceSeason/snapshot/config evidence, complete ordered selection, unique selected heroes/tactics, sorted known conditions/bundles, mandatory/bundle requirements, reviewed selected conditions and exact hashes. Values above 100 are retained; missing score remains null. Root-owned Recommended raw evidence is not automatically promoted.

Discriminated links reject mixed/wrong branches. Legacy `{groupIndex}` requires unique full-group fingerprint match. Source group/team revision projections recursively omit `recordId`, `sourceLocator`, `contentFingerprint`; source observation hash/URL and attribution URL must match evidence. Payload text grants no applicability/identity. Future linked configs must be reviewed at the same pair with shared evidence.

## Complete legacy team inventory

All rows have unknown verified VN applicability. Source names/historical dates are not season mappings; existing tiers remain intact.

| Team ID | Name | Source | Rankings | Scope |
|---|---|---|---:|---|
| `team-intro-0` | Úc Liêu Cơ | team-intro | 0 | unknown |
| `team-intro-1` | Siêu Tung Du | team-intro | 2 | unknown |
| `team-intro-2` | Vũ Tung Úc | team-intro | 2 | unknown |
| `team-intro-3` | Vũ Tung Mông | team-intro | 0 | unknown |
| `team-intro-4` | Mông Tốn Túc | team-intro | 0 | unknown |
| `team-intro-5` | Phi Bình Vân | team-intro | 0 | unknown |
| `team-intro-6` | Phi Bình Anh | team-intro | 1 | unknown |
| `team-intro-7` | Lượng Hưng Bào | team-intro | 1 | unknown |
| `team-intro-8` | Phổ Siêu Úc | team-intro | 0 | unknown |
| `team-intro-9` | Vũ Bình Bình | team-intro | 0 | unknown |
| `team-intro-10` | Tháo Uyên Liêu | team-intro | 1 | unknown |
| `team-intro-11` | Úc Hủ Gia | team-intro | 1 | unknown |
| `team-intro-12` | Úc Gia Du | team-intro | 0 | unknown |
| `team-intro-13` | Ý Úc Chân | team-intro | 0 | unknown |
| `team-intro-14` | Liêu Gia Cơ | team-intro | 1 | unknown |
| `team-intro-15` | Úc Dục Hủ | team-intro | 0 | unknown |
| `team-intro-16` | Thái Hương Thống | team-intro | 1 | unknown |
| `team-intro-17` | Duy Bị Bình | team-intro | 1 | unknown |
| `team-intro-18` | Úc Đôn Sủng | team-intro | 0 | unknown |
| `team-intro-19` | Úc Hủ Dị | team-intro | 0 | unknown |
| `team-intro-20` | Du Mông Túc | team-intro | 0 | unknown |
| `team-intro-21` | Duy Thống Lượng | team-intro | 2 | unknown |
| `team-intro-22` | Du Tốn Mông | team-intro | 1 | unknown |
| `team-intro-23` | Du Từ Mông | team-intro | 0 | unknown |
| `team-intro-24` | Úc Hủ Hội | team-intro | 0 | unknown |
| `team-intro-25` | Úc Cơ Gia | team-intro | 0 | unknown |
| `team-intro-26` | Ninh Từ Thái | team-intro | 1 | unknown |
| `team-intro-27` | Ninh Từ Mông | team-intro | 1 | unknown |
| `team-intro-28` | Úc Hủ Đức | team-intro | 0 | unknown |
| `team-intro-29` | Úc Hủ Phi | team-intro | 0 | unknown |
| `team-intro-30` | Phi Hủ Cơ | team-intro | 0 | unknown |
| `team-intro-31` | Bố Tung Du | team-intro | 0 | unknown |
| `team-intro-32` | Thuyền Du Tháo | team-intro | 1 | unknown |
| `team-intro-33` | Du Bố Từ | team-intro | 1 | unknown |
| `team-intro-34` | Lượng Trung Thống | team-intro | 0 | unknown |
| `team-intro-35` | Trách Thuyền Bố | team-intro | 0 | unknown |
| `team-intro-36` | Quyền Túc Du | team-intro | 0 | unknown |
| `team-intro-37` | Du Túc Tốn | team-intro | 1 | unknown |
| `team-intro-38` | Thiệu Tuấn Thụ | team-intro | 2 | unknown |
| `team-intro-39` | Thuyền Ỷ Từ | team-intro | 0 | unknown |
| `team-intro-40` | Vũ Chính Thái | team-intro | 1 | unknown |
| `team-intro-41` | Vũ Đại Thái | team-intro | 0 | unknown |
| `team-intro-42` | Ý Sủng Tháo | team-intro | 2 | unknown |
| `team-intro-43` | Vũ Thái Bị | team-intro | 0 | unknown |
| `team-intro-44` | Tháo Hủ Chiêu | team-intro | 2 | unknown |
| `team-intro-45` | Bị Vũ Phi | team-intro | 1 | unknown |
| `team-intro-46` | Giác Cát Từ | team-intro | 3 | unknown |
| `team-intro-47` | Thái Phi Thiệu | team-intro | 1 | unknown |
| `team-intro-48` | Tháo Đôn Sủng | team-intro | 1 | unknown |
| `team-intro-49` | Giác Bị Túc | team-intro | 1 | unknown |
| `moi-phe-62` | Vân Vũ Lượng | moi-phe | 0 | unknown |
| `moi-phe-63` | Thái Vũ Tháo | moi-phe | 0 | unknown |
| `moi-phe-64` | Úc Vũ Từ | moi-phe | 0 | unknown |
| `moi-phe-65` | Phổ Vũ Úc | moi-phe | 0 | unknown |
| `moi-phe-66` | Du Vũ Mông | moi-phe | 0 | unknown |
| `moi-phe-67` | Ý Tháo Sủng | moi-phe | 0 | unknown |
| `moi-phe-68` | Ý Tháo Sủng | moi-phe | 0 | unknown |
| `moi-phe-69` | Ý Tháo Chiêu | moi-phe | 0 | unknown |
| `moi-phe-70` | Tháo Ý Chiêu | moi-phe | 0 | unknown |
| `moi-phe-71` | Ý Hoa Sủng | moi-phe | 0 | unknown |
| `moi-phe-72` | Tháo Hụ̉ Chiêu | moi-phe | 0 | unknown |
| `moi-phe-73` | Tháo Hủ Chiêu | moi-phe | 0 | unknown |
| `moi-phe-74` | Tháo Tiến Chiêu | moi-phe | 0 | unknown |
| `moi-phe-75` | Úc Hủ Gia | moi-phe | 0 | unknown |
| `moi-phe-76` | Úc Du Gia | moi-phe | 0 | unknown |
| `moi-phe-77` | Tháo Hủ Gia | moi-phe | 0 | unknown |
| `moi-phe-78` | Tháo Hủ Dục | moi-phe | 0 | unknown |
| `moi-phe-79` | Tháo Hủ Du | moi-phe | 0 | unknown |
| `moi-phe-80` | Tháo Uyên Liêu | moi-phe | 0 | unknown |
| `moi-phe-81` | Tháo Đôn Sủng | moi-phe | 0 | unknown |
| `moi-phe-82` | Uyên Tháo Gia | moi-phe | 0 | unknown |
| `moi-phe-83` | Liêu Cơ Gia | moi-phe | 0 | unknown |
| `moi-phe-84` | Tháo Tiến Hủ | moi-phe | 0 | unknown |
| `moi-phe-85` | Hủ Tháo Sủng | moi-phe | 0 | unknown |
| `moi-phe-86` | Tháo Hoảng Hụ̉ | moi-phe | 0 | unknown |
| `moi-phe-87` | Duy Thống Lượng | moi-phe | 0 | unknown |
| `moi-phe-88` | Duy Thống Lượng | moi-phe | 0 | unknown |
| `moi-phe-89` | Duy Thống Lượng | moi-phe | 0 | unknown |
| `moi-phe-90` | Lượng Thống Chính | moi-phe | 0 | unknown |
| `moi-phe-91` | Duy Bị Diên | moi-phe | 0 | unknown |
| `moi-phe-92` | Duy Bị Diên | moi-phe | 0 | unknown |
| `moi-phe-93` | Bị Vũ Phi | moi-phe | 0 | unknown |
| `moi-phe-94` | Bị Vũ Phi | moi-phe | 0 | unknown |
| `moi-phe-95` | Bị Vũ Diên | moi-phe | 0 | unknown |
| `moi-phe-96` | Bị Bình Diên | moi-phe | 0 | unknown |
| `moi-phe-97` | Bị Vân Diên | moi-phe | 0 | unknown |
| `moi-phe-98` | Bị Phi Diên | moi-phe | 0 | unknown |
| `moi-phe-99` | Vân Vũ Bình | moi-phe | 0 | unknown |
| `moi-phe-100` | Vũ Siêu Bình | moi-phe | 0 | unknown |
| `moi-phe-101` | Vũ Phi Bình | moi-phe | 0 | unknown |
| `moi-phe-102` | Vũ Diên Bình | moi-phe | 0 | unknown |
| `moi-phe-103` | Vân Vũ Phi | moi-phe | 0 | unknown |
| `moi-phe-104` | Lượng Bình Vân | moi-phe | 0 | unknown |
| `moi-phe-105` | Lượng Vân Phi | moi-phe | 0 | unknown |
| `moi-phe-106` | Lượng Diên Bình | moi-phe | 0 | unknown |
| `moi-phe-107` | Lượng Hưng Bào | moi-phe | 0 | unknown |
| `moi-phe-108` | Bào Hưng Lượng | moi-phe | 0 | unknown |
| `moi-phe-109` | Duy Bình Lượng | moi-phe | 0 | unknown |
| `moi-phe-110` | Lượng Thống Vũ | moi-phe | 0 | unknown |
| `moi-phe-111` | Duy Bình Bị | moi-phe | 0 | unknown |
| `moi-phe-112` | Duy Vũ Bị | moi-phe | 0 | unknown |
| `moi-phe-113` | Tốṇ Túc Mông | moi-phe | 0 | unknown |
| `moi-phe-114` | Tốṇ Túc Mông | moi-phe | 0 | unknown |
| `moi-phe-115` | Mông Tốṇ Túc | moi-phe | 0 | unknown |
| `moi-phe-116` | Tốṇ Ninh Phổ | moi-phe | 0 | unknown |
| `moi-phe-117` | Quyền Túc Phổ | moi-phe | 0 | unknown |
| `moi-phe-118` | Ninh Từ Thái | moi-phe | 0 | unknown |
| `moi-phe-119` | Du Tốn Mông | moi-phe | 0 | unknown |
| `moi-phe-120` | Du Tốn Túc | moi-phe | 0 | unknown |
| `moi-phe-121` | Du Tốn Mông | moi-phe | 0 | unknown |
| `moi-phe-122` | Du Từ Mông | moi-phe | 0 | unknown |
| `moi-phe-123` | Du Tốn Phổ | moi-phe | 0 | unknown |
| `moi-phe-124` | Tốn Từ Phổ | moi-phe | 0 | unknown |
| `moi-phe-125` | Quyền Từ Túc | moi-phe | 0 | unknown |
| `moi-phe-126` | Quyền Từ Túc | moi-phe | 0 | unknown |
| `moi-phe-127` | Quyền Từ Mông | moi-phe | 0 | unknown |
| `moi-phe-128` | Quyền Tốn Phổ | moi-phe | 0 | unknown |
| `moi-phe-129` | Du Từ Phổ | moi-phe | 0 | unknown |
| `moi-phe-130` | Quyền Túc Du | moi-phe | 0 | unknown |
| `moi-phe-131` | Tốn Du Kháng | moi-phe | 0 | unknown |
| `moi-phe-132` | Du Kiên Túc | moi-phe | 0 | unknown |
| `moi-phe-133` | Tốṇ Túc Phổ | moi-phe | 0 | unknown |
| `moi-phe-134` | Quyền Từ Thái | moi-phe | 0 | unknown |
| `moi-phe-135` | Quyền Từ Thái | moi-phe | 0 | unknown |
| `moi-phe-136` | Thái Hương Thống | moi-phe | 0 | unknown |
| `moi-phe-137` | Thái Hương Từ | moi-phe | 0 | unknown |
| `moi-phe-138` | Thái Thống Từ | moi-phe | 0 | unknown |
| `moi-phe-139` | Phổ Ninh Mông | moi-phe | 0 | unknown |
| `moi-phe-140` | Thiệu Tuấn Thụ | moi-phe | 0 | unknown |
| `moi-phe-141` | Thiệu Giác Thụ | moi-phe | 0 | unknown |
| `moi-phe-142` | Thiệu Giác Từ | moi-phe | 0 | unknown |
| `moi-phe-143` | Giác Cốt Từ | moi-phe | 0 | unknown |
| `moi-phe-144` | Giác Cát Từ | moi-phe | 0 | unknown |
| `moi-phe-145` | Thuyền Giác Thụ | moi-phe | 0 | unknown |
| `moi-phe-146` | Du Bố Bạch | moi-phe | 0 | unknown |
| `moi-phe-147` | Ý Túc Sủng | moi-phe | 0 | unknown |
| `moi-phe-148` | Giác Chính Từ | moi-phe | 0 | unknown |
| `moi-phe-149` | Quyền Úc Mông | moi-phe | 0 | unknown |
| `moi-phe-150` | Tốn Từ Du | moi-phe | 0 | unknown |
| `moi-phe-151` | Giác Túc Bị | moi-phe | 0 | unknown |
| `moi-phe-152` | Giác Chính Hủ | moi-phe | 0 | unknown |
| `moi-phe-153` | Giác Túc Cốt | moi-phe | 0 | unknown |
| `moi-phe-154` | Bố Gia Anh | moi-phe | 0 | unknown |
| `moi-phe-155` | Hủ Duy Tử | moi-phe | 0 | unknown |
| `moi-phe-156` | Giác Diên Túc | moi-phe | 0 | unknown |
| `moi-phe-157` | Thái Thiệu Tháo | moi-phe | 0 | unknown |
| `moi-phe-158` | Vũ Phổ Thụ | moi-phe | 0 | unknown |
| `moi-phe-159` | Cơ Bị Quyền | moi-phe | 0 | unknown |
| `moi-phe-160` | Du Hủ Quyền | moi-phe | 0 | unknown |
| `moi-phe-161` | Hủ Từ Du | moi-phe | 0 | unknown |
| `moi-phe-162` | Hủ Từ Du | moi-phe | 0 | unknown |
| `moi-phe-163` | Chính Tiến Trác | moi-phe | 0 | unknown |
| `moi-phe-164` | Chính Giác Chiêu | moi-phe | 0 | unknown |
| `moi-phe-165` | Chính Giác Tháo | moi-phe | 0 | unknown |
| `moi-phe-166` | Chính Ninh Sủng | moi-phe | 0 | unknown |
| `moi-phe-167` | Úc Giác Từ | moi-phe | 0 | unknown |
| `moi-phe-168` | Úc Liêu Cơ | moi-phe | 0 | unknown |
| `moi-phe-169` | Chính Ninh Sủng | moi-phe | 0 | unknown |
| `moi-phe-170` | Túc Giác Tháo | moi-phe | 0 | unknown |
| `moi-phe-171` | Vân Từ Tử | moi-phe | 0 | unknown |
| `team-intro-50` | Pháp Quan Lưu Bị | team-intro | 1 | unknown |
| `team-intro-51` | Pháp Quan Mã Đại | team-intro | 1 | unknown |
| `team-intro-52` | Quan Quân Thương | team-intro | 1 | unknown |
| `team-intro-53` | Lô Điêu Trác | team-intro | 1 | unknown |
| `team-intro-54` | Lô Tiêu Điêu | team-intro | 1 | unknown |
| `team-intro-55` | Giác Tháo Bị | team-intro | 1 | unknown |

## Complete historical tier inventory

| Team ID / index | Source | Tier | Date | Scope |
|---|---|---|---|---|
| `team-intro-1` / 0 | video-260701 · T0 · 皇马枪 | T0 | 2026-07-03 | unknown |
| `team-intro-1` / 1 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0 · 皇馬槍 | T0 | 2026-07-03 | unknown |
| `team-intro-10` / 0 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0.5 · 奸雄騎 | T0.5 | 2026-07-03 | unknown |
| `team-intro-11` / 0 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0 · 富貴騎 | T0 | 2026-07-03 | unknown |
| `team-intro-14` / 0 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0.5 · 遼姬騎 | T0.5 | 2026-07-03 | unknown |
| `team-intro-16` / 0 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0.5 · 吳騎 | T0.5 | 2026-07-03 | unknown |
| `team-intro-17` / 0 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0 · 等風熊 | T0 | 2026-07-03 | unknown |
| `team-intro-2` / 0 | video-260701 · T0 · 皇冠枪 | T0 | 2026-07-03 | unknown |
| `team-intro-2` / 1 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0 · 皇冠槍 | T0 | 2026-07-03 | unknown |
| `team-intro-21` / 0 | video-260701 · T0 · 麒麟弓 | T0 | 2026-07-03 | unknown |
| `team-intro-21` / 1 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0 · 盛氣蜀弓 | T0 | 2026-07-03 | unknown |
| `team-intro-22` / 0 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0 · 嘟嘟弓(sp周瑜) | T0 | 2026-07-03 | unknown |
| `team-intro-26` / 0 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0.5 · 虎臣弓 | T0.5 | 2026-07-03 | unknown |
| `team-intro-27` / 0 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0.5 · 慷慨弓 | T0.5 | 2026-07-03 | unknown |
| `team-intro-32` / 0 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0 · sp周瑜弓 | T0 | 2026-07-03 | unknown |
| `team-intro-33` / 0 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0 · 溫侯弓-by大米 | T0 | 2026-07-03 | unknown |
| `team-intro-37` / 0 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0.5 · 飛熊都督 | T0.5 | 2026-07-03 | unknown |
| `team-intro-38` / 0 | video-260701 · T0 · 群弓 | T0 | 2026-07-03 | unknown |
| `team-intro-38` / 1 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0 · 群弓 | T0 | 2026-07-03 | unknown |
| `team-intro-40` / 0 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0 · 關星盾 | T0 | 2026-07-03 | unknown |
| `team-intro-42` / 0 | video-260701 · T0 · 太尉盾 | T0 | 2026-07-03 | unknown |
| `team-intro-42` / 1 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0 · 太尉盾 | T0 | 2026-07-03 | unknown |
| `team-intro-44` / 0 | video-260701 · T0 · 山河盾 | T0 | 2026-07-03 | unknown |
| `team-intro-44` / 1 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0 · 山河盾 | T0 | 2026-07-03 | unknown |
| `team-intro-45` / 0 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0.5 · 桃園盾 | T0.5 | 2026-07-03 | unknown |
| `team-intro-46` / 0 | video-260701 · T0 · 三仙盾 | T0 | 2026-07-03 | unknown |
| `team-intro-46` / 1 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0 · 仙人盾-by大米 | T0 | 2026-07-03 | unknown |
| `team-intro-46` / 2 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0.5 · 三仙盾 | T0.5 | 2026-07-03 | unknown |
| `team-intro-47` / 0 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0 · 張飛盾(潛龍) | T0 | 2026-07-03 | unknown |
| `team-intro-48` / 0 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0.5 · 墩墩盾 | T0.5 | 2026-07-03 | unknown |
| `team-intro-49` / 0 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0.5 · 詩詩盾 | T0.5 | 2026-07-03 | unknown |
| `team-intro-50` / 0 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0 · 法關盾(劉備) | T0 | 2026-07-03 | unknown |
| `team-intro-51` / 0 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0 · 法關盾(馬岱) | T0 | 2026-07-03 | unknown |
| `team-intro-52` / 0 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0 · 冠軍槍 | T0 | 2026-07-03 | unknown |
| `team-intro-53` / 0 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0 · 太師弓 | T0 | 2026-07-03 | unknown |
| `team-intro-54` / 0 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0.5 · 拒馬弓 | T0.5 | 2026-07-03 | unknown |
| `team-intro-55` / 0 | video-260701 · T0 · 天公盾 | T0 | 2026-07-07 | unknown |
| `team-intro-6` / 0 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0 · 網紅槍 | T0 | 2026-07-03 | unknown |
| `team-intro-7` / 0 | sangokushi.zeabur.app PK-S26 Anh Hùng Mệnh Thế · T0.5 · 北伐槍 | T0.5 | 2026-07-03 | unknown |

## Legacy Cùng Tồn inventory

| Record ID | Group locator | Fingerprint | Scope |
|---|---:|---|---|
| `coexist-legacy-group-c62cde93620f` | 0 | `sha256:92cfb10a127be7a2f2ca0744a5ba8084585ea67983c6367b11b41f9cde54ec28` | unknown |
| `coexist-legacy-group-7ca78ac0417f` | 1 | `sha256:1621e16d3370c330a673e5996bb9508b4deb44ddf896a5aad8c8496ef989bdba` | unknown |
| `coexist-legacy-group-6cfa058cec1a` | 2 | `sha256:b4415018bf1ac1dd0602a4620d7863c444e90c1f5416df99d2686834ad8dcde5` | unknown |
| `coexist-legacy-group-f5e839013060` | 3 | `sha256:db08a9fa085976d8ab2e99cc6f11841f5bf16ecf2fc6d18cfcb4f32a17c710ab` | unknown |
| `coexist-legacy-group-7f693e27576d` | 4 | `sha256:eab8f334dc5bfd8e8e8f825b6dcd30f4296246dccdb5e0c0ac5f4c6664ceceb5` | unknown |

## New source-owned team inventory

All source teams are Binh Diễn Xuân Thu references with unknown ruleset. Raw identities/conditions are not executable configurations.

| Record ID | Team | CSV records | Scope |
|---|---|---|---|
| `coexist-bdx-team-812399d9aa5f` | Hoàng Mã Thương | 6-8 | scenario reference |
| `coexist-bdx-team-6eb6c71f7c01` | 40 Lữ Điêu Lô | 9-11 | scenario reference |
| `coexist-bdx-team-3143cd908240` | Tinh Thái Pháp Quan Khiên | 12-14 | scenario reference |
| `coexist-bdx-team-7f93f0abf96b` | Ngũ Mưu Kỵ | 15-17 | scenario reference |
| `coexist-bdx-team-0ffb705acb30` | Ngô Kỵ | 18-20 | scenario reference |
| `coexist-bdx-team-42e02a0cdbf8` | Thái Sư Cung | 25-27 | scenario reference |
| `coexist-bdx-team-c38baeff86ee` | Ngô Nữ Kỵ | 28-30 | scenario reference |
| `coexist-bdx-team-abc3404b54b8` | Mã Đại Pháp Quan Khiên | 31-33 | scenario reference |
| `coexist-bdx-team-bd7dd2caf602` | Đô Đốc Cung | 34-36 | scenario reference |
| `coexist-bdx-team-e33c6a7c1f2a` | Trương Quan Hoàng | 37-39 | scenario reference |
| `coexist-bdx-team-7ed160068b76` | Thục Trí Cung | 44-46 | scenario reference |
| `coexist-bdx-team-a82493b2368b` | 40 Lữ Đổng Điêu | 47-49 | scenario reference |
| `coexist-bdx-team-dbda5f0edca7` | Thái Úy Khiên | 50-52 | scenario reference |
| `coexist-bdx-team-67350de20f8d` | Bắc Phạt Thương | 53-55 | scenario reference |
| `coexist-bdx-team-c2a441543089` | Quyền Kỵ | 56-58 | scenario reference |
| `coexist-bdx-team-771245d888b6` | Hạch Đạn Trương Phi Cung | 62-64 | scenario reference |
| `coexist-bdx-team-ed01d0bd3f2f` | Bắc Phạt Khiên | 65-67 | scenario reference |
| `coexist-bdx-team-f59e614967ac` | Ôn Hầu Quần Cung | 68-70 | scenario reference |
| `coexist-bdx-team-023c064a2244` | Ngũ Mưu Bạch Nhị Cung/ Hổ Báo Kỵ | 71-73 | scenario reference |
| `coexist-bdx-team-3b30045c3639` | Thái Úy Khiên | 74-76 | scenario reference |
| `coexist-bdx-team-3addf4cb98be` | Khảng Khái Cung | 80-82 | scenario reference |
| `coexist-bdx-team-3da33aede25f` | Lữ Quách Kiều Cung | 83-85 | scenario reference |
| `coexist-bdx-team-c2b6bd792653` | Liêu Kiều Thương | 86-88 | scenario reference |
| `coexist-bdx-team-f783f33d8655` | Tuân Du Ngũ Mưu Kỵ | 89-91 | scenario reference |
| `coexist-bdx-team-e583a9594edc` | Đào Viên Khiên | 92-94 | scenario reference |

## Preservation and unresolved questions

All nine original SHA-256 values match `execution-baseline.json`. Private SGSDeck boundary and prior test edits are preserved. No `build_json`, network, commit, deploy or plan-status mutation.

Unknown: VN rulesets, annotated/decorated canonical alternatives, conditional semantics and reviewed score applicability. Controller owns final combined build/dist/Node/Python and consumer parity gates.
