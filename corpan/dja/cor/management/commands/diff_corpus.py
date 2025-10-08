# cor/management/commands/diff_corpus.py
from __future__ import annotations

import os
import random
import sqlite3
import subprocess
import tempfile
from typing import Dict, Tuple, List, Set, Optional

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from cor.models import Entry, Translation, Language, Domain


def read_only_conn(path: str) -> sqlite3.Connection:
    return sqlite3.connect(f"file:{path}?mode=ro", uri=True)


def git_extract_file(ref: str, repo_root: str, rel_path: str) -> str:
    full = os.path.join(repo_root, rel_path)
    rel = os.path.relpath(full, repo_root)
    try:
        blob = subprocess.check_output(["git", "-C", repo_root, "show", f"{ref}:{rel}"])
    except subprocess.CalledProcessError as e:
        raise CommandError(f"git show {ref}:{rel} failed: {e}")
    fd, tmp = tempfile.mkstemp(prefix=f"git-{ref.replace('/','_')}-", suffix=".sqlite3")
    os.close(fd)
    with open(tmp, "wb") as f:
        f.write(blob)
    return tmp


def fetch_table(
    conn: sqlite3.Connection, sql: str, args: Tuple = ()
) -> List[sqlite3.Row]:
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(sql, args)
    return cur.fetchall()


def shorten(s: str, n: int = 160) -> str:
    s = (s or "").replace("\n", " ").strip()
    return s if len(s) <= n else s[: n - 1] + "…"


def unify(a: Optional[str]) -> str:
    return "" if a is None else str(a)


def pick(seq: List, k: int, do_random: bool) -> List:
    if k is None or k <= 0 or len(seq) <= k:
        return seq
    return random.sample(seq, k) if do_random else seq[:k]


class Snapshot:
    def __init__(self, path: str):
        self.path = path
        self.entries: Dict[int, Tuple[str, str]] = {}  # id -> (en_text, level)
        self.lang_by_id: Dict[int, str] = {}  # id -> code
        self.dom_by_id: Dict[int, str] = {}  # id -> code
        self.entry_domains: Dict[int, Set[str]] = {}  # entry_id -> {domain_code}
        self.trans: Dict[
            Tuple[int, str], Tuple[str, str]
        ] = {}  # (entry_id, lang_code) -> (text, romanization)

    def load(self):
        conn = read_only_conn(self.path)

        t_entry = Entry._meta.db_table
        t_lang = Language._meta.db_table
        t_trans = Translation._meta.db_table
        t_domain = Domain._meta.db_table
        t_m2m = Entry.domains.through._meta.db_table

        for row in fetch_table(conn, f"SELECT id, code FROM {t_lang}"):
            self.lang_by_id[row["id"]] = row["code"]

        for row in fetch_table(conn, f"SELECT id, code FROM {t_domain}"):
            self.dom_by_id[row["id"]] = row["code"]

        for row in fetch_table(conn, f"SELECT id, en_text, level FROM {t_entry}"):
            self.entries[row["id"]] = (unify(row["en_text"]), unify(row["level"]))

        for row in fetch_table(conn, f"SELECT entry_id, domain_id FROM {t_m2m}"):
            e = row["entry_id"]
            dcode = self.dom_by_id.get(row["domain_id"])
            if not dcode:
                continue
            self.entry_domains.setdefault(e, set()).add(dcode)

        for row in fetch_table(
            conn, f"SELECT entry_id, language_id, text, romanization FROM {t_trans}"
        ):
            code = self.lang_by_id.get(row["language_id"])
            if not code:
                continue
            key = (row["entry_id"], code)
            self.trans[key] = (unify(row["text"]), unify(row["romanization"]))

        conn.close()


