"""Portable Windows trust controls using public certificates and synthetic stores."""

import base64, copy, ctypes, hashlib, importlib.util, json, pathlib, ssl, unittest
from unittest.mock import patch
from types import SimpleNamespace
import os, sys

ROOT = pathlib.Path(__file__).resolve().parent


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


inventory = module("public_windows_inventory", ROOT / "windows_trust_inventory.py")
adapter = module("public_windows_repair", ROOT / "windows_trust_repair.py")
MANIFEST = (ROOT / "windows-trust-public-certificates.json").read_bytes()
CERTS = inventory.manifest(MANIFEST)
DIGEST = next(h for h, c in CERTS.items() if c["kind"] == "root")
DER = base64.b64decode(CERTS[DIGEST]["der_base64"])
ACTION = {
    "location": "LocalMachine",
    "store": "ROOT",
    "physical": ".Default",
    "der_sha256": DIGEST,
}
ADMIN_ACES = [
    {"type": 0, "flags": 3, "mask": 0x1F01FF, "sid": sid}
    for sid in adapter.TRUSTED_SIDS
]
CA = (
    ROOT.parents[1] / "corpan/infra/terraform/tls-trust/ca-certificates.pem"
).read_text()
import re

ORDINARY_DER = ssl.PEM_cert_to_DER_cert(
    re.search(
        r"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----", CA, re.S
    ).group()
)
ORDINARY = hashlib.sha256(ORDINARY_DER).hexdigest()
# A separate public synthetic negative identity; no host certificates are fixtures.
NEGATIVE_DER = ORDINARY_DER[:-1] + bytes([ORDINARY_DER[-1] ^ 1])
NEGATIVE = hashlib.sha256(NEGATIVE_DER).hexdigest()
ALL_DER = {h: base64.b64decode(c["der_base64"]) for h, c in CERTS.items()} | {
    ORDINARY: ORDINARY_DER,
    NEGATIVE: NEGATIVE_DER,
}


def description(hashes):
    return inventory.describe([ALL_DER[h] for h in sorted(hashes)], CERTS)


