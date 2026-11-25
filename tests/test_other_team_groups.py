"""Khóa team (bộ 3 tướng + binh chủng), cờ đủ dữ liệu, thứ tự phương án và bất biến ``teamGroups`` của Đội khác."""
import copy
import unittest

from pipeline.other_team_groups import (annotate_other_teams, data_complete, local_merge_key, team_group_id,
                                        team_group_key, validate_team_groups)


def holder(hero, tactics=("t1", "t2"), books=("b1",)):
    return {"heroIdentityId": hero, "tacticIdentityIds": list(tactics), "tacticSlotsRaw": list(tactics),
            "bookSlotsRaw": list(books)}


def row(team_id, heroes=("h1", "h2", "h3"), unit=("Cung",), recommended=False, **holder_overrides):
    holders = [holder(hero, **holder_overrides.get(hero, {})) for hero in heroes]
    return {"legacyTeamId": team_id, "legacyVariantId": "v-" + team_id, "holders": holders, "unit": list(unit),
            "recommended": recommended}


class TeamGroupKeyTest(unittest.TestCase):
    def test_hero_order_does_not_matter_unit_does(self):
        self.assertEqual(team_group_key(row("a")), team_group_key(row("b", heroes=("h3", "h1", "h2"))))
        self.assertNotEqual(team_group_key(row("a")), team_group_key(row("c", unit=("Kỵ",))))

    def test_two_units_is_its_own_unit_and_order_insensitive(self):
        both = team_group_key(row("a", unit=("Kỵ", "Cung")))
        self.assertEqual(both, team_group_key(row("b", unit=("Cung", "Kỵ"))))
        self.assertNotEqual(both, team_group_key(row("c", unit=("Kỵ",))))
        self.assertNotEqual(both, team_group_key(row("d", unit=("Cung",))))

    def test_missing_unit_is_explicit(self):
        self.assertTrue(team_group_key(row("a", unit=())).endswith("|unit:?"))

    def test_missing_identity_is_an_error(self):
        broken = row("a")
        broken["holders"][0]["heroIdentityId"] = ""
        with self.assertRaises(ValueError):
            team_group_key(broken)


class DataCompleteTest(unittest.TestCase):
    def test_complete_needs_two_tactics_and_a_book_for_each_of_three_heroes(self):
        self.assertTrue(data_complete(row("a")))
        self.assertFalse(data_complete(row("b", h2={"tactics": ("t1",)})))
        self.assertFalse(data_complete(row("c", h3={"books": ()})))
        self.assertFalse(data_complete(row("d", h1={"books": ("",)})))
        two = row("e")
        two["holders"] = two["holders"][:2]
        self.assertFalse(data_complete(two))


class LocalMergeKeyTest(unittest.TestCase):
    def test_books_and_unit_separate_configurations(self):
        base = local_merge_key(row("a"))
        self.assertNotEqual(base, local_merge_key(row("b", h1={"books": ("b2",)})))
        self.assertNotEqual(base, local_merge_key(row("c", unit=("Kỵ",))))

    def test_sub_book_order_and_hero_order_do_not_matter(self):
        a = row("a", h1={"books": ("b1", "b2", "b3")})
        b = row("b", heroes=("h2", "h3", "h1"), h1={"books": ("b1", "b3", "b2")})
        self.assertEqual(local_merge_key(a), local_merge_key(b))

    def test_main_book_change_is_a_new_configuration(self):
        a = row("a", h1={"books": ("b1", "b2", "b3")})
        b = row("b", h1={"books": ("b2", "b1", "b3")})
        self.assertNotEqual(local_merge_key(a), local_merge_key(b))