class CorpusDiff:
    def __init__(self, left: Snapshot, right: Snapshot):
        self.left = left  # baseline (e.g., main)
        self.right = right  # current branch

    def diff_entries(self):
        a_ids = set(self.left.entries.keys())
        b_ids = set(self.right.entries.keys())

        added = sorted(b_ids - a_ids)
        removed = sorted(a_ids - b_ids)
        common = sorted(a_ids & b_ids)

        modified = []
        for eid in common:
            a_text, a_lv = self.left.entries[eid]
            b_text, b_lv = self.right.entries[eid]
            if (
                a_text != b_text
                or a_lv != b_lv
                or self.left.entry_domains.get(eid, set())
                != self.right.entry_domains.get(eid, set())
            ):
                modified.append(eid)
        return added, removed, modified

    def diff_translations(self):
        a_keys = set(self.left.trans.keys())
        b_keys = set(self.right.trans.keys())

        added = sorted(b_keys - a_keys)  # list[(eid, code)]
        removed = sorted(a_keys - b_keys)
        common = sorted(a_keys & b_keys)

        modified = []
        for key in common:
            a_text, a_rom = self.left.trans[key]
            b_text, b_rom = self.right.trans[key]
            if a_text != b_text or a_rom != b_rom:
                modified.append(key)
        return added, removed, modified


