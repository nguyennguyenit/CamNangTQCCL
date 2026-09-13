"""Recoverable activation of a reviewed unified lookup bundle."""

from __future__ import annotations

import argparse
import fcntl
import contextlib
import hashlib
import json
import os
import re
import tempfile
import stat
import subprocess
from pathlib import Path

from pipeline.build_unified_lookup import validate_candidate
from pipeline.lookup_translations import canonical_json_bytes

PUBLIC_DATA_FILES = ("heroes-dict.json", "tactics.json", "lookup-catalog.json", "lookup-manifest.json")
LOCK_RELATIVE = Path("pipeline/lookup-output/promotion.lock")
TRANSACTIONS_RELATIVE = Path("pipeline/lookup-output/transactions")
JOURNAL_STATES = {"activation-prepared", "writing", "committed", "rolled-back"}
_TX = re.compile(r"[a-z0-9][a-z0-9-]{0,63}\Z")


class PromotionError(RuntimeError):
    pass


class ConflictError(PromotionError):
    pass


class LockedError(PromotionError):
    pass


def _sha(payload):
    return hashlib.sha256(payload).hexdigest()


def _encode(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")


def _validate_transaction_id(value):
    if not isinstance(value, str) or not _TX.fullmatch(value):
        raise ValueError("invalid transaction id")


def _regular_bytes(path, *, optional=False):
    try:
        info = path.lstat()
    except FileNotFoundError:
        if optional:
            return None
        raise PromotionError(f"required file is missing: {path}")
    if stat.S_ISLNK(info.st_mode) or not stat.S_ISREG(info.st_mode):
        raise PromotionError(f"path must be a regular file: {path}")
    return path.read_bytes()


def _safe_root(root):
    root = Path(root).absolute()
    root_real = root.resolve(strict=True)
    data = root / "data"
    if data.is_symlink() or not data.is_dir() or data.resolve(strict=True).parent != root_real:
        raise PromotionError("data parent is unsafe")
    pipeline = root / "pipeline"
    if pipeline.is_symlink() or not pipeline.is_dir() or pipeline.resolve(strict=True).parent != root_real:
        raise PromotionError("pipeline parent is unsafe")
    output = pipeline / "lookup-output"
    if output.exists() and (output.is_symlink() or not output.is_dir()):
        raise PromotionError("lookup output parent is unsafe")
    if not output.exists():
        output.mkdir()
    if root_real not in output.resolve(strict=True).parents:
        raise PromotionError("lookup output parent is unsafe")
    return root

def _validate_destination(root, destination):
    root_real = root.resolve(strict=True)
    try:
        relative = destination.relative_to(root)
    except ValueError as error:
        raise PromotionError("destination escapes project root") from error
    probe = root
    for part in relative.parent.parts:
        probe /= part
        if probe.is_symlink() or not probe.is_dir():
            raise PromotionError("destination ancestor is unsafe")
    parent = destination.parent.resolve(strict=True)
    if destination.is_symlink() or (parent != root_real and root_real not in parent.parents):
        raise PromotionError("destination is unsafe")


def _replace_bytes(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
        parent = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(parent)
        finally:
            os.close(parent)
    finally:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass


def _write_durable(path, value):
    _replace_bytes(path, _encode(value))


def _pid_alive(pid):
    try:
        os.kill(int(pid), 0)
        return True
    except (OSError, ValueError, TypeError):
        return False


@contextlib.contextmanager
def dictionary_exclusion(root):
    lock = Path(root) / LOCK_RELATIVE
    try:
        owner = json.loads(_regular_bytes(lock))
    except json.JSONDecodeError as error:
        raise LockedError("lookup lock evidence is invalid") from error
    if owner.get("pid") != os.getpid():
        raise LockedError("lookup exclusion is not owned by this process")
    yield
    if not lock.exists():
        raise LockedError("lookup exclusion was lost during activation")


def _acquire_lock(root, transaction_id):
    lock = root / LOCK_RELATIVE
    lock.parent.mkdir(parents=True, exist_ok=True)
    try:
        descriptor = os.open(lock, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError as error:
        raise LockedError("lookup promotion is already locked") from error
    payload = _encode({"pid": os.getpid(), "transaction": transaction_id})
    os.write(descriptor, payload)
    os.fsync(descriptor)
    os.close(descriptor)
    return lock

@contextlib.contextmanager
def _recovery_exclusion(lock, transaction_id):
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    try:
        descriptor = os.open(lock, flags)
        fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except (FileNotFoundError, BlockingIOError, OSError) as error:
        raise LockedError("recovery lock is unavailable") from error
    try:
        try:
            owner = json.loads(os.pread(descriptor, os.fstat(descriptor).st_size, 0))
        except json.JSONDecodeError as error:
            raise PromotionError("lock evidence is invalid") from error
        if owner.get("transaction") != transaction_id:
            raise LockedError("recovery lock belongs to another transaction")
        yield owner
    finally:
        os.close(descriptor)


def _activation_rows(root, activation):
    activation = Path(activation).resolve(strict=True)
    stage = activation.parent
    try:
        document = json.loads(_regular_bytes(activation))
    except (json.JSONDecodeError, TypeError) as error:
        raise PromotionError("activation manifest is invalid") from error
    if set(document or {}) != {"schemaVersion", "paths"} or document["schemaVersion"] != 1 or not isinstance(document["paths"], list):
        raise PromotionError("activation manifest shape is invalid")
    rows = []
    seen = set()
    for item in document["paths"]:
        if set(item or {}) != {"path", "source", "beforeHash", "afterHash"}:
            raise PromotionError("activation path shape is invalid")
        relative = Path(item["path"])
        source_relative = Path(item["source"])
        if relative.is_absolute() or source_relative.is_absolute() or ".." in relative.parts or ".." in source_relative.parts or str(relative) in seen:
            raise PromotionError("activation path escapes its root")
        seen.add(str(relative))
        destination = root / relative
        _validate_destination(root, destination)
        source = stage / source_relative
        _validate_destination(stage, source)
        payload = _regular_bytes(source)
        before = _regular_bytes(destination, optional=True)
        before_hash = _sha(before) if before is not None else None
        if before_hash != item["beforeHash"] or _sha(payload) != item["afterHash"]:
            raise ConflictError("activation preimage or postimage changed")
        rows.append((str(relative), payload, before, item["beforeHash"], item["afterHash"]))
    return rows, _regular_bytes(activation)


def _candidate_rows(root, candidate):
    candidate = Path(candidate).resolve(strict=True)
    payloads = {}
    for name in PUBLIC_DATA_FILES:
        payloads[name] = _regular_bytes(candidate / name)
    try:
        manifest = json.loads(payloads["lookup-manifest.json"])
    except json.JSONDecodeError as error:
        raise PromotionError("candidate manifest is invalid") from error
    expected_names = set(PUBLIC_DATA_FILES[:-1])
    if set(manifest or {}) != {"schemaVersion", "generationId", "files"} or manifest["schemaVersion"] != 1 or set(manifest["files"]) != expected_names:
        raise PromotionError("candidate manifest shape is invalid")
    for name in expected_names:
        if manifest["files"].get(name) != _sha(payloads[name]):
            raise PromotionError("candidate hash mismatch")
    if manifest["generationId"] != "lookup:" + _sha(canonical_json_bytes(manifest["files"])):
        raise PromotionError("candidate generation ID mismatch")
    rows = []
    for name in PUBLIC_DATA_FILES:
        destination = root / "data" / name
        _validate_destination(root, destination)
        before = _regular_bytes(destination, optional=True)
        rows.append((f"data/{name}", payloads[name], before, _sha(before) if before is not None else None, _sha(payloads[name])))
    return rows, manifest


def _prepare_transaction(root, transaction_id, activation_bytes, rows, generation_id, input_hashes, hooks):
    transactions = root / TRANSACTIONS_RELATIVE
    _validate_destination(root, transactions)
    transactions.mkdir(exist_ok=True)
    transaction = transactions / transaction_id
    if transaction.exists():
        raise ConflictError("transaction already exists")
    transaction.mkdir()
    _replace_bytes(transaction / "activation-code.json", activation_bytes)
    _write_durable(transaction / "preimages.json", {path: before_hash for path, _after, _before, before_hash, _after_hash in rows})
    hooks.get("activation-code-written", lambda _ctx: None)({"transaction": transaction_id})
    journal_rows = []
    for index, (path, _after, before, before_hash, after_hash) in enumerate(rows):
        backup_name = None
        if before is not None:
            backup_name = f"backup-{index:03d}.bin"
            _replace_bytes(transaction / backup_name, before)
        journal_rows.append({"path": path, "beforeHash": before_hash, "afterHash": after_hash, "backupPath": backup_name})
    journal = {
        "schemaVersion": 1, "id": transaction_id, "state": "activation-prepared",
        "generationId": generation_id, "inputHashes": input_hashes,
        "activationCodeManifestHash": _sha(activation_bytes), "paths": journal_rows,
    }
    _write_durable(transaction / "journal.json", journal)
    hooks.get("journal-prepared", lambda _ctx: None)({"transaction": transaction_id})
    return transaction, journal


def _current_hash(path):
    payload = _regular_bytes(path, optional=True)
    return _sha(payload) if payload is not None else None


def _season_refs_are_compatible(root, journal, transaction):
    target_ids = set()
    catalog = {"heroes-dict": [], "tactics": [], "books-dict": []}
    for row in journal["paths"]:
        if row["path"] not in {"data/heroes-dict.json", "data/tactics.json"}:
            continue
        if row["backupPath"] is None:
            continue
        records = json.loads((transaction / row["backupPath"]).read_bytes())
        dataset = Path(row["path"]).stem
        catalog[dataset] = records
        target_ids.update(
            item.get("id") for item in records
            if isinstance(item, dict) and isinstance(item.get("id"), str)
        )
    from .season_validation import dictionary_ids
    for identities in dictionary_ids(catalog).values():
        target_ids.update(identities)
    season = root / "data" / "season-team-configs.json"
    if not season.exists():
        return True
    document = json.loads(_regular_bytes(season))
    referenced = set()
    def walk(value):
        if isinstance(value, dict):
            for nested in value.values():
                walk(nested)
        elif isinstance(value, list):
            for nested in value:
                walk(nested)
        elif isinstance(value, str) and (value.startswith("hero:") or value.startswith("tactic:")):
            referenced.add(value)
    walk(document)
    return referenced <= target_ids


def _validate_journal(root, transaction_id):
    transaction = root / TRANSACTIONS_RELATIVE / transaction_id
    _validate_destination(root, transaction)
    if transaction.is_symlink() or not transaction.is_dir():
        raise PromotionError("transaction directory is unsafe")
    journal_path = transaction / "journal.json"
    try:
        journal = json.loads(_regular_bytes(journal_path))
    except json.JSONDecodeError as error:
        raise PromotionError("journal is invalid") from error
    required = {"schemaVersion", "id", "state", "generationId", "inputHashes", "activationCodeManifestHash", "paths"}
    if (
        set(journal or {}) != required
        or journal["schemaVersion"] != 1
        or journal["id"] != transaction_id
        or journal["state"] not in JOURNAL_STATES
        or not isinstance(journal["paths"], list)
    ):
        raise PromotionError("journal shape is invalid")
    activation_bytes = _regular_bytes(transaction / "activation-code.json")
    if _sha(activation_bytes) != journal["activationCodeManifestHash"]:
        raise PromotionError("activation manifest hash mismatch")
    try:
        activation = json.loads(activation_bytes)
    except json.JSONDecodeError as error:
        raise PromotionError("activation manifest is invalid") from error
    if set(activation or {}) != {"schemaVersion", "paths"} or activation.get("schemaVersion") != 1:
        raise PromotionError("activation manifest shape is invalid")
    activation_paths = [item.get("path") for item in activation.get("paths", []) if isinstance(item, dict)]
    if len(activation_paths) != len(activation.get("paths", [])) or any(not isinstance(path, str) for path in activation_paths):
        raise PromotionError("activation manifest path is invalid")
    rows = journal["paths"]
    if any(not isinstance(row, dict) or set(row) != {"path", "beforeHash", "afterHash", "backupPath"} for row in rows):
        raise PromotionError("journal row shape is invalid")
    paths = [row["path"] for row in rows]
    allowed_data = {f"data/{name}" for name in PUBLIC_DATA_FILES}
    code_paths = {path for path in paths if isinstance(path, str) and not path.startswith("data/")}
    if (
        any(not isinstance(path, str) for path in paths)
        or len(paths) != len(set(paths))
        or set(paths) != allowed_data | code_paths
        or code_paths != set(activation_paths)
        or len(activation_paths) != len(set(activation_paths))
        or any(Path(path).is_absolute() or ".." in Path(path).parts for path in paths)
    ):
        raise PromotionError("journal contains an unowned path")
    root_real = root.resolve(strict=True)
    for path in paths:
        _validate_destination(root, root / path)
    for row in rows:
        backup = row["backupPath"]
        if backup is None:
            if row["beforeHash"] is not None:
                raise PromotionError("journal backup is missing")
            continue
        backup_path = Path(backup)
        if backup_path.is_absolute() or len(backup_path.parts) != 1:
            raise PromotionError("journal backup escapes transaction")
        payload = _regular_bytes(transaction / backup)
        if _sha(payload) != row["beforeHash"]:
            raise PromotionError("journal backup hash mismatch")
    return transaction, journal


def _restore(root, transaction, journal, hooks, *, strict):
    if strict:
        for row in journal["paths"]:
            current = _current_hash(root / row["path"])
            if current not in {row["beforeHash"], row["afterHash"]}:
                raise ConflictError("destination changed outside the transaction")
        if not _season_refs_are_compatible(root, journal, transaction):
            raise ConflictError("dependent season references reject rollback")
    data_rows = [row for row in journal["paths"] if row["path"].startswith("data/")]
    code_rows = [row for row in journal["paths"] if not row["path"].startswith("data/")]
    for row in [*data_rows, *reversed(code_rows)]:
        destination = root / row["path"]
        if row["backupPath"] is None:
            try:
                destination.unlink()
            except FileNotFoundError:
                pass
        else:
            _replace_bytes(destination, _regular_bytes(transaction / row["backupPath"]))
        hooks.get("after-restore", lambda _ctx: None)({"path": row["path"]})
    for row in journal["paths"]:
        if _current_hash(root / row["path"]) != row["beforeHash"]:
            raise PromotionError("rollback did not restore the recorded preimage")
    journal["state"] = "rolled-back"
    _write_durable(transaction / "journal.json", journal)
    return journal

def _legacy_writer_pids():
    listing = subprocess.run(
        ["ps", "-axo", "pid=,command="],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.splitlines()
    return [
        int(line.strip().split(maxsplit=1)[0])
        for line in listing
        if "build_dict.py" in line or "pipeline.build_dict" in line
    ]


def promote(*, candidate, root, activation, transaction_id, validate=None, hooks=None, writer_probe=None):
    _validate_transaction_id(transaction_id)
    hooks = hooks or {}
    root = _safe_root(root)
    candidate = Path(candidate)
    (validate or validate_candidate)(candidate)
    activation_rows, activation_bytes = _activation_rows(root, activation)
    data_rows, manifest = _candidate_rows(root, candidate)
    input_hashes = {name: _sha(_regular_bytes(candidate / name)) for name in PUBLIC_DATA_FILES}
    if (writer_probe or _legacy_writer_pids)():
        raise ConflictError("a pre-guard dictionary writer is running")
    lock = _acquire_lock(root, transaction_id)
    hooks.get("lock-acquired", lambda _ctx: None)({"transaction": transaction_id})
    transaction = None
    journal = None
    rows = [*activation_rows, *data_rows]
    try:
        with dictionary_exclusion(root):
            for path, _payload, _before, before_hash, _after_hash in rows:
                _validate_destination(root, root / path)
                if _current_hash(root / path) != before_hash:
                    raise ConflictError("destination changed after promotion lock acquisition")
            transaction, journal = _prepare_transaction(root, transaction_id, activation_bytes, rows, manifest["generationId"], input_hashes, hooks)
            journal["state"] = "writing"
            _write_durable(transaction / "journal.json", journal)
            for path, payload, _before, _before_hash, _after_hash in rows:
                hooks.get("before-replace", lambda _ctx: None)({"path": path})
                _replace_bytes(root / path, payload)
                hooks.get("after-replace", lambda _ctx: None)({"path": path})
            for _path, payload, _before, _before_hash, after_hash in rows:
                if _sha(payload) != after_hash:
                    raise PromotionError("postimage evidence changed")
            for path, _payload, _before, _before_hash, after_hash in rows:
                if _current_hash(root / path) != after_hash:
                    raise PromotionError("activated lookup verification failed")
            journal["state"] = "committed"
            _write_durable(transaction / "journal.json", journal)
            hooks.get("committed", lambda _ctx: None)({"transaction": transaction_id})
    except Exception:
        if transaction is not None and journal is not None:
            _restore(root, transaction, journal, hooks, strict=True)
        try:
            lock.unlink()
        except FileNotFoundError:
            pass
        raise
    lock.unlink()
    return journal


def recover(*, transaction_id, root, hooks=None):
    _validate_transaction_id(transaction_id)
    hooks = hooks or {}
    root = _safe_root(root)
    lock = root / LOCK_RELATIVE
    transaction = root / TRANSACTIONS_RELATIVE / transaction_id
    transactions = root / TRANSACTIONS_RELATIVE
    _validate_destination(root, transaction if transactions.exists() else transactions)
    journal_path = transaction / "journal.json"
    if not journal_path.exists():
        if not lock.exists():
            raise PromotionError("recovery state is missing")
        with _recovery_exclusion(lock, transaction_id) as owner:
            if _pid_alive(owner.get("pid")):
                raise LockedError("lock owner is still alive")
            if transaction.exists() and (transaction.is_symlink() or not transaction.is_dir()):
                raise PromotionError("transaction directory is unsafe")
            activation_path = transaction / "activation-code.json"
            preimages_path = transaction / "preimages.json"
            activation_paths = []
            if activation_path.exists():
                activation = json.loads(_regular_bytes(activation_path))
                activation_paths = [item.get("path") for item in activation.get("paths", []) if isinstance(item, dict)]
                if (
                    set(activation or {}) != {"schemaVersion", "paths"}
                    or activation.get("schemaVersion") != 1
                    or len(activation_paths) != len(activation.get("paths", []))
                    or len(activation_paths) != len(set(activation_paths))
                    or any(not isinstance(path, str) or Path(path).is_absolute() or ".." in Path(path).parts for path in activation_paths)
                ):
                    raise PromotionError("activation recovery path is unsafe")
                for item in activation["paths"]:
                    destination = root / item["path"]
                    probe = root
                    for part in Path(item["path"]).parent.parts:
                        probe /= part
                        if probe.is_symlink() or not probe.is_dir():
                            raise PromotionError("activation recovery ancestor is unsafe")
                    if destination.is_symlink() or _current_hash(destination) != item.get("beforeHash"):
                        raise ConflictError("destination changed before journal")
            if preimages_path.exists():
                preimages = json.loads(_regular_bytes(preimages_path))
                expected_paths = set(activation_paths) | {f"data/{name}" for name in PUBLIC_DATA_FILES}
                if set(preimages or {}) != expected_paths:
                    raise PromotionError("preimage evidence contains an unowned path")
                for path, expected in preimages.items():
                    if _current_hash(root / path) != expected:
                        raise ConflictError("destination changed before journal")
            lock.unlink()
            return {"state": "lock-released", "id": transaction_id}
    transaction, journal = _validate_journal(root, transaction_id)
    if journal["state"] == "committed":
        if lock.exists():
            with _recovery_exclusion(lock, transaction_id) as owner:
                if _pid_alive(owner.get("pid")):
                    raise LockedError("committed transaction owner is still alive")
                for row in journal["paths"]:
                    if _current_hash(root / row["path"]) != row["afterHash"]:
                        raise ConflictError("committed transaction postimage changed")
                lock.unlink()
        return journal
    if not lock.exists():
        raise LockedError("incomplete transaction has no recovery lock")
    with _recovery_exclusion(lock, transaction_id) as owner:
        if _pid_alive(owner.get("pid")):
            raise LockedError("recovery lock owner is still alive")
        result = _restore(root, transaction, journal, hooks, strict=True)
        lock.unlink()
        return result


def main(argv=None):
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command", required=True)
    promote_command = commands.add_parser("promote")
    promote_command.add_argument("--candidate", required=True)
    promote_command.add_argument("--root", default=".")
    promote_command.add_argument("--activation", required=True)
    promote_command.add_argument("--transaction", required=True)
    recover_command = commands.add_parser("recover")
    recover_command.add_argument("--transaction", required=True)
    recover_command.add_argument("--root", default=".")
    args = parser.parse_args(argv)
    if args.command == "promote":
        result = promote(candidate=args.candidate, root=args.root, activation=args.activation, transaction_id=args.transaction)
    else:
        result = recover(transaction_id=args.transaction, root=args.root)
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return result


if __name__ == "__main__":
    main()