class InventoryControls(unittest.TestCase):
    def test_public_twenty_der_and_twelve_spki_identities(self):
        self.assertEqual(len(CERTS), 20)
        self.assertEqual(sum(c["kind"] == "root" for c in CERTS.values()), 4)
        self.assertEqual(len({c["spki_sha256"] for c in CERTS.values()}), 12)

    def test_malformed_der_or_unknown_same_key_variant_is_not_ignored(self):
        for der in (b"", b"\x30\x80", DER[:-1], DER + b"\0"):
            with self.assertRaises(RuntimeError):
                inventory.spki_sha256(der)
        changed = DER[:-1] + bytes([DER[-1] ^ 1])
        self.assertTrue(
            inventory.describe([changed], CERTS)["affected_or_unknown_key_matches"][0][
                "unknown_der_with_affected_spki"
            ]
        )

    def test_readonly_native_open_existing_and_unsigned_eof(self):
        class Call:
            def __init__(self, fn):
                self.fn = fn

            def __call__(self, *args):
                return self.fn(*args)

        calls = []
        api = SimpleNamespace()
        api.CertOpenStore = Call(lambda *args: calls.append(args) or 1)
        api.CertEnumCertificatesInStore = Call(lambda *args: inventory.PCCERT())
        for name in (
            "CertFreeCertificateContext",
            "CertCloseStore",
            "CertEnumPhysicalStore",
        ):
            setattr(api, name, Call(lambda *args: True))
        with (
            patch.object(inventory.sys, "platform", "win32"),
            patch.object(inventory.ctypes, "WinDLL", return_value=api, create=True),
            patch.object(
                inventory.ctypes, "WINFUNCTYPE", return_value=lambda fn: fn, create=True
            ),
            patch.object(
                inventory.ctypes,
                "get_last_error",
                return_value=0x80092004 - 2**32,
                create=True,
            ),
        ):
            backend = inventory.ReadOnlyWindows()
            self.assertEqual(
                backend.certificates("LocalMachine", "ROOT")["certificates"], []
            )
            backend.certificates("CurrentUser", "CA", ".Default")
        self.assertEqual([call[0].value for call in calls], [10, 14])
        self.assertTrue(all(call[3] & 0xC000 == 0xC000 for call in calls))
        self.assertFalse(any("Add" in name or "Delete" in name for name in vars(api)))

    def test_all_x509_identity_set_includes_non_server_auth_certificates(self):
        other = base64.b64decode(
            next(c for h, c in CERTS.items() if h != DIGEST)["der_base64"]
        )

        class Backend:
            def certificates(self, *args):
                return {"opened": True, "error": None, "certificates": [DER, other]}

            def physical_names(self, *args):
                return {
                    "names": [".Default"],
                    "attempts": [
                        {"enumerated": True, "predefined_flag": False, "error": None}
                    ],
                }

        context = SimpleNamespace(
            verify_flags=32768, get_ca_certs=lambda **kwargs: [DER, other]
        )
        registry = SimpleNamespace(
            HKEY_LOCAL_MACHINE=0,
            KEY_READ=0,
            REG_DWORD=4,
            OpenKey=lambda *args: (_ for _ in ()).throw(FileNotFoundError()),
        )
        records = [
            (DER, "x509_asn", {ssl.Purpose.SERVER_AUTH.oid}),
            (other, "x509_asn", {"1.3.6.1.5.5.7.3.3"}),
        ]
        with (
            patch.object(inventory.sys, "platform", "win32"),
            patch.dict(
                os.environ,
                {"GITHUB_ACTIONS": "true", "RUNNER_ENVIRONMENT": "github-hosted"},
            ),
            patch.object(inventory, "ReadOnlyWindows", Backend),
            patch.object(
                inventory,
                "admin_capability",
                return_value={
                    "administrators_membership": True,
                    "token_elevated": True,
                },
            ),
            patch.object(
                inventory.ssl, "enum_certificates", return_value=records, create=True
            ),
            patch.object(inventory.ssl, "create_default_context", return_value=context),
            patch.dict(sys.modules, {"winreg": registry}),
        ):
            report = inventory.collect(MANIFEST, ROOT / "public-cafile")
        for name in ("ROOT", "CA"):
            self.assertEqual(
                report["python_aggregate"][name]["all_x509"]["certificate_count"], 2
            )
            self.assertEqual(
                report["python_aggregate"][name]["server_auth_selected"][
                    "certificate_count"
                ],
                1,
            )


class StoreFixture:
    def __init__(self, delete_ok=True, duplicate=False):
        self.events = []
        self.deleted = False
        self.delete_ok = delete_ok
        self.added = False
        self.bytes = (ctypes.c_ubyte * len(DER)).from_buffer_copy(DER)
        self.context = inventory.CERT_CONTEXT()
        self.context.encoding = 1
        self.context.encoded = self.bytes
        self.context.size = len(DER)
        self.pointer = ctypes.pointer(self.context)
        self.remaining = [self.pointer] * (2 if duplicate else 1)
        fixture = self

        class Api:
            def CertOpenStore(self, *args):
                fixture.events.append(("open", args))
                return 11

            def CertEnumCertificatesInStore(self, *args):
                return (
                    fixture.remaining.pop(0)
                    if fixture.remaining
                    else inventory.PCCERT()
                )

            def CertDuplicateCertificateContext(self, p):
                fixture.events.append(("duplicate",))
                return p

            def CertDeleteCertificateFromStore(self, p):
                fixture.events.append(("delete-consumes",))
                fixture.deleted = fixture.delete_ok
                return fixture.delete_ok

            def CertFreeCertificateContext(self, p):
                fixture.events.append(("free",))
                return True

            def CertCloseStore(self, *args):
                fixture.events.append(("close",))
                return True

            def CertAddEncodedCertificateToStore(
                self, h, encoding, pointer, length, disposition, out
            ):
                fixture.events.append(
                    ("add", encoding, ctypes.string_at(pointer, length), disposition)
                )
                fixture.added = True
                return True

        self.api = Api()

    def certificates(self, location, store, physical):
        certs = (
            ([DER] if self.added else [])
            if store == "Disallowed"
            else ([] if self.deleted else [DER])
        )
        return {"opened": True, "certificates": certs}

    def native(self):
        value = object.__new__(adapter.NativeExactStores)
        value.inventory = inventory
        value.certificates = CERTS
        value.backend = self
        value.api = self.api
        return value


