"""Tests for the frozen team route handle ledger and its generator/validator."""

from __future__ import annotations

import contextlib
import hashlib
import io
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from pipeline.team_route_handles import (
    DEFAULT_DISPLAY_MAP_PATH,
    DEFAULT_GENERATION_ROOT,
    DEFAULT_KHAIHOANG_PATH,
    DEFAULT_LEDGER_PATH,
    DEFAULT_TEAMS_PATH,
    LEDGER_NOTE,
    LEDGER_SCHEMA_VERSION,
    PUBLICATION_SCHEMA_VERSION,
    TeamRouteHandleError,
    build_khaihoang_handles,
    build_ledger,
    build_legacy_handles,
    build_recommended_handles,
    is_routable_identifier,
    ledger_bytes,
    main,
    read_publication,
    season_code,
    sha256_hex,
    slug,
    validate_ledger,
)

FIXTURE_GENERATION_ID = "0123456789abcdef" * 4
LABELS = {"魏": "Ngụy", "蜀": "Thục", "吳": "Ngô", "群": "Quần", "混": "Hỗn hợp"}

# The reviewed outcomes of the eight ambiguous (season, base) groups documented for the pinned
# generation; every row of the table is reproduced here so a mis-keyed grouping cannot pass.
DOCUMENTED_AMBIGUOUS_GROUPS = {
    "pk-s11-do-doc-cung": {"s11-wu-dudu-gong": "do-doc-cung", "s11-wu-dudu-zhuanyou": "do-doc-cung-chuyen-huu"},
    "pk-s25-hoang-ma": {"s25-huangma-qun": "hoang-ma", "s25-huangma-hun": "hoang-ma-hon-hop"},
    "pk-s25-on-hau-cung": {"s25-wenhou-gong-hun": "on-hau-cung", "s25-wenhou-gong": "on-hau-cung-quan"},
    "pk-s26-don-don-thuan": {"s26-dundun-dun": "don-don-thuan", "yxms-031-惇惇盾": "don-don-thuan-yxms-031"},
    "pk-s27-hoang-ma": {"s27-huangma-hun": "hoang-ma-hon-hop", "s27-huangma-qun": "hoang-ma"},
    "pk-s27-on-hau-cung": {"s27-wenhou-gong-hun": "on-hau-cung", "s27-wenhou-gong-qun": "on-hau-cung-quan"},
    "pk-s28-hoang-ma": {"s28-huangma-hun": "hoang-ma-hon-hop", "s28-huangma-qun": "hoang-ma"},
    "pk-s28-on-hau-cung": {"s28-wenhou-gong-hun": "on-hau-cung", "s28-wenhou-gong": "on-hau-cung-quan"},
}


def recommended_row(source_config_id, display_name_vi, *, season="PK-S1", tier=0, value=100, index=0, faction="群"):
    return {
        "sourceConfigId": source_config_id,
        "displayNameVi": display_name_vi,
        "sourceSeasonCode": season,
        "tierOrder": tier,
        "value": value,
        "listIndex": index,
        "factionRaw": faction,
    }