class Command(BaseCommand):
    help = "Diff corpus DB vs git ref (default: main:db.sqlite3) and print compact per-entry blocks."

    def add_arguments(self, parser):
        parser.add_argument(
            "--other-db", default="", help="Path to another sqlite DB (skips git)."
        )
        parser.add_argument(
            "--git-ref",
            default="main",
            help="Git ref to extract db.sqlite3 from if --other-db not given.",
        )
        parser.add_argument(
            "--db-path",
            default="corpan/dja/db.sqlite3",
            help="Repo-relative DB path used with --git-ref.",
        )
        parser.add_argument(
            "--max",
            type=int,
            default=50,
            help="Max entry blocks to print (summary always shows counts).",
        )
        parser.add_argument(
            "--random",
            action="store_true",
            help="Sample random changed entries (size = --max).",
        )
        parser.add_argument(
            "--seed", type=int, default=None, help="RNG seed for --random."
        )
        parser.add_argument(
            "--show-domains",
            action="store_true",
            help="Show domain changes in entry blocks.",
        )

    def handle(self, *args, **opts):
        repo_root = self._repo_root()
        current_db = settings.DATABASES["default"]["NAME"]
        other_db = opts["other_db"]
        tmp_path = None

        if opts["random"] and opts["seed"] is not None:
            random.seed(opts["seed"])

        if not other_db:
            tmp_path = git_extract_file(opts["git_ref"], repo_root, opts["db_path"])
            other_db = tmp_path

        left = Snapshot(other_db)
        right = Snapshot(current_db)
        left.load()
        right.load()

        diff = CorpusDiff(left, right)

        e_added, e_removed, e_modified = diff.diff_entries()
        t_added, t_removed, t_modified = diff.diff_translations()

        # Build per-entry translation change maps
        add_by_e: Dict[int, List[str]] = {}
        rem_by_e: Dict[int, List[str]] = {}
        mod_by_e: Dict[int, List[str]] = {}
        for eid, code in t_added:
            add_by_e.setdefault(eid, []).append(code)
        for eid, code in t_removed:
            rem_by_e.setdefault(eid, []).append(code)
        for eid, code in t_modified:
            mod_by_e.setdefault(eid, []).append(code)

        # Entries we will show blocks for (entry changed OR any translation changed)
        changed_entry_ids: List[int] = sorted(
            set(e_added)
            | set(e_removed)
            | set(e_modified)
            | set(add_by_e.keys())
            | set(rem_by_e.keys())
            | set(mod_by_e.keys())
        )

        self.stdout.write(
            self.style.NOTICE(
                f"[Entries] added={len(e_added)} removed={len(e_removed)} modified={len(e_modified)}"
            )
        )
        self.stdout.write(
            self.style.NOTICE(
                f"[Translations] added={len(t_added)} removed={len(t_removed)} modified={len(t_modified)}"
            )
        )

        if not changed_entry_ids:
            self.stdout.write(self.style.SUCCESS("\nNo changes."))
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)
            return

        subset = pick(changed_entry_ids, opts["max"], opts["random"])
        if len(changed_entry_ids) > len(subset):
            how = "random sample" if opts["random"] else "first"
            self.stdout.write(
                self.style.NOTICE(
                    f"\nShowing {len(subset)} entry blocks ({how}); {len(changed_entry_ids) - len(subset)} more."
                )
            )
        else:
            self.stdout.write("")

        # Print compact per-entry blocks
        for eid in subset:
            self._print_entry_block(
                eid=eid,
                left=left,
                right=right,
                e_added=set(e_added),
                e_removed=set(e_removed),
                e_modified=set(e_modified),
                add_by_e=add_by_e,
                rem_by_e=rem_by_e,
                mod_by_e=mod_by_e,
                show_domains=opts["show_domains"],
            )

        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)

    def _print_entry_block(
        self,
        *,
        eid: int,
        left: Snapshot,
        right: Snapshot,
        e_added: Set[int],
        e_removed: Set[int],
        e_modified: Set[int],
        add_by_e: Dict[int, List[str]],
        rem_by_e: Dict[int, List[str]],
        mod_by_e: Dict[int, List[str]],
        show_domains: bool,
    ):
        status = "+"
        side = "right"
        if eid in e_removed:
            status = "-"
            side = "left"
        elif eid in e_modified or eid in add_by_e or eid in rem_by_e or eid in mod_by_e:
            status = "~"
            side = "right"

        # Entry metadata
        if side == "right":
            en_text, level = right.entries.get(eid, ("", ""))
            # doms = right.entry_domains.get(eid, set())
        else:
            en_text, level = left.entries.get(eid, ("", ""))
            # doms = left.entry_domains.get(eid, set())

        # Header
        hdr_level = f"[{level}]" if level else ""
        self.stdout.write(self.style.NOTICE(f"{status} #{eid} {hdr_level}"))

        # Domain changes (optional)
        if show_domains:
            a_dom = left.entry_domains.get(eid, set())
            b_dom = right.entry_domains.get(eid, set())
            if status == "+":
                if b_dom:
                    self.stdout.write(f"  domains: +{sorted(b_dom)}")
            elif status == "-":
                if a_dom:
                    self.stdout.write(f"  domains: -{sorted(a_dom)}")
            else:
                if a_dom != b_dom:
                    self.stdout.write(f"  domains: {sorted(a_dom)} → {sorted(b_dom)}")

        # EN line
        if status == "~" and eid in e_modified:
            a_text, a_lv = left.entries.get(eid, ("", ""))
            b_text, b_lv = right.entries.get(eid, ("", ""))
            if a_lv != b_lv:
                self.stdout.write(f"  level: {a_lv} → {b_lv}")
            if a_text != b_text:
                self.stdout.write(f"  EN: {shorten(a_text)} → {shorten(b_text)}")
            else:
                self.stdout.write(f"  EN: {shorten(b_text)}")
        elif status == "+":
            self.stdout.write(f"  EN: {shorten(en_text)}")
        elif status == "-":
            self.stdout.write(f"  EN: {shorten(en_text)}")
        else:
            # entry unchanged but translations changed
            self.stdout.write(f"  EN: {shorten(en_text)}")

        # Translation changes under this entry
        # Added
        for code in sorted(add_by_e.get(eid, [])):
            t_text, t_rom = right.trans.get((eid, code), ("", ""))
            line = f"  + [{code}] {shorten(t_text)}"
            if t_rom:
                line += f"  ({shorten(t_rom)})"
            self.stdout.write(line)

        # Removed
        for code in sorted(rem_by_e.get(eid, [])):
            t_text, t_rom = left.trans.get((eid, code), ("", ""))
            line = f"  - [{code}] {shorten(t_text)}"
            if t_rom:
                line += f"  ({shorten(t_rom)})"
            self.stdout.write(line)

        # Modified
        for code in sorted(mod_by_e.get(eid, [])):
            a_text, a_rom = left.trans.get((eid, code), ("", ""))
            b_text, b_rom = right.trans.get((eid, code), ("", ""))
            show_text = a_text != b_text
            show_rom = a_rom != b_rom
            pieces: List[str] = []
            if show_text:
                pieces.append(f"text: {shorten(a_text)} → {shorten(b_text)}")
            if show_rom:
                pieces.append(f"rom: {shorten(a_rom)} → {shorten(b_rom)}")
            # Single compact line
            self.stdout.write(
                f"  ~ [{code}] "
                + ("; ".join(pieces) if pieces else "(no visible diff)")
            )

        self.stdout.write("")  # blank line between blocks

    def _repo_root(self) -> str:
        try:
            out = (
                subprocess.check_output(["git", "rev-parse", "--show-toplevel"])
                .decode()
                .strip()
            )
            return out
        except subprocess.CalledProcessError as e:
            raise CommandError(f"Not a git repo? {e}")
