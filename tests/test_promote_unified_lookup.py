"""TDD pipeline/promote_unified_lookup.py — recoverable four-file activation.

Every case drives an isolated fixture project root plus a private candidate and a
staged activation manifest; the committed tree is never mutated. Ordering and
recovery are exercised with injection hooks, so "durability" here means observed
write ordering, not a real power-loss experiment.
"""

import fcntl
import hashlib
import json
import os
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from pipeline import promote_unified_lookup as promotion
from pipeline.lookup_translations import canonical_json_bytes

OWNED = ("heroes-dict.json", "tactics.json", "lookup-catalog.json", "lookup-manifest.json")
PAYLOADS = ("heroes-dict.json", "tactics.json", "lookup-catalog.json")
ACCEPT = lambda candidate: None  # noqa: E731 - deep candidate review is injected


class InjectedCrash(BaseException):
    """Simulated process death; production rollback handlers must not catch it."""


def sha(payload):
    return hashlib.sha256(payload).hexdigest()


def encode(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")


def bundle(heroes=("hero:a",), tactics=("tactic:a",)):
    payloads = {
        "heroes-dict.json": encode([{"id": name, "viet": f"Tướng {name[-1]}"} for name in heroes]),
        "tactics.json": encode([{"id": name, "viet": f"Chiến pháp {name[-1]}"} for name in tactics]),
        "lookup-catalog.json": encode({
            "schemaVersion": 1, "equipment": [], "specials": [], "advisors": [],
            "troopMods": [], "buildings": [],
        }),
    }
    files = {name: sha(payloads[name]) for name in PAYLOADS}
    payloads["lookup-manifest.json"] = encode({
        "schemaVersion": 1,
        "generationId": "lookup:" + sha(canonical_json_bytes(files)),
        "files": files,
    })
    return payloads


def write_candidate(directory, payloads):
    directory.mkdir(parents=True, exist_ok=True)
    for name, payload in payloads.items():
        (directory / name).write_bytes(payload)
    manifest = json.loads(payloads["lookup-manifest.json"])
    (directory / "generation.json").write_bytes(encode({
        "schemaVersion": 1, "generationId": manifest["generationId"], "outputHashes": manifest["files"],
    }))
    (directory / "ledger.json").write_bytes(encode([{"entityId": "hero:a", "disposition": "translated-public"}]))
    return directory


def write_project(root, activated=None, season_refs=("hero:a", "tactic:a")):
    (root / "data").mkdir(parents=True, exist_ok=True)
    (root / "js").mkdir(parents=True, exist_ok=True)
    (root / "pipeline" / "lookup-output").mkdir(parents=True, exist_ok=True)
    for name, payload in (activated or {
        "heroes-dict.json": encode([{"id": "hero:legacy", "viet": "Tướng cũ"}]),
        "tactics.json": encode([{"id": "tactic:legacy", "viet": "Chiến pháp cũ"}]),
    }).items():
        (root / "data" / name).write_bytes(payload)
    (root / "data" / "season-team-configs.json").write_bytes(encode([{
        "schemaVersion": 1, "id": "config-a",
        "heroSlots": [{
            "heroRefs": [ref for ref in season_refs if ref.startswith("hero:")],
            "tacticSlots": [{"tacticRefs": [ref for ref in season_refs if ref.startswith("tactic:")]}],
        }],
    }]))
    (root / "data" / "season-registry.json").write_bytes(encode([{"schemaVersion": 1, "id": "binh-dien-xuan-thu"}]))
    (root / "js" / "app.js").write_bytes(b"export const boot = 'g0';\n")
    return root


def write_activation(stage, root, app=b"export const boot = 'g1';\n", loader=b"export const validateLookupBundle = 1;\n", before=None, tamper=False):
    (stage / "js").mkdir(parents=True, exist_ok=True)
    (stage / "js" / "app.js").write_bytes(app)
    (stage / "js" / "lookup-data.js").write_bytes(loader)
    entries = [
        {"path": "js/lookup-data.js", "source": "js/lookup-data.js", "beforeHash": None, "afterHash": sha(loader)},
        {"path": "js/app.js", "source": "js/app.js",
         "beforeHash": before if before is not None else sha((root / "js" / "app.js").read_bytes()),
         "afterHash": sha(app)},
    ]
    if tamper:
        (stage / "js" / "app.js").write_bytes(b"staged bytes were tampered with\n")
    manifest = stage / "activation-manifest.json"
    manifest.write_bytes(encode({"schemaVersion": 1, "paths": entries}))
    return manifest


def snapshot(root, *kinds):
    files = {}
    for kind in kinds or ("data", "js"):
        for path in sorted((root / kind).rglob("*")):
            if path.is_file():
                files[str(path.relative_to(root))] = path.read_bytes()
    return files


class PromotionCase(unittest.TestCase):
    def temp_dir(self, prefix):
        directory = tempfile.TemporaryDirectory(prefix=prefix)
        self.addCleanup(directory.cleanup)
        return Path(directory.name)

    def scenario(self, activated=None, season_refs=("hero:legacy", "tactic:legacy"), payloads=None, **activation):
        root = write_project(self.temp_dir("tqccl-promote-root-"), activated=activated, season_refs=season_refs)
        candidate = write_candidate(self.temp_dir("tqccl-promote-candidate-") / "candidate", payloads or bundle())
        manifest = write_activation(self.temp_dir("tqccl-promote-stage-"), root, **activation)
        return root, candidate, manifest

    def promote(self, root, candidate, activation, **options):
        options.setdefault("validate", ACCEPT)
        options.setdefault("transaction_id", "t1")
        return promotion.promote(candidate=candidate, root=root, activation=activation, **options)

    def transaction(self, root, transaction_id="t1"):
        return root / promotion.TRANSACTIONS_RELATIVE / transaction_id

    def journal(self, root, transaction_id="t1"):
        return json.loads((self.transaction(root, transaction_id) / "journal.json").read_bytes())

    def lock_path(self, root):
        return root / promotion.LOCK_RELATIVE

    def crash_at(self, path, **scenario):
        """Injected process death: BaseException must bypass rollback handlers."""
        root, candidate, activation = self.scenario(**scenario)
        before = snapshot(root)

        def crash(ctx):
            if ctx["path"] == path:
                raise InjectedCrash(path)

        with self.assertRaises(InjectedCrash):
            self.promote(root, candidate, activation, hooks={"before-replace": crash})
        owner = json.loads(self.lock_path(root).read_bytes())
        owner["pid"] = 1073741824
        self.lock_path(root).write_bytes(encode(owner))
        return root, candidate, before


class OwnedSurfaceTest(PromotionCase):
    def test_owned_public_paths_are_exactly_the_four_data_files_with_manifest_last(self):
        self.assertEqual(promotion.PUBLIC_DATA_FILES, OWNED)
        self.assertEqual(promotion.PUBLIC_DATA_FILES[-1], "lookup-manifest.json")

    def test_first_activation_installs_exactly_the_owned_paths_and_commits(self):
        root, candidate, activation = self.scenario()
        payloads = {name: (candidate / name).read_bytes() for name in OWNED}
        replaced = []

        journal = self.promote(root, candidate, activation,
                               hooks={"after-replace": lambda ctx: replaced.append(ctx["path"])})

        self.assertEqual(journal["state"], "committed")
        self.assertEqual(json.loads(payloads["lookup-manifest.json"])["generationId"], journal["generationId"])
        self.assertEqual(self.journal(root)["state"], "committed")
        self.assertEqual(replaced, ["js/lookup-data.js", "js/app.js", *[f"data/{name}" for name in OWNED]])
        for name in OWNED:
            self.assertEqual((root / "data" / name).read_bytes(), payloads[name])
        self.assertEqual((root / "js" / "lookup-data.js").read_bytes(), (Path(activation).parent / "js" / "lookup-data.js").read_bytes())
        self.assertEqual((root / "js" / "app.js").read_bytes(), b"export const boot = 'g1';\n")
        self.assertFalse((root / "data" / "generation.json").exists())
        self.assertFalse((root / "data" / "ledger.json").exists())
        self.assertFalse(self.lock_path(root).exists())

    def test_commit_preserves_season_sidecars_and_retains_backups(self):
        root, candidate, activation = self.scenario()
        seasons = {name: (root / "data" / name).read_bytes()
                   for name in ("season-team-configs.json", "season-registry.json")}
        preimages = {name: (root / "data" / name).read_bytes() for name in ("heroes-dict.json", "tactics.json")}

        journal = self.promote(root, candidate, activation)

        for name, payload in seasons.items():
            self.assertEqual((root / "data" / name).read_bytes(), payload)
        backups = {row["path"]: row["backupPath"] for row in journal["paths"]}
        for name, payload in preimages.items():
            backup = self.transaction(root) / backups[f"data/{name}"]
            self.assertEqual(backup.read_bytes(), payload)
        self.assertIsNone(backups["data/lookup-catalog.json"])
        self.assertIsNone(backups["js/lookup-data.js"])


class CandidatePreflightTest(PromotionCase):
    def test_candidate_hash_mismatch_stops_before_any_mutation(self):
        root, candidate, activation = self.scenario()
        (candidate / "heroes-dict.json").write_bytes(encode([{"id": "hero:tampered"}]))
        before = snapshot(root)

        with self.assertRaises(promotion.PromotionError):
            self.promote(root, candidate, activation)

        self.assertEqual(snapshot(root), before)
        self.assertFalse(self.lock_path(root).exists())
        self.assertFalse(self.transaction(root).exists())

    def test_candidate_generation_id_must_derive_from_declared_digests(self):
        root, candidate, activation = self.scenario()
        manifest = json.loads((candidate / "lookup-manifest.json").read_bytes())
        manifest["generationId"] = "lookup:" + "0" * 64
        (candidate / "lookup-manifest.json").write_bytes(encode(manifest))
        before = snapshot(root)

        with self.assertRaises(promotion.PromotionError):
            self.promote(root, candidate, activation)

        self.assertEqual(snapshot(root), before)

    def test_injected_candidate_review_failure_stops_before_any_mutation(self):
        root, candidate, activation = self.scenario()
        before = snapshot(root)

        def reject(path):
            raise ValueError("candidate public projection does not match reviewed content")

        with self.assertRaises(ValueError):
            self.promote(root, candidate, activation, validate=reject)

        self.assertEqual(snapshot(root), before)
        self.assertFalse(self.lock_path(root).exists())

    def test_activation_preimage_conflict_and_staged_tamper_stop_before_mutation(self):
        for label, options in (
            ("third-party edit in shared code", {"before": sha(b"never written\n")}),
            ("staged bytes do not match declared postimage", {"tamper": True}),
        ):
            with self.subTest(label):
                root, candidate, activation = self.scenario(**options)
                before = snapshot(root)

                with self.assertRaises(promotion.PromotionError):
                    self.promote(root, candidate, activation)

                self.assertEqual(snapshot(root), before)
                self.assertFalse(self.lock_path(root).exists())


class ExclusionTest(PromotionCase):
    def test_running_pre_guard_writer_blocks_promotion_without_signalling_it(self):
        root, candidate, activation = self.scenario()
        writer = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)"])
        self.addCleanup(lambda: (writer.kill(), writer.wait()))
        before = snapshot(root)

        with self.assertRaises(promotion.ConflictError):
            self.promote(root, candidate, activation, writer_probe=lambda: [writer.pid])

        self.assertIsNone(writer.poll())
        self.assertEqual(snapshot(root), before)
        self.assertFalse(self.lock_path(root).exists())
        self.assertFalse(self.transaction(root).exists())

    def test_live_lock_owner_blocks_promotion_before_any_journal_or_mutation(self):
        root, candidate, activation = self.scenario()
        lock = self.lock_path(root)
        lock.parent.mkdir(parents=True, exist_ok=True)
        lock.write_bytes(encode({"pid": os.getpid(), "transaction": "other"}))
        handle = lock.open("r+")
        self.addCleanup(handle.close)
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        before = snapshot(root)

        with self.assertRaises(promotion.LockedError):
            self.promote(root, candidate, activation)

        self.assertEqual(snapshot(root), before)
        self.assertFalse((self.transaction(root) / "journal.json").exists())
        self.assertEqual(json.loads(lock.read_bytes())["transaction"], "other")

    def test_dictionary_exclusion_is_held_from_validation_through_commit(self):
        root, candidate, activation = self.scenario()
        events = []

        class Recorder:
            def __init__(self, target):
                self.target = target

            def __enter__(self):
                events.append("enter")
                return self

            def __exit__(self, *exc):
                events.append("exit")
                return False

        with mock.patch.object(promotion, "dictionary_exclusion", Recorder):
            self.promote(root, candidate, activation,
                         hooks={"after-replace": lambda ctx: events.append("replace"),
                                "committed": lambda ctx: events.append("committed")})

        self.assertEqual(events[0], "enter")
        self.assertEqual(events[-1], "exit")
        self.assertLess(events.index("committed"), events.index("exit"))
        self.assertLess(events.index("replace"), events.index("committed"))

    def test_preimage_change_after_lock_is_rejected_before_journal_or_replacement(self):
        root, candidate, activation = self.scenario()

        def intervene(_ctx):
            (root / "js" / "app.js").write_bytes(b"export const boot = 'work-in-progress';\n")

        with self.assertRaises(promotion.ConflictError):
            self.promote(root, candidate, activation, hooks={"lock-acquired": intervene})

        self.assertEqual((root / "js" / "app.js").read_bytes(), b"export const boot = 'work-in-progress';\n")
        self.assertFalse(self.transaction(root).exists())
        self.assertFalse(self.lock_path(root).exists())