class NativeControls(unittest.TestCase):
    def test_ordinary_admin_path_and_exact_protected_acl(self):
        adapter.check_directory_security("S-1-5-18", ADMIN_ACES, 0x10, True, True)
        ordinary = ADMIN_ACES + [
            {"type": 0, "flags": 0, "mask": 0x1200A9, "sid": "S-1-1-0"}
        ]
        adapter.check_directory_security("S-1-5-18", ordinary, 0x10)
        # Create-subdirectory permission alone cannot replace the exclusive child.
        adapter.check_directory_security(
            "S-1-5-18",
            ADMIN_ACES + [{"type": 0, "flags": 0, "mask": 4, "sid": "S-1-1-0"}],
            0x10,
        )

    def test_untrusted_owner_reparse_or_dangerous_ancestor_fails(self):
        for owner, attributes, aces in [
            ("S-1-1-0", 0x10, ADMIN_ACES),
            ("S-1-5-18", 0x410, ADMIN_ACES),
        ]:
            with self.assertRaises(RuntimeError):
                adapter.check_directory_security(owner, aces, attributes)
        for mask in (
            0x10000000,
            0x40000000,
            0x40,
            0x10000,
            0x40000,
            0x80000,
            0x100,
            0x10,
        ):
            with self.assertRaises(RuntimeError):
                adapter.check_directory_security(
                    "S-1-5-18",
                    ADMIN_ACES
                    + [{"type": 0, "flags": 0, "mask": mask, "sid": "S-1-1-0"}],
                    0x10,
                )

    def test_unknown_ace_unprotected_or_additional_backup_identity_fails(self):
        for aces, protected in [
            (ADMIN_ACES, False),
            (ADMIN_ACES + [{"type": 0, "flags": 3, "mask": 1, "sid": "S-1-1-0"}], True),
            ([{"type": 5, "flags": 0, "mask": 0, "sid": "S-1-5-18"}], True),
        ]:
            with self.assertRaises(RuntimeError):
                adapter.check_directory_security(
                    "S-1-5-18", aces, 0x10, True, protected
                )

    def test_trustedinstaller_is_ancestor_only_not_backup_principal(self):
        ti = {
            "type": 0,
            "flags": 0,
            "mask": 0x1F01FF,
            "sid": adapter.TRUSTED_INSTALLER_SID,
        }
        adapter.check_directory_security(
            adapter.TRUSTED_INSTALLER_SID, ADMIN_ACES + [ti], 0x10
        )
        with self.assertRaises(RuntimeError):
            adapter.check_directory_security(
                adapter.TRUSTED_INSTALLER_SID, ADMIN_ACES, 0x10, True, True
            )
        with self.assertRaises(RuntimeError):
            adapter.check_directory_security(
                "S-1-5-18", ADMIN_ACES + [ti], 0x10, True, True
            )

    def test_enumeration_bound_refuses_before_delete_and_frees_target(self):
        fixture = StoreFixture()
        fixture.remaining = [fixture.pointer] * 4097
        with patch.object(
            inventory.ctypes, "get_last_error", return_value=0x80092004, create=True
        ):
            with self.assertRaisesRegex(RuntimeError, "review bound"):
                fixture.native().delete_exact(ACTION)
        self.assertNotIn("delete-consumes", [x[0] for x in fixture.events])
        self.assertEqual([x[0] for x in fixture.events][-3:], ["free", "free", "close"])

    def test_readonly_source_is_exact_reviewed_digest(self):
        self.assertEqual(
            hashlib.sha256(pathlib.Path(inventory.__file__).read_bytes()).hexdigest(),
            adapter.INVENTORY_SHA,
        )

    def test_unreviewed_store_or_der_fails_before_open(self):
        fixture = StoreFixture()
        native = fixture.native()
        for changed in (
            {"physical": ".Flight"},
            {"location": "LocalMachineGroupPolicy"},
            {"der_sha256": "f" * 64},
        ):
            action = ACTION | changed
            with self.assertRaises(RuntimeError):
                native.delete_exact(action)
        self.assertEqual(fixture.events, [])

    def test_exact_delete_uses_physical_open_existing_and_refingerprint(self):
        fixture = StoreFixture()
        with patch.object(
            inventory.ctypes,
            "get_last_error",
            return_value=0x80092004 - 2**32,
            create=True,
        ):
            self.assertEqual(fixture.native().delete_exact(ACTION), "deleted")
        opened = fixture.events[0][1]
        self.assertEqual(opened[0].value, 14)
        self.assertEqual(opened[3], inventory.LOCATIONS["LocalMachine"] | 0x4000)
        self.assertEqual(
            ctypes.cast(opened[4], ctypes.c_wchar_p).value, "ROOT\\.Default"
        )
        self.assertEqual(
            [x[0] for x in fixture.events],
            ["open", "duplicate", "delete-consumes", "close"],
        )

    def test_delete_failure_consumes_target_once_and_closes(self):
        fixture = StoreFixture(delete_ok=False)
        with patch.object(
            inventory.ctypes, "get_last_error", return_value=0x80092004, create=True
        ):
            with self.assertRaises(RuntimeError):
                fixture.native().delete_exact(ACTION)
        self.assertEqual(
            [x[0] for x in fixture.events],
            ["open", "duplicate", "delete-consumes", "close"],
        )

    def test_duplicate_contexts_or_enum_error_never_delete(self):
        for duplicate, error in ((True, 0x80092004), (False, 5)):
            fixture = StoreFixture(duplicate=duplicate)
            with patch.object(
                inventory.ctypes, "get_last_error", return_value=error, create=True
            ):
                with self.assertRaises(RuntimeError):
                    fixture.native().delete_exact(ACTION)
            self.assertNotIn("delete-consumes", [x[0] for x in fixture.events])
            self.assertEqual([x[0] for x in fixture.events][-2:], ["free", "close"])

    def test_add_disallowed_exact_public_der_add_new_then_readback(self):
        fixture = StoreFixture()
        action = ACTION | {"store": "Disallowed"}
        self.assertEqual(fixture.native().add_disallowed(action), "added")
        self.assertIn(("add", 1, DER, 1), fixture.events)
        self.assertEqual(fixture.native().add_disallowed(action), "already-present")
        self.assertEqual(sum(x[0] == "add" for x in fixture.events), 1)

    def test_manifest_spki_tampering_prevents_open(self):
        fixture = StoreFixture()
        native = fixture.native()
        native.certificates = {h: c.copy() for h, c in CERTS.items()}
        native.certificates[DIGEST]["spki_sha256"] = "f" * 64
        with self.assertRaises(RuntimeError):
            native.delete_exact(ACTION)
        self.assertEqual(fixture.events, [])