def canonical(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def write_teams(path, teams):
    data = (json.dumps(teams, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    Path(path).write_bytes(data)
    return data


def khaihoang_team(title, **overrides):
    """The data owner assigns `id` as the ASCII slug of the current title; tests do the same."""
    return {"id": slug(title), "title": title, **overrides}


KHAIHOANG_TEAMS = (
    khaihoang_team("Gia Cát Khác · SP Mã Siêu · Pháp Chính"),
    khaihoang_team("Quan Ngân Bình · Nhạc Tiến"),
    khaihoang_team("Trương Xuân Hoa · Lữ Bố · Tả Từ"),
)


def write_khaihoang(path, teams):
    data = (json.dumps({"teams": list(teams)}, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    Path(path).write_bytes(data)
    return data


def write_publication(root, records, *, generation_id=FIXTURE_GENERATION_ID, other_teams=()):
    root = Path(root)
    generation = root / generation_id
    generation.mkdir(parents=True, exist_ok=True)
    payloads = {
        "index.json": {"schemaVersion": 1, "records": list(records)},
        "other-teams.json": {"schemaVersion": 1, "records": list(other_teams)},
        "seasons.json": {"schemaVersion": 1, "seasons": []},
    }
    files = {}
    for name, value in sorted(payloads.items()):
        data = canonical(value)
        (generation / name).write_bytes(data)
        files[name] = {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    manifest = {
        "schemaVersion": 1,
        "generationId": generation_id,
        "dedupKeyVersion": 1,
        "files": files,
        "allowedScopeKeys": [],
    }
    manifest_bytes = canonical(manifest)
    (generation / "manifest.json").write_bytes(manifest_bytes)
    (root / "current.json").write_bytes(canonical({
        "schemaVersion": 1,
        "generationId": generation_id,
        "manifestSha256": hashlib.sha256(manifest_bytes).hexdigest(),
    }))
    return root


def rewrite_index(root, records):
    """Replace index.json in a publication copy and refresh every hash that pins it."""
    root = Path(root)
    generation = root / json.loads((root / "current.json").read_bytes())["generationId"]
    data = canonical({"schemaVersion": 1, "records": list(records)})
    (generation / "index.json").write_bytes(data)
    manifest = json.loads((generation / "manifest.json").read_bytes())
    manifest["files"]["index.json"] = {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    manifest_bytes = canonical(manifest)
    (generation / "manifest.json").write_bytes(manifest_bytes)
    selector = json.loads((root / "current.json").read_bytes())
    selector["manifestSha256"] = hashlib.sha256(manifest_bytes).hexdigest()
    (root / "current.json").write_bytes(canonical(selector))


def run_cli(argv):
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = main(argv)
    return code, out.getvalue(), err.getvalue()


class SlugTest(unittest.TestCase):
    def test_slug_folds_vietnamese_diacritics_and_d_stroke(self):
        self.assertEqual(slug("Đô Đốc Cung"), "do-doc-cung")
        self.assertEqual(slug("  Ôn Hầu Cung（Tả Từ） "), "on-hau-cung-ta-tu")
        self.assertEqual(slug("Liêu Cơ Kỵ(Tào Tháo bản)"), "lieu-co-ky-tao-thao-ban")
        self.assertEqual(slug("惇惇盾"), "")


class RecommendedHandleRuleTest(unittest.TestCase):
    def build(self, rows):
        return build_recommended_handles(rows, LABELS)

    def test_unique_group_keeps_the_plain_name_slug(self):
        handles, stats = self.build([recommended_row("s1-a", "Tiềm Long Điêu Thuyền")])
        self.assertEqual(handles, {"s1-a": "tiem-long-dieu-thuyen"})
        self.assertEqual(stats["collisionGroups"], 0)
        self.assertEqual(stats["taggedRows"], 0)

    def test_collision_groups_are_keyed_by_season_and_base(self):
        handles, stats = self.build([
            recommended_row("s1-a", "Đội A", season="PK-S1"),
            recommended_row("s2-a", "Đội A", season="PK-S2"),
        ])
        self.assertEqual(handles, {"s1-a": "doi-a", "s2-a": "doi-a"})
        self.assertEqual(stats["collisionGroups"], 0)
        self.assertEqual(stats["groupKeys"], 2)

    def test_parenthetical_rows_tag_from_the_first_comma_segment(self):
        handles, _ = self.build([
            recommended_row("s1-a", "Đội A (Vương Dị, Pháp Chính)", tier=0),
            recommended_row("s1-b", "Đội A（Tinh·Tiên Đăng）", tier=1),
            recommended_row("s1-c", "Đội A", tier=2),
        ])
        self.assertEqual(handles, {
            "s1-a": "doi-a-vuong-di",
            "s1-b": "doi-a-tinh-tien-dang",
            "s1-c": "doi-a",
        })

    def test_mixed_faction_group_tags_the_lower_ranked_row_with_its_faction_label(self):
        handles, _ = self.build([
            recommended_row("s1-qun", "Hoàng Mã", tier=0, faction="群", index=5),
            recommended_row("s1-hun", "Hoàng Mã", tier=0, faction="混", index=6),
        ])
        self.assertEqual(handles, {"s1-qun": "hoang-ma", "s1-hun": "hoang-ma-hon-hop"})

    def test_mixed_faction_winner_ignores_a_lower_ranked_non_mixed_row(self):
        handles, _ = self.build([
            recommended_row("s1-hun", "Ôn Hầu Cung", tier=0, faction="混", index=1),
            recommended_row("s1-qun", "Ôn Hầu Cung", tier=3, faction="群", index=63),
        ])
        self.assertEqual(handles, {"s1-hun": "on-hau-cung", "s1-qun": "on-hau-cung-quan"})

    def test_same_faction_group_tags_from_the_shared_id_delta(self):
        handles, _ = self.build([
            recommended_row("s1-wu-dudu-gong", "Đô Đốc Cung", index=25),
            recommended_row("s1-wu-dudu-zhuanyou", "Đô Đốc Cung", index=26),
        ])
        self.assertEqual(handles, {
            "s1-wu-dudu-gong": "do-doc-cung",
            "s1-wu-dudu-zhuanyou": "do-doc-cung-chuyen-huu",
        })

    def test_empty_delta_tags_the_plain_row_as_goc(self):
        handles, _ = self.build([
            recommended_row("s1-alpha", "Đội A", index=5),
            recommended_row("s1-alpha-2", "Đội A", index=0),
        ])
        self.assertEqual(handles, {"s1-alpha": "doi-a-goc", "s1-alpha-2": "doi-a"})

    def test_non_ascii_delta_falls_back_to_the_ascii_source_id(self):
        handles, _ = self.build([
            recommended_row("s1-alpha", "Đôn Đôn Thuẫn", tier=0, index=0),
            recommended_row("yxms-031-惇惇盾", "Đôn Đôn Thuẫn", tier=2, index=85),
        ])
        self.assertEqual(handles, {
            "s1-alpha": "don-don-thuan",
            "yxms-031-惇惇盾": "don-don-thuan-yxms-031",
        })

    def test_handle_repeating_its_own_season_code_drops_the_prefix(self):
        handles, _ = self.build([
            recommended_row("s3-wei-s3-dingpei-sima", "S3 Tư Mã cấu hình tối ưu", season="S3"),
        ])
        self.assertEqual(handles, {"s3-wei-s3-dingpei-sima": "tu-ma-cau-hinh-toi-uu"})

    def test_colliding_rows_without_ranking_fields_fail_loudly(self):
        rows = [
            recommended_row("s1-a", "Đội A"),
            {**recommended_row("s1-b", "Đội A"), "tierOrder": None},
        ]
        with self.assertRaises(TeamRouteHandleError) as error:
            self.build(rows)
        self.assertIn("s1-b", str(error.exception))
        self.assertIn("tierOrder", str(error.exception))

    def test_group_tag_collision_fails_loudly(self):
        rows = [
            recommended_row("s1-hun", "Đội A", tier=0, faction="混", index=0),
            recommended_row("s1-qun-a", "Đội A", tier=1, faction="群", index=1),
            recommended_row("s1-qun-b", "Đội A", tier=2, faction="群", index=2),
        ]
        with self.assertRaises(TeamRouteHandleError) as error:
            self.build(rows)
        self.assertIn("doi-a-quan", str(error.exception))

    def test_generated_handles_are_deterministic(self):
        rows = [
            recommended_row("s1-wu-dudu-gong", "Đô Đốc Cung", index=25),
            recommended_row("s1-wu-dudu-zhuanyou", "Đô Đốc Cung", index=26),
            recommended_row("s1-alpha", "Đội A (Vương Dị, Pháp Chính)", tier=1),
            recommended_row("s1-alpha-plain", "Đội A", tier=2),
        ]
        first, first_stats = self.build(rows)
        second, second_stats = self.build(list(reversed(rows)))
        self.assertEqual(first, second)
        self.assertEqual(first_stats, second_stats)
        self.assertEqual(first_stats["collisionGroups"], 2)
        self.assertEqual(first_stats["taggedRows"], 2)


class LegacyHandleRuleTest(unittest.TestCase):
    def test_unique_team_uses_the_vietnamese_label(self):
        handles, stats = build_legacy_handles([{"id": "team-intro-0", "nickname": "Vinh Quang Thương", "name": "Úc Liêu Cơ"}])
        self.assertEqual(handles, {"team-intro-0": "vinh-quang-thuong"})
        self.assertEqual(stats["collisionGroups"], 0)

    def test_duplicate_labels_tag_from_the_numeric_id_suffix(self):
        handles, stats = build_legacy_handles([
            {"id": "team-intro-23", "nickname": "Đỗ Tử Mộng", "name": "Đỗ Tử Mộng"},
            {"id": "moi-phe-122", "nickname": "Đỗ Tử Mộng", "name": "Đỗ Tử Mộng"},
        ])
        self.assertEqual(handles, {"team-intro-23": "do-tu-mong-23", "moi-phe-122": "do-tu-mong-122"})
        self.assertEqual(stats["collisionGroups"], 1)
        self.assertEqual(stats["taggedRows"], 2)

    def test_name_is_used_when_the_nickname_is_empty(self):
        handles, _ = build_legacy_handles([{"id": "moi-phe-1", "nickname": "", "name": "Hổ Thần Cung"}])
        self.assertEqual(handles, {"moi-phe-1": "ho-than-cung"})

    def test_duplicate_label_without_a_numeric_suffix_fails_loudly(self):
        with self.assertRaises(TeamRouteHandleError) as error:
            build_legacy_handles([
                {"id": "team-intro", "nickname": "Đỗ Tử Mộng", "name": "Đỗ Tử Mộng"},
                {"id": "moi-phe-122", "nickname": "Đỗ Tử Mộng", "name": "Đỗ Tử Mộng"},
            ])
        self.assertIn("team-intro", str(error.exception))


class RoutableIdentifierTest(unittest.TestCase):
    """`isRoutableIdentifier` parity: ECMAScript whitespace, byte limit and dot edges."""

    def test_accepted_identifiers(self):
        accepted = [
            "do-doc-cung",
            "x.y",
            "a" * 128,
            "a" * 126 + "é",
            "đội-hình",
            "\u0085",          # NEL is not ECMAScript whitespace
            "\u180e",          # Mongolian vowel separator stopped being whitespace in Unicode 6.3
            "\u200b",          # zero width space
            "\u009f",          # C1 control: the contract only rejects C0 and DEL
            "quần-cung",
        ]
        for value in accepted:
            with self.subTest(value=value):
                self.assertTrue(is_routable_identifier(value))

    def test_rejected_identifiers(self):
        rejected = [
            "",
            "a" * 129,
            "a" * 127 + "é",   # 129 bytes
            ".hidden",
            "trailing.",
            ".",
            "with space",
            "tab\there",
            "\n",
            "\x00",
            "\x1f",
            "\x7f",
            "a/b",
            "a\\b",
            "a?b",
            "a#b",
            "a%b",
            "a:b",
            "a*b",
            'a"b',
            "a<b",
            "a>b",
            "a|b",
            "\u00a0",
            "\u1680",
            "\u2000",
            "\u2028",
            "\u2029",
            "\u202f",
            "\u205f",
            "\u3000",
            "\ufeff",          # ZWNBSP is ECMAScript whitespace
            7,
            None,
        ]
        for value in rejected:
            with self.subTest(value=repr(value)):
                self.assertFalse(is_routable_identifier(value))


class LedgerFixture(unittest.TestCase):
    """Shared fixture helpers: a small publication plus the ledger generated from it."""

    records = (
        recommended_row("s1-wu-dudu-gong", "Đô Đốc Cung", index=25),
        recommended_row("s1-wu-dudu-zhuanyou", "Đô Đốc Cung", index=26),
        recommended_row("s1-alpha", "Đội A (Vương Dị, Pháp Chính)", tier=1),
        recommended_row("s1-alpha-plain", "Đội A", tier=2),
        recommended_row("s2-solo", "Đội B", season="PK-S2"),
    )
    teams = (
        {"id": "team-intro-23", "nickname": "Đỗ Tử Mộng", "name": "Đỗ Tử Mộng"},
        {"id": "moi-phe-122", "nickname": "Đỗ Tử Mộng", "name": "Đỗ Tử Mộng"},
        {"id": "moi-phe-1", "nickname": "", "name": "Hổ Thần Cung"},
    )

    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.root, True)
        self.generation_root = write_publication(self.root / "recommended", self.records)
        self.teams_path = self.root / "teams.json"
        self.teams_bytes = write_teams(self.teams_path, self.teams)
        self.khaihoang_path = self.root / "khaihoang.json"
        self.khaihoang_bytes = write_khaihoang(self.khaihoang_path, KHAIHOANG_TEAMS)
        self.ledger_path = self.root / "team-route-handles.json"
        self.publication = read_publication(self.generation_root)

    def generated_ledger(self):
        recommended, _ = build_recommended_handles(self.records, LABELS)
        legacy, _ = build_legacy_handles(self.teams)
        khaihoang, _ = build_khaihoang_handles(KHAIHOANG_TEAMS)
        return build_ledger(
            self.publication.generation_id,
            self.teams_bytes,
            self.khaihoang_bytes,
            recommended,
            legacy,
            khaihoang,
        )

    def validate(self, ledger, *, khaihoang_bytes=None, khaihoang_teams=None):
        validate_ledger(
            ledger,
            generation_id=self.publication.generation_id,
            records=self.publication.records,
            teams_bytes=self.teams_bytes,
            teams=self.teams,
            khaihoang_bytes=self.khaihoang_bytes if khaihoang_bytes is None else khaihoang_bytes,
            khaihoang_teams=KHAIHOANG_TEAMS if khaihoang_teams is None else khaihoang_teams,
        )

    def argv(self, *extra):
        """Every CLI call is pinned to the fixture artifacts; extras override the pinned defaults."""
        return [
            "--generation-root", str(self.generation_root),
            "--teams", str(self.teams_path),
            "--khaihoang", str(self.khaihoang_path),
            "--ledger", str(self.ledger_path),
            *extra,
        ]


class LedgerValidatorTest(LedgerFixture):
    def test_generated_ledger_validates(self):
        ledger = self.generated_ledger()
        self.validate(ledger)
        self.assertEqual(ledger["schemaVersion"], LEDGER_SCHEMA_VERSION)
        self.assertEqual(ledger["note"], LEDGER_NOTE)
        self.assertEqual(ledger["legacyTeamsSha256"], "sha256:" + hashlib.sha256(self.teams_bytes).hexdigest())
        self.assertEqual(ledger["khaihoangSha256"], "sha256:" + hashlib.sha256(self.khaihoang_bytes).hexdigest())
        self.assertEqual(
            set(ledger),
            {"schemaVersion", "generationId", "legacyTeamsSha256", "khaihoangSha256", "note", "handles"},
        )

    def test_missing_recommended_key_fails(self):
        ledger = self.generated_ledger()
        del ledger["handles"]["recommended"]["s2-solo"]
        with self.assertRaises(TeamRouteHandleError) as error:
            self.validate(ledger)
        self.assertIn("s2-solo", str(error.exception))

    def test_extra_recommended_key_fails(self):
        ledger = self.generated_ledger()
        ledger["handles"]["recommended"]["s9-ghost"] = "ghost"
        with self.assertRaises(TeamRouteHandleError) as error:
            self.validate(ledger)
        self.assertIn("s9-ghost", str(error.exception))

    def test_missing_legacy_key_fails(self):
        ledger = self.generated_ledger()
        del ledger["handles"]["legacy"]["moi-phe-1"]
        with self.assertRaises(TeamRouteHandleError) as error:
            self.validate(ledger)
        self.assertIn("moi-phe-1", str(error.exception))

    def test_extra_legacy_key_fails(self):
        ledger = self.generated_ledger()
        ledger["handles"]["legacy"]["moi-phe-999"] = "ghost"
        with self.assertRaises(TeamRouteHandleError) as error:
            self.validate(ledger)
        self.assertIn("moi-phe-999", str(error.exception))

    def test_wrong_generation_fails(self):
        ledger = self.generated_ledger()
        ledger["generationId"] = "f" * 64
        with self.assertRaises(TeamRouteHandleError) as error:
            self.validate(ledger)
        self.assertIn("generationId", str(error.exception))

    def test_wrong_legacy_teams_hash_fails(self):
        ledger = self.generated_ledger()
        ledger["legacyTeamsSha256"] = "sha256:" + "0" * 64
        with self.assertRaises(TeamRouteHandleError) as error:
            self.validate(ledger)
        self.assertIn("legacyTeamsSha256", str(error.exception))

    def test_duplicate_final_segment_fails(self):
        ledger = self.generated_ledger()
        ledger["handles"]["recommended"]["s1-wu-dudu-zhuanyou"] = "do-doc-cung"
        with self.assertRaises(TeamRouteHandleError) as error:
            self.validate(ledger)
        self.assertIn("pk-s1-do-doc-cung", str(error.exception))

    def test_unroutable_handle_fails(self):
        ledger = self.generated_ledger()
        ledger["handles"]["recommended"]["s2-solo"] = "đội b"
        with self.assertRaises(TeamRouteHandleError) as error:
            self.validate(ledger)
        self.assertIn("routable", str(error.exception))

    def test_non_string_handle_fails(self):
        for group, key in (("recommended", "s2-solo"), ("legacy", "moi-phe-1")):
            ledger = self.generated_ledger()
            ledger["handles"][group][key] = 7
            with self.subTest(group=group):
                with self.assertRaises(TeamRouteHandleError) as error:
                    self.validate(ledger)
                self.assertIn("must be a string", str(error.exception))

    def test_handle_repeating_the_season_code_fails(self):
        ledger = self.generated_ledger()
        ledger["handles"]["recommended"]["s2-solo"] = "pk-s2-solo"
        with self.assertRaises(TeamRouteHandleError) as error:
            self.validate(ledger)
        self.assertIn("season code", str(error.exception))
        ledger["handles"]["recommended"]["s2-solo"] = "pk-s2"
        with self.assertRaises(TeamRouteHandleError) as error:
            self.validate(ledger)
        self.assertIn("season code", str(error.exception))

    def test_ledger_shape_is_enforced(self):
        ledger = self.generated_ledger()
        for broken in (
            {key: value for key, value in ledger.items() if key != "note"},
            {key: value for key, value in ledger.items() if key != "khaihoangSha256"},
            {**ledger, "extra": 1},
            {**ledger, "schemaVersion": PUBLICATION_SCHEMA_VERSION},
            {**ledger, "schemaVersion": 3},
            {**ledger, "khaihoangSha256": None},
            {**ledger, "handles": {"recommended": ledger["handles"]["recommended"]}},
            {**ledger, "handles": {"recommended": ledger["handles"]["recommended"], "legacy": ledger["handles"]["legacy"]}},
            {
                **ledger,
                "handles": {
                    "recommended": ledger["handles"]["recommended"],
                    "legacy": ledger["handles"]["legacy"],
                    "khaihoang": ledger["handles"]["khaihoang"],
                    "extra": {},
                },
            },
            {**ledger, "handles": {"recommended": [], "legacy": ledger["handles"]["legacy"], "khaihoang": ledger["handles"]["khaihoang"]}},
            {**ledger, "handles": {"recommended": ledger["handles"]["recommended"], "legacy": ledger["handles"]["legacy"], "khaihoang": []}},
        ):
            with self.subTest(broken=sorted(broken)):
                with self.assertRaises(TeamRouteHandleError):
                    self.validate(broken)

    def test_ledger_bytes_are_sorted_and_deterministic(self):
        ledger = self.generated_ledger()
        scrambled = dict(ledger)
        scrambled["handles"] = {
            family: dict(reversed(list(ledger["handles"][family].items())))
            for family in ("recommended", "legacy", "khaihoang")
        }
        self.assertEqual(ledger_bytes(scrambled), ledger_bytes(ledger))
        document = json.loads(ledger_bytes(ledger))
        for family in ("recommended", "legacy", "khaihoang"):
            self.assertEqual(list(document["handles"][family]), sorted(document["handles"][family]))
        self.assertTrue(ledger_bytes(ledger).endswith(b"\n"))


class LedgerCliTest(LedgerFixture):
    def test_write_then_check_round_trip(self):
        code, out, _ = run_cli(self.argv("--write"))
        self.assertEqual(code, 0, out)
        self.assertIn("wrote", out)
        written = self.ledger_path.read_bytes()
        self.assertEqual(written, ledger_bytes(self.generated_ledger()))

        code, out, err = run_cli(self.argv("--check"))
        self.assertEqual(code, 0, err)
        self.assertIn(self.publication.generation_id, out)
        self.assertEqual(self.ledger_path.read_bytes(), written)

    def test_repeated_write_is_a_byte_identical_no_op(self):
        argv = self.argv("--write")
        self.assertEqual(run_cli(argv)[0], 0)
        written = self.ledger_path.read_bytes()
        code, out, _ = run_cli(argv)
        self.assertEqual(code, 0)
        self.assertIn("no-op", out)
        self.assertEqual(self.ledger_path.read_bytes(), written)

    def test_write_refuses_to_reassign_an_existing_ledger(self):
        argv = self.argv("--write")
        self.assertEqual(run_cli(argv)[0], 0)
        frozen = json.loads(self.ledger_path.read_bytes())
        frozen["handles"]["recommended"]["s2-solo"] = "doi-b-renamed"
        self.ledger_path.write_bytes(ledger_bytes(frozen))
        edited = self.ledger_path.read_bytes()

        code, _, err = run_cli(argv)
        self.assertEqual(code, 1)
        self.assertIn("refusing to reassign", err)
        self.assertEqual(self.ledger_path.read_bytes(), edited)

    def test_check_fails_on_a_stale_manifest_hash(self):
        self.assertEqual(run_cli(self.argv("--write"))[0], 0)
        selector = json.loads((self.generation_root / "current.json").read_bytes())
        selector["manifestSha256"] = "0" * 64
        (self.generation_root / "current.json").write_bytes(canonical(selector))
        code, _, err = run_cli(self.argv("--check"))
        self.assertEqual(code, 1)
        self.assertIn("hash mismatch", err)

    def test_check_fails_when_a_generation_row_has_no_handle(self):
        self.assertEqual(run_cli(self.argv("--write"))[0], 0)
        rewrite_index(self.generation_root, [*self.records, recommended_row("s3-new", "Đội Mới", season="PK-S3")])
        code, _, err = run_cli(self.argv("--check"))
        self.assertEqual(code, 1)
        self.assertIn("s3-new", err)

    def test_check_is_translation_independent_on_a_collision_dissolving_copy(self):
        self.assertEqual(run_cli(self.argv("--write"))[0], 0)
        frozen_bytes = self.ledger_path.read_bytes()
        frozen = json.loads(frozen_bytes)

        copy = Path(shutil.copytree(self.generation_root, self.root / "copy"))
        mutated = [
            {**row, "displayNameVi": "Đô Đốc Cung Duy Nhất"} if row["sourceConfigId"] == "s1-wu-dudu-zhuanyou" else row
            for row in self.records
        ]
        rewrite_index(copy, mutated)

        code, out, err = run_cli(self.argv("--check", "--generation-root", str(copy), "--diagnose"))
        self.assertEqual(code, 0, err)
        self.assertEqual(self.ledger_path.read_bytes(), frozen_bytes)
        self.assertEqual(json.loads(self.ledger_path.read_bytes())["handles"], frozen["handles"])
        self.assertIn("name-derived", out)

        # The translation really does dissolve the group, so only the frozen ledger keeps the URL.
        candidate, _ = build_recommended_handles(read_publication(copy).records, LABELS)
        self.assertEqual(candidate["s1-wu-dudu-zhuanyou"], "do-doc-cung-duy-nhat")
        self.assertNotEqual(candidate["s1-wu-dudu-zhuanyou"], frozen["handles"]["recommended"]["s1-wu-dudu-zhuanyou"])
        self.assertIn("s1-wu-dudu-zhuanyou", out)

    def test_check_rejects_a_copy_with_stale_hashes(self):
        copy = Path(shutil.copytree(self.generation_root, self.root / "stale"))
        generation = copy / FIXTURE_GENERATION_ID
        data = canonical({"schemaVersion": 1, "records": [recommended_row("s1-renamed", "Đội Mới")]})
        (generation / "index.json").write_bytes(data)
        code, _, err = run_cli(self.argv("--check", "--generation-root", str(copy)))
        self.assertEqual(code, 1)
        self.assertIn("hash mismatch", err)

    def test_check_fails_when_the_ledger_is_absent(self):
        code, _, err = run_cli(self.argv("--check", "--ledger", str(self.root / "missing.json")))
        self.assertEqual(code, 1)
        self.assertTrue(err.strip())


class KhaiHoangOfflineContracts(LedgerFixture):
    """Offline gate for Khai hoang identity: ledger v2, injected source and frozen handles."""

    def test_handles_start_as_the_ascii_slug_of_the_current_title(self):
        handles, stats = build_khaihoang_handles(KHAIHOANG_TEAMS)
        self.assertEqual(handles, {team["id"]: slug(team["title"]) for team in KHAIHOANG_TEAMS})
        self.assertEqual(stats, {"keys": 3, "distinctHandles": 3})
        self.assertEqual(
            handles["gia-cat-khac-sp-ma-sieu-phap-chinh"],
            "gia-cat-khac-sp-ma-sieu-phap-chinh",
        )

    def test_ledger_v2_pins_the_khaihoang_source_while_the_publication_stays_v1(self):
        ledger = self.generated_ledger()
        self.validate(ledger)
        self.assertEqual(ledger["schemaVersion"], LEDGER_SCHEMA_VERSION)
        self.assertEqual(ledger["khaihoangSha256"], "sha256:" + hashlib.sha256(self.khaihoang_bytes).hexdigest())
        self.assertEqual(ledger["handles"]["khaihoang"], {team["id"]: team["id"] for team in KHAIHOANG_TEAMS})
        generation = self.generation_root / self.publication.generation_id
        versions = [
            json.loads((self.generation_root / "current.json").read_bytes())["schemaVersion"],
            json.loads((generation / "manifest.json").read_bytes())["schemaVersion"],
            json.loads((generation / "index.json").read_bytes())["schemaVersion"],
        ]
        self.assertEqual(versions, [PUBLICATION_SCHEMA_VERSION] * 3)

    def test_a_missing_or_repeated_source_id_is_rejected(self):
        for teams, expected in (
            ([{"title": "Đội A"}], "has no id"),
            ([{"id": "", "title": "Đội A"}], "has no id"),
            ([khaihoang_team("Đội A"), {"id": "doi-a", "title": "Đội A"}], "more than once"),
        ):
            with self.subTest(teams=teams):
                with self.assertRaises(TeamRouteHandleError) as error:
                    build_khaihoang_handles(teams)
                self.assertIn(expected, str(error.exception))

        duplicated = [*KHAIHOANG_TEAMS, {"id": KHAIHOANG_TEAMS[0]["id"], "title": "Bản sao"}]
        with self.assertRaises(TeamRouteHandleError) as error:
            self.validate(self.generated_ledger(), khaihoang_teams=duplicated)
        self.assertIn("more than once", str(error.exception))

    def test_duplicate_handles_from_titles_are_rejected(self):
        with self.assertRaises(TeamRouteHandleError) as error:
            build_khaihoang_handles([
                {"id": "doi-a-1", "title": "Đội A"},
                {"id": "doi-a-2", "title": "đội a"},
            ])
        self.assertIn("duplicate handles", str(error.exception))
        self.assertIn("doi-a-1", str(error.exception))
        self.assertIn("doi-a-2", str(error.exception))

    def test_missing_duplicate_or_unknown_handles_are_rejected(self):
        ledger = self.generated_ledger()
        del ledger["handles"]["khaihoang"]["quan-ngan-binh-nhac-tien"]
        with self.assertRaises(TeamRouteHandleError) as error:
            self.validate(ledger)
        self.assertIn("missing", str(error.exception))
        self.assertIn("quan-ngan-binh-nhac-tien", str(error.exception))

        ledger = self.generated_ledger()
        ledger["handles"]["khaihoang"]["doi-ghost"] = "doi-ghost"
        with self.assertRaises(TeamRouteHandleError) as error:
            self.validate(ledger)
        self.assertIn("unknown", str(error.exception))
        self.assertIn("doi-ghost", str(error.exception))

        ledger = self.generated_ledger()
        ledger["handles"]["khaihoang"]["quan-ngan-binh-nhac-tien"] = ledger["handles"]["khaihoang"][
            "gia-cat-khac-sp-ma-sieu-phap-chinh"
        ]
        with self.assertRaises(TeamRouteHandleError) as error:
            self.validate(ledger)
        self.assertIn("shared by", str(error.exception))
        self.assertIn("quan-ngan-binh-nhac-tien", str(error.exception))

    def test_unroutable_or_non_string_handles_are_rejected(self):
        for handle, expected in (("đội b", "not routable"), ("doi/a", "not routable"), ("", "not routable"), (7, "must be a string")):
            ledger = self.generated_ledger()
            ledger["handles"]["khaihoang"]["quan-ngan-binh-nhac-tien"] = handle
            with self.subTest(handle=handle):
                with self.assertRaises(TeamRouteHandleError) as error:
                    self.validate(ledger)
                self.assertIn(expected, str(error.exception))

    def test_a_khaihoang_source_hash_mismatch_is_rejected(self):
        ledger = self.generated_ledger()
        ledger["khaihoangSha256"] = "sha256:" + "0" * 64
        with self.assertRaises(TeamRouteHandleError) as error:
            self.validate(ledger)
        self.assertIn("khaihoangSha256", str(error.exception))

        shorter = write_khaihoang(self.root / "other-khaihoang.json", KHAIHOANG_TEAMS[:1])
        with self.assertRaises(TeamRouteHandleError) as error:
            self.validate(self.generated_ledger(), khaihoang_bytes=shorter, khaihoang_teams=KHAIHOANG_TEAMS[:1])
        self.assertIn("khaihoangSha256", str(error.exception))

    def test_a_title_edit_or_reorder_never_moves_a_frozen_handle(self):
        frozen = self.generated_ledger()
        reordered = [{**team, "title": f"{team['title']} · bản mới"} for team in reversed(KHAIHOANG_TEAMS)]
        data = write_khaihoang(self.khaihoang_path, reordered)
        candidate, _ = build_khaihoang_handles(reordered)
        for team in reordered:
            self.assertEqual(candidate[team["id"]], slug(team["title"]))
        self.assertNotEqual(candidate, frozen["handles"]["khaihoang"])

        ledger = {**frozen, "khaihoangSha256": "sha256:" + sha256_hex(data)}
        self.validate(ledger, khaihoang_bytes=data, khaihoang_teams=reordered)
        self.assertEqual(ledger["handles"]["khaihoang"], frozen["handles"]["khaihoang"])

    def test_a_ledger_that_only_differs_in_key_order_is_not_reassigned(self):
        ledger = self.generated_ledger()
        families = ledger["handles"]
        reordered = {
            **ledger,
            "handles": {
                "recommended": families["recommended"],
                "khaihoang": families["khaihoang"],
                "legacy": families["legacy"],
            },
        }
        self.ledger_path.write_bytes((json.dumps(reordered, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
        before = self.ledger_path.read_bytes()
        self.assertNotEqual(before, ledger_bytes(ledger))

        code, out, err = run_cli(self.argv("--write"))
        self.assertEqual(code, 0, err)
        self.assertIn("no-op", out)
        self.assertEqual(self.ledger_path.read_bytes(), before)

    def test_a_fixture_ledger_never_pins_the_repository_khaihoang_source(self):
        code, out, err = run_cli(self.argv("--write"))
        self.assertEqual(code, 0, err)
        self.assertIn("Khai hoang", out)
        ledger = json.loads(self.ledger_path.read_bytes())
        repository_hash = "sha256:" + sha256_hex(DEFAULT_KHAIHOANG_PATH.read_bytes())
        self.assertEqual(ledger["khaihoangSha256"], "sha256:" + sha256_hex(self.khaihoang_bytes))
        self.assertNotEqual(ledger["khaihoangSha256"], repository_hash)
        self.assertEqual(set(ledger["handles"]["khaihoang"]), {team["id"] for team in KHAIHOANG_TEAMS})

        code, out, err = run_cli(self.argv("--check"))
        self.assertEqual(code, 0, err)
        self.assertIn("Khai hoang handles: 3", out)

        # The fixture run never adopts the live file: the frozen fixture ledger cannot validate
        # against the repository source ...
        code, _, err = run_cli([
            "--check",
            "--generation-root", str(self.generation_root),
            "--teams", str(self.teams_path),
            "--ledger", str(self.ledger_path),
        ])
        self.assertEqual(code, 1)
        self.assertIn("--khaihoang", err)

        # ... and a ledger pinning the repository hash cannot validate against the fixture source.
        ledger = json.loads(self.ledger_path.read_bytes())
        ledger["khaihoangSha256"] = repository_hash
        self.ledger_path.write_bytes(ledger_bytes(ledger))
        code, _, err = run_cli(self.argv("--check"))
        self.assertEqual(code, 1)
        self.assertIn("khaihoangSha256", err)

    def test_custom_root_cli_requires_an_explicit_khaihoang_source_before_writing(self):
        code, _, err = run_cli([
            "--write",
            "--generation-root", str(self.generation_root),
            "--teams", str(self.teams_path),
            "--ledger", str(self.ledger_path),
        ])
        self.assertEqual(code, 1)
        self.assertIn("--khaihoang", err)
        self.assertFalse(self.ledger_path.exists())



class PinnedLedgerTest(unittest.TestCase):
    """The committed ledger against the pinned publication: generated, frozen, and routable."""

    @classmethod
    def setUpClass(cls):
        cls.publication = read_publication(DEFAULT_GENERATION_ROOT)
        cls.teams_bytes = DEFAULT_TEAMS_PATH.read_bytes()
        cls.teams = json.loads(cls.teams_bytes)
        cls.khaihoang_bytes = DEFAULT_KHAIHOANG_PATH.read_bytes()
        cls.khaihoang_teams = json.loads(cls.khaihoang_bytes)["teams"]
        cls.ledger = json.loads(DEFAULT_LEDGER_PATH.read_bytes())
        cls.labels = json.loads(DEFAULT_DISPLAY_MAP_PATH.read_bytes())["labels"]["faction"]

    def test_committed_ledger_validates_against_the_pinned_publication(self):
        validate_ledger(
            self.ledger,
            generation_id=self.publication.generation_id,
            records=self.publication.records,
            teams_bytes=self.teams_bytes,
            teams=self.teams,
            khaihoang_bytes=self.khaihoang_bytes,
            khaihoang_teams=self.khaihoang_teams,
        )

    def test_committed_ledger_has_the_documented_shape_and_counts(self):
        self.assertEqual(
            set(self.ledger),
            {"schemaVersion", "generationId", "legacyTeamsSha256", "khaihoangSha256", "note", "handles"},
        )
        self.assertEqual(self.ledger["schemaVersion"], LEDGER_SCHEMA_VERSION)
        self.assertEqual(self.ledger["generationId"], self.publication.generation_id)
        self.assertEqual(self.ledger["legacyTeamsSha256"], "sha256:" + hashlib.sha256(self.teams_bytes).hexdigest())
        self.assertEqual(self.ledger["khaihoangSha256"], "sha256:" + hashlib.sha256(self.khaihoang_bytes).hexdigest())
        self.assertEqual(len(self.ledger["handles"]["recommended"]), 1366)
        self.assertEqual(len(self.ledger["handles"]["legacy"]), 166)
        self.assertEqual(len(self.ledger["handles"]["khaihoang"]), 17)
        self.assertEqual(len(self.ledger["handles"]["khaihoang"]), len(self.khaihoang_teams))
        self.assertEqual(len(self.ledger["handles"]["recommended"]), len(self.publication.records))
        self.assertEqual(len(self.ledger["handles"]["legacy"]), len(self.teams))

    def test_committed_khaihoang_handles_cover_every_team_once_and_stay_routable(self):
        handles = self.ledger["handles"]["khaihoang"]
        self.assertEqual(set(handles), {team["id"] for team in self.khaihoang_teams})
        self.assertEqual(len(set(handles.values())), len(handles))
        for team_id, handle in handles.items():
            with self.subTest(team_id=team_id):
                self.assertTrue(is_routable_identifier(handle))
                self.assertNotEqual(handle, "")

    def test_committed_handles_are_routable_and_never_repeat_their_season(self):
        seasons = {row["sourceConfigId"]: season_code(row) for row in self.publication.records}
        for source_config_id, handle in self.ledger["handles"]["recommended"].items():
            with self.subTest(source_config_id=source_config_id):
                self.assertTrue(is_routable_identifier(handle))
                self.assertNotEqual(handle, "")
                season = seasons[source_config_id]
                self.assertNotEqual(handle, season)
                self.assertFalse(handle.startswith(season + "-"))
        for legacy_team_id, handle in self.ledger["handles"]["legacy"].items():
            with self.subTest(legacy_team_id=legacy_team_id):
                self.assertTrue(is_routable_identifier(handle))
                self.assertNotEqual(handle, "")

    def test_committed_ledger_is_exactly_what_the_current_inputs_generate(self):
        recommended, stats = build_recommended_handles(self.publication.records, self.labels)
        legacy, legacy_stats = build_legacy_handles(self.teams)
        khaihoang, khaihoang_stats = build_khaihoang_handles(self.khaihoang_teams)
        self.assertEqual(recommended, self.ledger["handles"]["recommended"])
        self.assertEqual(legacy, self.ledger["handles"]["legacy"])
        self.assertEqual(khaihoang, self.ledger["handles"]["khaihoang"])
        self.assertEqual(khaihoang_stats, {"keys": 17, "distinctHandles": 17})

        self.assertEqual(stats["keys"], 1366)
        self.assertEqual(stats["groupKeys"], 1264)
        self.assertEqual(stats["collisionGroups"], 83)
        self.assertEqual(stats["collisionRows"], 185)
        self.assertEqual(stats["taggedRows"], 166)
        self.assertEqual(stats["distinctHandles"], 638)
        self.assertEqual(stats["distinctSegments"], 1366)
        self.assertEqual(stats["averageSegmentLength"], 22.83)
        self.assertEqual(stats["maxSegmentLength"], 55)
        self.assertEqual(legacy_stats["keys"], 166)
        self.assertEqual(legacy_stats["collisionGroups"], 14)

    def test_committed_ledger_reproduces_the_documented_ambiguous_groups(self):
        for season, expected in DOCUMENTED_AMBIGUOUS_GROUPS.items():
            for source_config_id, handle in expected.items():
                with self.subTest(season=season, source_config_id=source_config_id):
                    self.assertEqual(self.ledger["handles"]["recommended"][source_config_id], handle)

    def test_pinned_check_is_read_only_and_translation_independent(self):
        before = DEFAULT_LEDGER_PATH.read_bytes()
        code, out, err = run_cli(["--check", "--diagnose"])
        self.assertEqual(code, 0, err)
        self.assertEqual(DEFAULT_LEDGER_PATH.read_bytes(), before)
        self.assertIn("0 recommended rows differ", out)

    def test_real_publication_copy_survives_a_collision_dissolving_translation(self):
        with tempfile.TemporaryDirectory() as workspace:
            copy = Path(workspace) / "recommended"
            shutil.copytree(DEFAULT_GENERATION_ROOT, copy)
            records = [dict(row) for row in self.publication.records]
            for row in records:
                if row["sourceConfigId"] == "s11-wu-dudu-zhuanyou":
                    row["displayNameVi"] = "Đô Đốc Cung Duy Nhất"
            rewrite_index(copy, records)

            before = DEFAULT_LEDGER_PATH.read_bytes()
            code, _, err = run_cli(["--check", "--generation-root", str(copy), "--khaihoang", str(DEFAULT_KHAIHOANG_PATH)])
            self.assertEqual(code, 0, err)
            self.assertEqual(DEFAULT_LEDGER_PATH.read_bytes(), before)

            candidate, _ = build_recommended_handles(read_publication(copy).records, self.labels)
            self.assertNotEqual(
                candidate["s11-wu-dudu-zhuanyou"],
                self.ledger["handles"]["recommended"]["s11-wu-dudu-zhuanyou"],
            )
            self.assertEqual(candidate["s11-wu-dudu-gong"], self.ledger["handles"]["recommended"]["s11-wu-dudu-gong"])

    def test_real_publication_copy_with_stale_hashes_is_rejected(self):
        with tempfile.TemporaryDirectory() as workspace:
            copy = Path(workspace) / "recommended"
            shutil.copytree(DEFAULT_GENERATION_ROOT, copy)
            generation = copy / self.publication.generation_id
            records = [dict(row) for row in self.publication.records]
            for row in records:
                if row["sourceConfigId"] == "s11-wu-dudu-zhuanyou":
                    row["displayNameVi"] = "Đô Đốc Cung Duy Nhất"
            (generation / "index.json").write_bytes(canonical({"schemaVersion": 1, "records": records}))
            code, _, err = run_cli(["--check", "--generation-root", str(copy), "--khaihoang", str(DEFAULT_KHAIHOANG_PATH)])
            self.assertEqual(code, 1)
            self.assertIn("hash mismatch", err)


if __name__ == "__main__":
    unittest.main()