class DurableOrderingTest(PromotionCase):
    def test_activation_prepared_journal_and_backups_precede_the_first_mutation(self):
        root, candidate, activation = self.scenario()
        preimages = {name: (root / "data" / name).read_bytes() for name in ("heroes-dict.json", "tactics.json")}
        observed = {}

        def on_prepared(ctx):
            observed["prepared"] = self.journal(root)
            observed["prepared-tree"] = snapshot(root)
            observed["activation-code"] = (self.transaction(root) / "activation-code.json").read_bytes()

        def on_replace(ctx):
            if "writing" in observed:
                return
            observed["first"] = ctx["path"]
            observed["writing"] = self.journal(root)
            observed["backups"] = {
                row["path"]: (self.transaction(root) / row["backupPath"]).read_bytes()
                for row in observed["writing"]["paths"] if row["backupPath"]
            }
            observed["tree"] = snapshot(root)

        before = snapshot(root)
        self.promote(root, candidate, activation,
                     hooks={"journal-prepared": on_prepared, "before-replace": on_replace})

        self.assertEqual(observed["prepared"]["state"], "activation-prepared")
        self.assertEqual(observed["prepared-tree"], before)
        self.assertEqual(observed["first"], "js/lookup-data.js")
        self.assertEqual(observed["writing"]["state"], "writing")
        self.assertEqual(observed["writing"]["activationCodeManifestHash"], sha(observed["activation-code"]))
        self.assertEqual(observed["tree"], before)
        self.assertEqual(observed["backups"]["data/heroes-dict.json"], preimages["heroes-dict.json"])
        self.assertEqual(observed["backups"]["data/tactics.json"], preimages["tactics.json"])
        for row in observed["writing"]["paths"]:
            self.assertEqual(row["backupPath"] is None, row["beforeHash"] is None)
            if row["backupPath"]:
                self.assertEqual(sha(observed["backups"][row["path"]]), row["beforeHash"])

    def test_journal_records_schema_one_states_hashes_and_owned_paths_only(self):
        root, candidate, activation = self.scenario()
        journal = self.promote(root, candidate, activation)

        self.assertEqual(journal["schemaVersion"], 1)
        self.assertEqual(journal["id"], "t1")
        self.assertIn(journal["state"], promotion.JOURNAL_STATES)
        self.assertEqual(journal["inputHashes"], {
            name: sha((candidate / name).read_bytes()) for name in OWNED
        })
        self.assertEqual(
            [row["path"] for row in journal["paths"]],
            ["js/lookup-data.js", "js/app.js", *[f"data/{name}" for name in OWNED]],
        )
        for row in journal["paths"]:
            self.assertEqual(set(row), {"path", "beforeHash", "afterHash", "backupPath"})
            self.assertEqual(row["afterHash"], sha((root / row["path"]).read_bytes()))

    def test_each_owned_replacement_uses_a_same_directory_temp_then_fsyncs_parent(self):
        root, candidate, activation = self.scenario()
        events = []
        real_fsync, real_replace = os.fsync, os.replace

        def record_fsync(descriptor):
            kind = "fsync-dir" if stat.S_ISDIR(os.fstat(descriptor).st_mode) else "fsync-file"
            events.append((kind, None))
            return real_fsync(descriptor)

        def record_replace(source, destination):
            events.append(("replace", str(destination)))
            self.assertEqual(Path(source).parent, Path(destination).parent)
            return real_replace(source, destination)

        with mock.patch.object(promotion.os, "fsync", record_fsync), \
                mock.patch.object(promotion.os, "replace", record_replace):
            self.promote(root, candidate, activation)

        destinations = [str(root / "data" / name) for name in OWNED]
        for destination in destinations:
            index = [position for position, event in enumerate(events) if event == ("replace", destination)]
            self.assertEqual(len(index), 1, destination)
            position = index[0]
            self.assertIn(("fsync-file", None), events[:position])
            self.assertIn(("fsync-dir", None), events[position:])
        order = [event[1] for event in events if event[0] == "replace" and event[1] in destinations]
        self.assertEqual(order, destinations)