class SyntheticStores:
    def __init__(self, bad="all", intermediates=False, preexisting=False):
        roots = [h for h, c in CERTS.items() if c["kind"] == "root"]
        bad_roots = set(
            roots if bad == "all" else roots[:2] if bad == "partial" else []
        )
        aaa = next(
            h for h, c in CERTS.items() if c["name"] == "AAA Certificate Services"
        )
        self.positive = {
            ("LocalMachine", "ROOT", ".Default"): {ORDINARY} | (bad_roots - {aaa}),
            ("LocalMachine", "ROOT", ".AuthRoot"): bad_roots & {aaa},
            ("LocalMachine", "CA", ".Default"): {ORDINARY}
            | (
                {h for h, c in CERTS.items() if c["kind"] == "intermediate"}
                if intermediates
                else set()
            ),
            ("CurrentUser", "ROOT", ".Default"): set(),
            ("CurrentUser", "CA", ".Default"): set(),
        }
        self.negative = {
            location: ({NEGATIVE, next(iter(CERTS))} if preexisting else set())
            for location in ("LocalMachine", "CurrentUser")
        }
        self.events = []
        self.safe_backup = True
        self.drift = False
        self.version = "synthetic"
        self.skip_negative = False
        self.corrupt_ordinary = False
        self.corrupt_negative = False
        self.reimport = False

    def report(self):
        rows = []
        for location in inventory.LOCATIONS:
            for store in inventory.STORES:
                opened = location not in ("Services", "Users")
                physical = []
                if opened:
                    hashes = (
                        set(self.negative.get(location, set()))
                        if store == "Disallowed"
                        else set(
                            self.positive.get((location, store, ".Default"), set())
                        )
                    )
                    physical = [
                        {
                            "name": ".Default",
                            "opened": True,
                            "open_error": None,
                            **description(hashes),
                        }
                    ]
                    if location == "LocalMachine" and store == "ROOT":
                        physical.append(
                            {
                                "name": ".AuthRoot",
                                "opened": True,
                                "open_error": None,
                                **description(
                                    self.positive[("LocalMachine", "ROOT", ".AuthRoot")]
                                ),
                            }
                        )
                    if location == "CurrentUser":
                        inherited = (
                            set(self.negative["LocalMachine"])
                            if store == "Disallowed"
                            else set().union(
                                *(
                                    v
                                    for key, v in self.positive.items()
                                    if key[0] == "LocalMachine" and key[1] == store
                                )
                            )
                        )
                        physical.append(
                            {
                                "name": ".LocalMachine",
                                "opened": True,
                                "open_error": None,
                                **description(inherited),
                            }
                        )
                union = set().union(*(set(p["unique_der_sha256"]) for p in physical))
                rows.append(
                    {
                        "location": location,
                        "store": store,
                        "opened": opened,
                        "open_error": None if opened else 0x80070057,
                        "logical": description(union),
                        "physical_stores": physical,
                        "physical_enumeration": {
                            "attempts": [
                                {
                                    "enumerated": opened,
                                    "predefined_flag": False,
                                    "error": None if opened else 0x80070057,
                                }
                            ]
                        },
                    }
                )
        aggregates = {}
        for store in ("ROOT", "CA"):
            hashes = set().union(
                *(
                    set(row["logical"]["unique_der_sha256"])
                    for row in rows
                    if row["store"] == store and row["opened"]
                )
            )
            aggregates[store] = {
                "all_encoding_record_count": len(hashes),
                "all_x509": description(hashes),
                "server_auth_selected": description(hashes),
            }
        anchors = set().union(
            *(
                set(a["server_auth_selected"]["unique_der_sha256"])
                for a in aggregates.values()
            )
        )
        return {
            "read_only": True,
            "native_certificate_mutation_api_used": False,
            "admin_capability": {
                "administrators_membership": True,
                "token_elevated": True,
            },
            "manifest_sha256": inventory.MANIFEST_SHA256,
            "store_inventory": rows,
            "explicit_context_anchors": description({ORDINARY}),
            "default_context_anchors": description(anchors),
            "python_aggregate": aggregates,
            "root_update_policy_presence": {"synthetic": True},
            "synthetic_generation": self.version,
        }

    def backup_factory(self):
        model = self

        class Backup:
            def create(self, plan, certificates):
                model.events.append("backup")
                if model.drift:
                    model.version = "changed-during-backup"
                return {
                    "protected": model.safe_backup,
                    "only_reviewed_public_der": True,
                }

            def close(self):
                model.events.append("close-backup")

        return Backup()

    def store_factory(self, inv, certificates):
        model = self
        model.events.append("store-init")

        class Native:
            def __init__(self):
                self.backend = self

            def add_disallowed(self, action):
                model.events.append("add")
                if not model.skip_negative:
                    model.negative[action["location"]].add(action["der_sha256"])

            def delete_exact(self, action):
                model.events.append("delete")
                key = (action["location"], action["store"], action["physical"])
                model.positive[key].remove(action["der_sha256"])
                if model.corrupt_ordinary:
                    model.positive[("LocalMachine", "ROOT", ".Default")].discard(
                        ORDINARY
                    )
                if model.corrupt_negative:
                    model.negative["LocalMachine"].discard(NEGATIVE)
                if model.reimport:
                    model.positive[key].add(action["der_sha256"])

            def certificates(self, location, store, physical):
                return {
                    "opened": True,
                    "certificates": [ALL_DER[h] for h in model.negative[location]],
                }

        return Native()

    def repair(self):
        return adapter._repair_inventory(
            inventory,
            CERTS,
            self.report(),
            self.report,
            self.backup_factory,
            self.store_factory,
        )