class AnnotateTest(unittest.TestCase):
    def setUp(self):
        self.rows = [
            row("youtube-1", recommended=True, h1={"books": ()}),     # Đề cử nhưng thiếu binh thư
            row("youtube-2", recommended=True, h1={"tactics": ("t1", "t3")}),
            row("team-intro-1"),
            row("moi-phe-1", heroes=("h4", "h5", "h6"), h4={"books": ()}),
            row("moi-phe-2", unit=("Kỵ",)),
        ]

    def test_fields_rank_and_groups(self):
        records, groups = annotate_other_teams(self.rows)
        by_id = {item["legacyTeamId"]: item for item in records}
        self.assertEqual([item["optionRank"] for item in records], [0, 1, 2, 3, 4])
        self.assertEqual(by_id["youtube-1"]["teamGroupId"], by_id["team-intro-1"]["teamGroupId"])
        self.assertNotEqual(by_id["moi-phe-2"]["teamGroupId"], by_id["team-intro-1"]["teamGroupId"])
        self.assertFalse(by_id["youtube-1"]["dataComplete"])
        group = next(g for g in groups if g["teamGroupId"] == by_id["youtube-1"]["teamGroupId"])
        self.assertEqual(group["memberVariantIds"], ["v-youtube-1", "v-youtube-2", "v-team-intro-1"])
        self.assertEqual(group["completeVariantIds"], ["v-youtube-2", "v-team-intro-1"])
        self.assertEqual(group["representativeVariantId"], "v-youtube-2")
        incomplete = next(g for g in groups if g["teamGroupId"] == by_id["moi-phe-1"]["teamGroupId"])
        self.assertIsNone(incomplete["representativeVariantId"])
        validate_team_groups(records, groups)

    def test_input_rows_are_not_mutated(self):
        before = copy.deepcopy(self.rows)
        annotate_other_teams(self.rows)
        self.assertEqual(self.rows, before)

    def test_one_variant_per_legacy_team(self):
        duplicate = self.rows + [{**self.rows[0], "legacyVariantId": "v-other"}]
        with self.assertRaises(ValueError):
            annotate_other_teams(duplicate)


class SlotAlignmentTest(unittest.TestCase):
    def test_blank_slot_before_filled_one_is_rejected(self):
        for field, value in (("tacticSlotsRaw", ["", "t2"]), ("bookSlotsRaw", ["", "b1"])):
            broken = row("a")
            broken["holders"][0][field] = value
            with self.assertRaises(ValueError):
                annotate_other_teams([broken])

    def test_trailing_blank_slots_are_fine(self):
        ok = row("a", h1={"books": ("b1", "", "")})
        annotate_other_teams([ok])

    def test_tactic_identities_must_match_filled_slots(self):
        broken = row("a")
        broken["holders"][1]["tacticIdentityIds"] = ["t1"]
        with self.assertRaises(ValueError):
            annotate_other_teams([broken])


class ValidateTeamGroupsTest(unittest.TestCase):
    def setUp(self):
        self.records, self.groups = annotate_other_teams([row("a"), row("b", h1={"books": ()}), row("c", unit=("Kỵ",))])

    def broken(self, mutate):
        records, groups = copy.deepcopy(self.records), copy.deepcopy(self.groups)
        mutate(records, groups)
        with self.assertRaises(ValueError):
            validate_team_groups(records, groups)

    def test_record_outside_any_group(self):
        self.broken(lambda r, g: r[0].update(teamGroupId="g-0000000000000000"))

    def test_members_differ_from_records(self):
        self.broken(lambda r, g: g[0]["memberVariantIds"].pop())

    def test_group_id_not_hash_of_key(self):
        self.broken(lambda r, g: g[0].update(teamGroupKey=g[0]["teamGroupKey"] + "x"))

    def test_complete_set_differs_from_flags(self):
        self.broken(lambda r, g: g[0]["completeVariantIds"].append("v-b"))

    def test_representative_must_be_complete(self):
        self.broken(lambda r, g: g[0].update(representativeVariantId="v-b"))

    def test_representative_required_when_group_has_complete_member(self):
        self.broken(lambda r, g: g[0].update(representativeVariantId=None))

    def test_duplicate_group_is_rejected(self):
        self.broken(lambda r, g: g.append(copy.deepcopy(g[0])))

    def test_record_key_must_match_its_holders_and_unit(self):
        def forge(r, g):
            # Khóa giả nhưng id vẫn khớp hash của khóa giả: chỉ kiểm khóa theo tướng + binh chủng thật mới bắt được.
            forged = r[0]["teamGroupKey"].replace("|unit:Cung", "|unit:Kỵ")
            r[0].update(teamGroupKey=forged, teamGroupId=team_group_id(forged))
        self.broken(forge)


if __name__ == "__main__":
    unittest.main()