class CaughtFailureTest(PromotionCase):
    def test_caught_replacement_failure_restores_the_full_prior_state(self):
        root, candidate, activation = self.scenario()
        before = snapshot(root)

        def fail_on_tactics(ctx):
            if ctx["path"] == "data/tactics.json":
                raise OSError("injected replacement failure")

        with self.assertRaises(OSError):
            self.promote(root, candidate, activation, hooks={"before-replace": fail_on_tactics})

        self.assertEqual(snapshot(root), before)
        self.assertFalse((root / "data" / "lookup-catalog.json").exists())
        self.assertFalse((root / "data" / "lookup-manifest.json").exists())
        self.assertFalse((root / "js" / "lookup-data.js").exists())
        self.assertEqual(self.journal(root)["state"], "rolled-back")
        self.assertFalse(self.lock_path(root).exists())

    def test_caught_preparation_failure_removes_the_unpublished_transaction(self):
        for event in ("activation-code-written", "journal-prepared"):
            with self.subTest(event=event):
                root, candidate, activation = self.scenario()
                before = snapshot(root)

                def fail(_ctx):
                    raise OSError(f"injected {event} failure")

                with self.assertRaisesRegex(OSError, event):
                    self.promote(root, candidate, activation, hooks={event: fail})

                self.assertEqual(snapshot(root), before)
                self.assertFalse(self.transaction(root).exists())
                self.assertFalse(self.lock_path(root).exists())
                retried = self.promote(root, candidate, activation)
                self.assertEqual(retried["state"], "committed")

    def test_partial_recursive_cleanup_is_detached_before_lock_release(self):
        root, candidate, activation = self.scenario()

        def fail(_ctx):
            raise OSError("injected journal preparation failure")

        def fail_recursive_cleanup(_path):
            raise OSError("injected recursive cleanup failure")

        with mock.patch.object(promotion.shutil, "rmtree", fail_recursive_cleanup):
            with self.assertRaisesRegex(OSError, "journal preparation"):
                self.promote(root, candidate, activation, hooks={"journal-prepared": fail})

        self.assertFalse(self.transaction(root).exists())
        self.assertFalse(self.lock_path(root).exists())
        transactions = root / promotion.TRANSACTIONS_RELATIVE
        self.assertEqual(list(transactions.iterdir()), [])
        tombstones = list((transactions.parent / "aborted-transactions").iterdir())
        self.assertEqual(len(tombstones), 1)
        self.assertTrue((tombstones[0] / "journal.json").exists())
        retried = self.promote(root, candidate, activation)
        self.assertEqual(retried["state"], "committed")

    def test_failed_transaction_detach_preserves_complete_recovery_evidence(self):
        root, candidate, activation = self.scenario()
        transaction = self.transaction(root)
        real_replace = promotion.os.replace

        def fail(_ctx):
            raise OSError("injected journal preparation failure")

        def fail_transaction_detach(source, destination):
            if Path(source) == transaction and Path(destination).parent.name == "aborted-transactions" and Path(destination).name.startswith("t1-"):
                raise OSError("injected transaction detach failure")
            return real_replace(source, destination)

        with mock.patch.object(promotion.os, "replace", fail_transaction_detach):
            with self.assertRaisesRegex(promotion.PreparationCleanupError, "failed to clean"):
                self.promote(root, candidate, activation, hooks={"journal-prepared": fail})

        self.assertTrue(transaction.exists())
        self.assertTrue(self.lock_path(root).exists())
        with mock.patch.object(promotion, "_pid_alive", return_value=False):
            recovered = promotion.recover(transaction_id="t1", root=root)
        self.assertEqual(recovered["state"], "rolled-back")
        self.assertFalse(self.lock_path(root).exists())
        retried = self.promote(root, candidate, activation, transaction_id="t2")
        self.assertEqual(retried["state"], "committed")

    def test_post_write_bundle_verification_conflict_preserves_intervening_bytes(self):
        root, candidate, activation = self.scenario()

        def corrupt_after_manifest(ctx):
            if ctx["path"] == "data/lookup-manifest.json":
                (root / "data" / "heroes-dict.json").write_bytes(encode([{"id": "hero:desynced"}]))

        with self.assertRaises(promotion.ConflictError):
            self.promote(root, candidate, activation, hooks={"after-replace": corrupt_after_manifest})

        self.assertEqual(json.loads((root / "data" / "heroes-dict.json").read_bytes())[0]["id"], "hero:desynced")
        self.assertEqual(self.journal(root)["state"], "writing")
        self.assertTrue(self.lock_path(root).exists())