class ProductionPolicyControls(unittest.TestCase):
    def test_full_twenty_public_anchors_removed_after_all_missing_negatives_and_backup(
        self,
    ):
        model = SyntheticStores(intermediates=True)
        result = model.repair()
        self.assertEqual(result["positive_anchors_removed"], 20)
        self.assertEqual(result["negative_entries_added"], 40)
        self.assertTrue(result["ordinary_certificates_preserved"])
        self.assertEqual(model.events[0], "backup")
        self.assertLess(
            max(i for i, v in enumerate(model.events) if v == "add"),
            min(i for i, v in enumerate(model.events) if v == "delete"),
        )

    def test_partial_and_already_clean_positive_stores_are_supported(self):
        for bad, expected in [("partial", 2), ("none", 0)]:
            model = SyntheticStores(bad)
            result = model.repair()
            self.assertEqual(result["positive_anchors_removed"], expected)
            self.assertFalse(result["idempotent"])

    def test_unrelated_negative_entries_preserved_and_second_check_makes_no_writes(
        self,
    ):
        model = SyntheticStores(preexisting=True)
        result = model.repair()
        self.assertEqual(result["negative_entries_added"], 38)
        self.assertTrue(all(NEGATIVE in hashes for hashes in model.negative.values()))
        model.events = []
        second = model.repair()
        self.assertTrue(second["idempotent"])
        self.assertFalse(second["protected_backup_created"])
        self.assertEqual(model.events, [])

    def test_insecure_backup_or_during_backup_drift_never_opens_writable_store(self):
        for field in ("safe_backup", "drift"):
            model = SyntheticStores()
            setattr(model, field, False if field == "safe_backup" else True)
            with self.assertRaises(RuntimeError):
                model.repair()
            self.assertNotIn("store-init", model.events)

    def test_missing_negative_anchor_prevents_every_positive_deletion(self):
        model = SyntheticStores()
        model.skip_negative = True
        with self.assertRaisesRegex(RuntimeError, "negative anchors incomplete"):
            model.repair()
        self.assertNotIn("delete", model.events)

    def test_changed_ordinary_positive_negative_or_reimport_cannot_report_success(self):
        for flag in ("corrupt_ordinary", "corrupt_negative", "reimport"):
            model = SyntheticStores(preexisting=True)
            setattr(model, flag, True)
            with self.assertRaises(RuntimeError):
                model.repair()

    def test_unknown_key_origin_nonadmin_access_union_or_python_mismatch_fail_before_backup(
        self,
    ):
        for problem in (
            "key",
            "origin",
            "admin",
            "access",
            "union",
            "python",
            "unknown-provider",
            "same-count-python-mismatch",
        ):
            model = SyntheticStores()
            report = model.report()
            if problem == "key":
                report["store_inventory"][0]["logical"][
                    "affected_or_unknown_key_matches"
                ][0]["unknown_der_with_affected_spki"] = True
            if problem == "origin":
                report["store_inventory"][0]["physical_stores"][0]["name"] = (
                    ".GroupPolicy"
                )
            if problem == "admin":
                report["admin_capability"]["token_elevated"] = False
            if problem == "access":
                report["store_inventory"][-1]["open_error"] = 5
            if problem == "union":
                report["store_inventory"][0]["physical_stores"][0][
                    "unique_der_sha256"
                ].pop()
            if problem == "python":
                report["python_aggregate"]["CA"]["all_encoding_record_count"] += 1
            if problem == "same-count-python-mismatch":
                report["python_aggregate"]["ROOT"]["all_x509"]["unique_der_sha256"][
                    0
                ] = "f" * 64
            if problem == "unknown-provider":
                report["store_inventory"][0]["physical_stores"][0]["name"] = (
                    ".Unclassified"
                )
            with self.assertRaises(RuntimeError):
                adapter._repair_inventory(
                    inventory,
                    CERTS,
                    report,
                    model.report,
                    model.backup_factory,
                    model.store_factory,
                )
            self.assertEqual(model.events, [])

    def test_manifest_changes_or_same_affected_key_unknown_der_are_not_accepted(self):
        with self.assertRaises(RuntimeError):
            inventory.manifest(MANIFEST + b" ")
        changed = DER[:-1] + bytes([DER[-1] ^ 1])
        described = inventory.describe([changed], CERTS)
        self.assertTrue(
            described["affected_or_unknown_key_matches"][0][
                "unknown_der_with_affected_spki"
            ]
        )