class CrashRecoveryTest(PromotionCase):
    def test_crash_between_data_replacements_leaves_an_incomplete_recoverable_transaction(self):
        root, candidate, before = self.crash_at("data/lookup-catalog.json")

        self.assertTrue(self.lock_path(root).exists())
        self.assertEqual(self.journal(root)["state"], "writing")
        self.assertEqual((root / "data" / "heroes-dict.json").read_bytes(), (candidate / "heroes-dict.json").read_bytes())
        self.assertFalse((root / "data" / "lookup-manifest.json").exists())
        self.assertNotEqual(snapshot(root), before)

        journal = promotion.recover(transaction_id="t1", root=root)

        self.assertEqual(journal["state"], "rolled-back")
        self.assertEqual(self.journal(root)["state"], "rolled-back")
        self.assertEqual(snapshot(root), before)
        self.assertFalse(self.lock_path(root).exists())
        self.assertTrue(any((self.transaction(root) / row["backupPath"]).exists()
                            for row in journal["paths"] if row["backupPath"]))

    def test_live_journal_owner_blocks_recovery(self):
        root, _candidate, _before = self.crash_at("data/lookup-catalog.json")
        owner = json.loads(self.lock_path(root).read_bytes())
        owner["pid"] = os.getpid()
        self.lock_path(root).write_bytes(encode(owner))
        current = snapshot(root)

        with self.assertRaises(promotion.LockedError):
            promotion.recover(transaction_id="t1", root=root)

        self.assertEqual(snapshot(root), current)
        self.assertTrue(self.lock_path(root).exists())

    def test_committed_crash_window_releases_only_a_dead_owned_lock(self):
        root, candidate, activation = self.scenario()
        committed = self.promote(root, candidate, activation)
        self.lock_path(root).write_bytes(encode({"pid": 1073741824, "transaction": "t1"}))

        recovered = promotion.recover(transaction_id="t1", root=root)

        self.assertEqual(recovered, committed)
        self.assertFalse(self.lock_path(root).exists())

    def test_crash_before_the_first_code_replacement_recovers_without_touching_code(self):
        root, _candidate, before = self.crash_at("js/lookup-data.js")

        self.assertEqual(snapshot(root), before)
        promotion.recover(transaction_id="t1", root=root)

        self.assertEqual(snapshot(root), before)
        self.assertFalse((root / "js" / "lookup-data.js").exists())
        self.assertEqual(self.journal(root)["state"], "rolled-back")
        self.assertFalse(self.lock_path(root).exists())

    def test_recovery_restores_data_before_the_code_checkpoint(self):
        root, candidate, before = self.crash_at("data/lookup-manifest.json")
        order = []

        promotion.recover(transaction_id="t1", root=root,
                          hooks={"after-restore": lambda ctx: order.append(ctx["path"])})

        self.assertEqual(order[:3], [f"data/{name}" for name in OWNED[:3]])
        self.assertEqual(order[-2:], ["js/app.js", "js/lookup-data.js"])
        self.assertEqual(snapshot(root), before)

    def test_third_party_data_edit_stops_recovery_before_any_restore(self):
        root, _candidate, _before = self.crash_at("data/lookup-catalog.json")
        (root / "data" / "heroes-dict.json").write_bytes(encode([{"id": "hero:work-in-progress"}]))
        current = snapshot(root)

        with self.assertRaises(promotion.ConflictError):
            promotion.recover(transaction_id="t1", root=root)

        self.assertEqual(snapshot(root), current)
        self.assertEqual(self.journal(root)["state"], "writing")
        self.assertTrue(self.lock_path(root).exists())

    def test_third_party_code_edit_stops_recovery_before_any_data_restore(self):
        root, candidate, _before = self.crash_at("data/lookup-catalog.json")
        (root / "js" / "app.js").write_bytes(b"export const boot = 'local work in progress';\n")
        current = snapshot(root)

        with self.assertRaises(promotion.ConflictError):
            promotion.recover(transaction_id="t1", root=root)

        self.assertEqual(snapshot(root), current)
        self.assertEqual((root / "data" / "heroes-dict.json").read_bytes(), (candidate / "heroes-dict.json").read_bytes())
        self.assertTrue(self.lock_path(root).exists())

    def test_first_activation_rollback_deletes_new_files_only_when_bytes_match_candidate(self):
        root, candidate, before = self.crash_at(
            "data/lookup-manifest.json",
            season_refs=("hero:legacy", "tactic:legacy"),
        )
        self.assertTrue((root / "data" / "lookup-catalog.json").exists())
        (root / "data" / "lookup-catalog.json").write_bytes(encode({"schemaVersion": 1, "equipment": [{"id": "eq:x"}]}))
        conflicted = snapshot(root)

        with self.assertRaises(promotion.ConflictError):
            promotion.recover(transaction_id="t1", root=root)

        self.assertEqual(snapshot(root), conflicted)
        self.assertTrue((root / "data" / "lookup-catalog.json").exists())

        (root / "data" / "lookup-catalog.json").write_bytes((candidate / "lookup-catalog.json").read_bytes())
        promotion.recover(transaction_id="t1", root=root)

        self.assertEqual(snapshot(root), before)
        self.assertFalse((root / "data" / "lookup-catalog.json").exists())

    def test_first_activation_rollback_rejects_incompatible_dependent_season_refs(self):
        root, candidate, _before = self.crash_at(
            "data/lookup-manifest.json",
            season_refs=("hero:a", "tactic:a"),
        )
        current = snapshot(root)

        with self.assertRaises(promotion.ConflictError):
            promotion.recover(transaction_id="t1", root=root)

        self.assertEqual(snapshot(root), current)
        self.assertEqual(
            (root / "data" / "heroes-dict.json").read_bytes(),
            (candidate / "heroes-dict.json").read_bytes(),
        )
        self.assertTrue(self.lock_path(root).exists())

    def test_rollback_checks_dependent_season_refs_against_the_target_dictionaries(self):
        activated = bundle(heroes=("hero:b",), tactics=("tactic:a",))
        root, candidate, before = self.crash_at("data/lookup-manifest.json", activated=activated,
                                                season_refs=("hero:a", "tactic:a"))
        seasons = {name: (root / "data" / name).read_bytes()
                   for name in ("season-team-configs.json", "season-registry.json")}

        with self.assertRaises(promotion.ConflictError):
            promotion.recover(transaction_id="t1", root=root)

        for name, payload in seasons.items():
            self.assertEqual((root / "data" / name).read_bytes(), payload)
        self.assertEqual((root / "data" / "heroes-dict.json").read_bytes(), (candidate / "heroes-dict.json").read_bytes())
        self.assertTrue(self.lock_path(root).exists())

    def test_rollback_to_a_compatible_generation_restores_it_and_leaves_season_files(self):
        activated = bundle(heroes=("hero:a",), tactics=("tactic:a",))
        activated["heroes-dict.json"] = encode([{"id": "hero:a", "viet": "Tướng A (G1)"}])
        files = {name: sha(activated[name]) for name in PAYLOADS}
        activated["lookup-manifest.json"] = encode({
            "schemaVersion": 1, "generationId": "lookup:" + sha(canonical_json_bytes(files)), "files": files,
        })
        root, _candidate, before = self.crash_at(
            "data/lookup-manifest.json",
            activated=activated,
            season_refs=("hero:a", "tactic:a"),
        )
        seasons = (root / "data" / "season-team-configs.json").read_bytes()

        journal = promotion.recover(transaction_id="t1", root=root)

        self.assertEqual(journal["state"], "rolled-back")
        self.assertEqual(snapshot(root), before)
        self.assertEqual((root / "data" / "season-team-configs.json").read_bytes(), seasons)