class RuntimeBoundaryControls(unittest.TestCase):
    def invoke(self, model, fail=False):
        import tempfile

        with tempfile.TemporaryDirectory() as d:
            root = pathlib.Path(d)
            ca = root / "ca.pem"
            ca.write_text(CA)
            empty = root / "empty"
            empty.mkdir()

            def collect(data, cafile):
                self.assertEqual(os.environ["SSL_CERT_FILE"], str(ca))
                self.assertEqual(os.environ["SSL_CERT_DIR"], str(empty))
                return model.report()

            fake = SimpleNamespace(
                __source_sha256__=adapter.INVENTORY_SHA,
                manifest=inventory.manifest,
                collect=collect,
            )
            environment = {
                "GITHUB_ACTIONS": "true",
                "RUNNER_ENVIRONMENT": "github-hosted",
                "SSL_CERT_FILE": "original-public-selection",
                "SSL_CERT_DIR": "original-directory",
            }
            with (
                patch.object(adapter.sys, "platform", "win32"),
                patch.dict(os.environ, environment, clear=True),
                patch.object(
                    pathlib.Path, "is_junction", return_value=False, create=True
                ),
                patch.object(
                    adapter, "SecurePublicBackup", side_effect=model.backup_factory
                ),
                patch.object(
                    adapter, "NativeExactStores", side_effect=model.store_factory
                ),
            ):
                if fail:
                    with self.assertRaises(RuntimeError):
                        adapter.repair(fake, MANIFEST, ca, empty)
                    result = None
                else:
                    result = adapter.repair(fake, MANIFEST, ca, empty)
                self.assertEqual(
                    os.environ["SSL_CERT_FILE"], environment["SSL_CERT_FILE"]
                )
                self.assertEqual(
                    os.environ["SSL_CERT_DIR"], environment["SSL_CERT_DIR"]
                )
            return result

    def test_runtime_selects_clean_paths_restores_environment_and_emits_no_host_inventory(
        self,
    ):
        model = SyntheticStores(preexisting=True)
        result = self.invoke(model)
        self.assertTrue(result["fresh_default_context_clear"])
        self.assertNotIn("store_inventory", json.dumps(result))
        self.assertNotIn(ORDINARY, json.dumps(result))
        model.events = []
        self.assertTrue(self.invoke(model)["idempotent"])
        self.assertEqual(model.events, [])

    def test_runtime_failure_restores_paths_and_never_exports_root_report(self):
        model = SyntheticStores()
        model.safe_backup = False
        self.invoke(model, True)
        self.assertNotIn("store-init", model.events)

    def test_unverified_inventory_fails_before_read_or_mutation(self):
        fake = SimpleNamespace(__source_sha256__="unreviewed")
        with (
            patch.object(adapter.sys, "platform", "win32"),
            patch.dict(
                os.environ,
                {"GITHUB_ACTIONS": "true", "RUNNER_ENVIRONMENT": "github-hosted"},
            ),
        ):
            with self.assertRaisesRegex(RuntimeError, "verified inventory"):
                adapter.repair(fake, MANIFEST, "unused", "unused")


if __name__ == "__main__":
    unittest.main()