class LockWithoutJournalTest(PromotionCase):
    def prepared_lock(self, pid, event="activation-code-written", mutate=False):
        root, candidate, activation = self.scenario()

        def crash(ctx):
            raise InjectedCrash(event)

        with self.assertRaises(InjectedCrash):
            self.promote(root, candidate, activation, hooks={event: crash})
        lock = self.lock_path(root)
        self.assertTrue(lock.exists())
        self.assertFalse((self.transaction(root) / "journal.json").exists())
        lock.write_bytes(encode({"pid": pid, "transaction": "t1"}))
        os.utime(lock, (0, 0))
        if mutate:
            (root / "data" / "heroes-dict.json").write_bytes((candidate / "heroes-dict.json").read_bytes())
        return root

    def dead_pid(self):
        done = subprocess.Popen([sys.executable, "-c", ""])
        done.wait()
        return done.pid

    def test_an_old_lock_without_journal_is_kept_while_the_owner_is_alive(self):
        root = self.prepared_lock(os.getpid())
        before = snapshot(root)

        with self.assertRaises(promotion.LockedError):
            promotion.recover(transaction_id="t1", root=root)

        self.assertTrue(self.lock_path(root).exists())
        self.assertEqual(snapshot(root), before)

    def test_lock_is_released_after_owner_death_when_preimages_prove_no_mutation(self):
        for event in ("lock-acquired", "activation-code-written"):
            with self.subTest(event=event):
                root = self.prepared_lock(self.dead_pid(), event=event)
                before = snapshot(root)

                result = promotion.recover(transaction_id="t1", root=root)

                self.assertEqual(result["state"], "lock-released")
                self.assertFalse(self.lock_path(root).exists())
                self.assertEqual(snapshot(root), before)

    def test_lock_is_kept_when_a_destination_already_left_its_recorded_preimage(self):
        root = self.prepared_lock(self.dead_pid(), mutate=True)
        current = snapshot(root)

        with self.assertRaises(promotion.ConflictError):
            promotion.recover(transaction_id="t1", root=root)

        self.assertTrue(self.lock_path(root).exists())
        self.assertEqual(snapshot(root), current)


class PathSafetyTest(PromotionCase):
    def test_transaction_ids_outside_the_bounded_pattern_are_refused(self):
        root, candidate, activation = self.scenario()
        before = snapshot(root)
        for transaction_id in ("", "../escape", "Upper", "has space", "-leading", "a" * 65, "a/b"):
            with self.subTest(transaction_id=transaction_id):
                with self.assertRaises(ValueError):
                    self.promote(root, candidate, activation, transaction_id=transaction_id)
                with self.assertRaises(ValueError):
                    promotion.recover(transaction_id=transaction_id, root=root)
        self.assertEqual(snapshot(root), before)
        self.assertFalse(self.lock_path(root).exists())

    def test_journal_paths_outside_the_owned_constant_never_reach_a_sentinel(self):
        outside = self.temp_dir("tqccl-promote-sentinel-")
        sentinel = outside / "sentinel.txt"
        sentinel.write_bytes(b"private sentinel outside the checkout\n")
        root, _candidate, _before = self.crash_at("data/lookup-manifest.json")
        journal_path = self.transaction(root) / "journal.json"
        journal = json.loads(journal_path.read_bytes())
        for row in journal["paths"]:
            if row["path"] == "data/heroes-dict.json":
                row["path"] = str(sentinel)
        journal_path.write_bytes(encode(journal))
        current = snapshot(root)

        with self.assertRaises(promotion.PromotionError):
            promotion.recover(transaction_id="t1", root=root)

        self.assertEqual(sentinel.read_bytes(), b"private sentinel outside the checkout\n")
        self.assertEqual(snapshot(root), current)
        self.assertEqual(sorted(path.name for path in outside.iterdir()), ["sentinel.txt"])

    def test_journal_cannot_self_authorize_an_unrecorded_code_path(self):
        root, _candidate, _before = self.crash_at("data/lookup-manifest.json")
        sentinel = root / "notes.txt"
        sentinel.write_bytes(b"keep local work\n")
        journal_path = self.transaction(root) / "journal.json"
        journal = json.loads(journal_path.read_bytes())
        journal["paths"].append({
            "path": "notes.txt",
            "beforeHash": None,
            "afterHash": sha(sentinel.read_bytes()),
            "backupPath": None,
        })
        journal_path.write_bytes(encode(journal))

        with self.assertRaises(promotion.PromotionError):
            promotion.recover(transaction_id="t1", root=root)

        self.assertEqual(sentinel.read_bytes(), b"keep local work\n")
        self.assertTrue(self.lock_path(root).exists())

    def test_symlinked_code_ancestor_stops_recovery_before_restore(self):
        outside = self.temp_dir("tqccl-promote-code-ancestor-")
        root, _candidate, _before = self.crash_at("data/lookup-manifest.json")
        moved = outside / "js"
        (root / "js").rename(moved)
        (root / "js").symlink_to(moved, target_is_directory=True)
        current = (moved / "app.js").read_bytes()

        with self.assertRaises(promotion.PromotionError):
            promotion.recover(transaction_id="t1", root=root)

        self.assertEqual((moved / "app.js").read_bytes(), current)
        self.assertTrue(self.lock_path(root).exists())

    def test_symlinked_transaction_ancestor_stops_recovery_before_journal_read(self):
        outside = self.temp_dir("tqccl-promote-transaction-ancestor-")
        root, _candidate, _before = self.crash_at("data/lookup-manifest.json")
        transactions = root / promotion.TRANSACTIONS_RELATIVE
        moved = outside / "transactions"
        transactions.rename(moved)
        transactions.symlink_to(moved, target_is_directory=True)
        journal = moved / "t1" / "journal.json"
        before = journal.read_bytes()

        with self.assertRaises(promotion.PromotionError):
            promotion.recover(transaction_id="t1", root=root)

        self.assertEqual(journal.read_bytes(), before)
        self.assertTrue(self.lock_path(root).exists())

    def test_symlinked_destination_or_data_parent_is_refused_before_mutation(self):
        outside = self.temp_dir("tqccl-promote-symlink-")
        sentinel = outside / "heroes-dict.json"
        sentinel.write_bytes(b"sentinel outside the checkout\n")
        for label in ("destination symlink", "data parent symlink"):
            with self.subTest(label):
                root, candidate, activation = self.scenario()
                if label == "destination symlink":
                    (root / "data" / "heroes-dict.json").unlink()
                    (root / "data" / "heroes-dict.json").symlink_to(sentinel)
                else:
                    for path in sorted((root / "data").iterdir()):
                        path.unlink()
                    (root / "data").rmdir()
                    (root / "data").symlink_to(outside, target_is_directory=True)

                with self.assertRaises(promotion.PromotionError):
                    self.promote(root, candidate, activation)

                self.assertEqual(sentinel.read_bytes(), b"sentinel outside the checkout\n")
                self.assertEqual(sorted(path.name for path in outside.iterdir()), ["heroes-dict.json"])
                self.assertFalse(self.lock_path(root).exists())

    def test_symlinked_nested_activation_ancestor_is_refused_before_mutation(self):
        outside = self.temp_dir("tqccl-promote-activation-ancestor-")
        (outside / "src" / "data").mkdir(parents=True)
        sentinel = outside / "src" / "data" / "lookup-bundle.ts"
        sentinel.write_bytes(b"external preimage\n")
        root, candidate, activation = self.scenario()
        (root / "mcp-worker").symlink_to(outside, target_is_directory=True)
        stage = activation.parent
        (stage / "mcp-worker" / "src" / "data").mkdir(parents=True)
        staged = stage / "mcp-worker" / "src" / "data" / "lookup-bundle.ts"
        staged.write_bytes(b"candidate bytes\n")
        document = json.loads(activation.read_bytes())
        document["paths"].append({
            "path": "mcp-worker/src/data/lookup-bundle.ts",
            "source": "mcp-worker/src/data/lookup-bundle.ts",
            "beforeHash": sha(sentinel.read_bytes()),
            "afterHash": sha(staged.read_bytes()),
        })
        activation.write_bytes(encode(document))

        with self.assertRaises(promotion.PromotionError):
            self.promote(root, candidate, activation)

        self.assertEqual(sentinel.read_bytes(), b"external preimage\n")
        self.assertFalse(self.lock_path(root).exists())

    def test_tampered_or_external_backup_is_refused_before_any_restore(self):
        outside = self.temp_dir("tqccl-promote-backup-")
        planted = outside / "planted.json"
        planted.write_bytes(encode([{"id": "hero:planted"}]))
        for label in ("tampered backup", "backup outside the transaction"):
            with self.subTest(label):
                root, _candidate, _before = self.crash_at("data/lookup-manifest.json")
                journal_path = self.transaction(root) / "journal.json"
                journal = json.loads(journal_path.read_bytes())
                row = next(row for row in journal["paths"] if row["path"] == "data/heroes-dict.json")
                if label == "tampered backup":
                    (self.transaction(root) / row["backupPath"]).write_bytes(encode([{"id": "hero:tampered"}]))
                else:
                    row["backupPath"] = str(planted)
                    journal_path.write_bytes(encode(journal))
                current = snapshot(root)

                with self.assertRaises(promotion.PromotionError):
                    promotion.recover(transaction_id="t1", root=root)

                self.assertEqual(snapshot(root), current)
                self.assertTrue(self.lock_path(root).exists())


class CommandLineTest(PromotionCase):
    def test_promote_and_recover_subcommands_route_through_the_same_contract(self):
        root, candidate, activation = self.scenario()
        with mock.patch.object(promotion, "validate_candidate", ACCEPT, create=True):
            promotion.main(["promote", "--candidate", str(candidate), "--root", str(root),
                            "--activation", str(activation), "--transaction", "t1"])
        self.assertEqual(self.journal(root)["state"], "committed")
        self.assertEqual((root / "data" / "lookup-manifest.json").read_bytes(),
                         (candidate / "lookup-manifest.json").read_bytes())

        with self.assertRaises(ValueError):
            promotion.main(["recover", "--transaction", "../escape", "--root", str(root)])


if __name__ == "__main__":
    unittest.main()
