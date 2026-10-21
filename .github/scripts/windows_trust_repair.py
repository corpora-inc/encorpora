"""Exact public-certificate repair for fresh GitHub-hosted Windows CI.

Ordinary certificates and update, revocation and enrollment policy are preserved.
Backups contain only reviewed public certificates and certificate-identity hashes.
Transport validation belongs in separate platform checks.
"""

import base64, ctypes, hashlib, json, os, pathlib, sys, uuid
from ctypes import wintypes

TRUSTED_SIDS = {"S-1-5-18", "S-1-5-32-544"}
TRUSTED_INSTALLER_SID = "S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464"
ANCESTOR_TRUSTED_SIDS = TRUSTED_SIDS | {TRUSTED_INSTALLER_SID}
# Directory creation permissions do not grant replacement of an existing child.
# Reject non-admin delete/delete-child, ACL/owner and metadata modification rights.
ANCESTOR_DANGEROUS = (
    0x10000000 | 0x40000000 | 0x10000 | 0x40000 | 0x80000 | 0x40 | 0x100 | 0x10
)
BACKUP_SDDL = "O:BAG:BAD:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)"
INVENTORY_SHA = "82afa68fa562894d041de9b92e94ae7152838ca85f1fa6ab291b37b899d7cc51"
CANONICAL_REMOVALS = {
    ("LocalMachine", "ROOT", ".Default"),
    ("LocalMachine", "ROOT", ".AuthRoot"),
    ("LocalMachine", "CA", ".Default"),
    ("CurrentUser", "ROOT", ".Default"),
    ("CurrentUser", "CA", ".Default"),
}


def require(ok, message):
    if not ok:
        raise RuntimeError(message)


def check_directory_security(owner, aces, attributes, strict=False, protected=False):
    require(not attributes & 0x400, "reparse point rejected")
    require(attributes & 0x10, "not a directory")
    require(owner in ANCESTOR_TRUSTED_SIDS, "untrusted directory owner")
    for ace in aces:
        require(ace["type"] in (0, 1), "unsupported DACL ACE type")
        if ace["type"] == 1 or ace["flags"] & 8:
            continue
        require(
            ace["sid"] in ANCESTOR_TRUSTED_SIDS or not ace["mask"] & ANCESTOR_DANGEROUS,
            "nonadministrator can replace or alter protected path",
        )
    if strict:
        require(owner in TRUSTED_SIDS, "backup owner must be SYSTEM or Administrators")
        require(protected, "backup DACL must be protected")
        allowed = [a for a in aces if a["type"] == 0 and not a["flags"] & 8]
        require(
            len(allowed) == 2 and {a["sid"] for a in allowed} == TRUSTED_SIDS,
            "backup ACL contains unexpected identities",
        )
        require(
            all(a["mask"] == 0x1F01FF and a["flags"] & 3 == 3 for a in allowed),
            "backup ACL lacks full inherited admin/system protection",
        )


class SECURITY_ATTRIBUTES(ctypes.Structure):
    _fields_ = [
        ("length", wintypes.DWORD),
        ("descriptor", ctypes.c_void_p),
        ("inherit", wintypes.BOOL),
    ]


class FILE_INFO(ctypes.Structure):
    _fields_ = [
        ("attributes", wintypes.DWORD),
        ("creation", wintypes.FILETIME),
        ("access", wintypes.FILETIME),
        ("write", wintypes.FILETIME),
        ("volume", wintypes.DWORD),
        ("size_high", wintypes.DWORD),
        ("size_low", wintypes.DWORD),
        ("links", wintypes.DWORD),
        ("index_high", wintypes.DWORD),
        ("index_low", wintypes.DWORD),
    ]


class ACL(ctypes.Structure):
    _fields_ = [
        ("revision", ctypes.c_ubyte),
        ("sbz1", ctypes.c_ubyte),
        ("size", ctypes.c_ushort),
        ("count", ctypes.c_ushort),
        ("sbz2", ctypes.c_ushort),
    ]


class ACE_HEADER(ctypes.Structure):
    _fields_ = [
        ("type", ctypes.c_ubyte),
        ("flags", ctypes.c_ubyte),
        ("size", ctypes.c_ushort),
    ]


def bind(api, name, args, result):
    fn = getattr(api, name)
    fn.argtypes = args
    fn.restype = result
    return fn


class SecurePublicBackup:
    def __init__(self):
        require(sys.platform == "win32", "native Windows required")
        self.k = ctypes.WinDLL("kernel32", use_last_error=True)
        self.a = ctypes.WinDLL("advapi32", use_last_error=True)
        ptr = ctypes.c_void_p
        dword = wintypes.DWORD
        bind(
            self.k,
            "CreateFileW",
            [wintypes.LPCWSTR, dword, dword, ptr, dword, dword, wintypes.HANDLE],
            wintypes.HANDLE,
        )
        bind(
            self.k,
            "GetFileInformationByHandle",
            [wintypes.HANDLE, ctypes.POINTER(FILE_INFO)],
            wintypes.BOOL,
        )
        bind(self.k, "CloseHandle", [wintypes.HANDLE], wintypes.BOOL)
        bind(self.k, "LocalFree", [ptr], ptr)
        bind(
            self.k,
            "CreateDirectoryW",
            [wintypes.LPCWSTR, ctypes.POINTER(SECURITY_ATTRIBUTES)],
            wintypes.BOOL,
        )
        bind(
            self.a,
            "GetSecurityInfo",
            [
                wintypes.HANDLE,
                ctypes.c_int,
                dword,
                ctypes.POINTER(ptr),
                ptr,
                ctypes.POINTER(ptr),
                ptr,
                ctypes.POINTER(ptr),
            ],
            dword,
        )
        bind(
            self.a,
            "ConvertSidToStringSidW",
            [ptr, ctypes.POINTER(wintypes.LPWSTR)],
            wintypes.BOOL,
        )
        bind(self.a, "GetAce", [ptr, dword, ctypes.POINTER(ptr)], wintypes.BOOL)
        bind(
            self.a,
            "GetSecurityDescriptorControl",
            [ptr, ctypes.POINTER(ctypes.c_ushort), ctypes.POINTER(dword)],
            wintypes.BOOL,
        )
        bind(
            self.a,
            "ConvertStringSecurityDescriptorToSecurityDescriptorW",
            [wintypes.LPCWSTR, dword, ctypes.POINTER(ptr), ptr],
            wintypes.BOOL,
        )
        self.handles = []

    def sid(self, pointer):
        result = wintypes.LPWSTR()
        require(
            self.a.ConvertSidToStringSidW(pointer, ctypes.byref(result)),
            "SID conversion failed",
        )
        try:
            return result.value
        finally:
            self.k.LocalFree(ctypes.cast(result, ctypes.c_void_p))

    def hold_validate(self, path, strict=False):
        # No FILE_SHARE_DELETE: keep every ancestor open against rename/replacement.
        handle = self.k.CreateFileW(str(path), 0x20080, 3, None, 3, 0x02200000, None)
        require(
            handle not in (None, ctypes.c_void_p(-1).value),
            "cannot lock protected directory",
        )
        self.handles.append(handle)
        info = FILE_INFO()
        require(
            self.k.GetFileInformationByHandle(handle, ctypes.byref(info)),
            "directory metadata query failed",
        )
        owner = ctypes.c_void_p()
        dacl = ctypes.c_void_p()
        sd = ctypes.c_void_p()
        error = self.a.GetSecurityInfo(
            handle,
            1,
            5,
            ctypes.byref(owner),
            None,
            ctypes.byref(dacl),
            None,
            ctypes.byref(sd),
        )
        require(error == 0, "directory security query failed")
        try:
            require(dacl.value, "NULL DACL rejected")
            aces = []
            acl = ctypes.cast(dacl, ctypes.POINTER(ACL)).contents
            require(acl.count <= 128, "ACL exceeds review bound")
            for index in range(acl.count):
                entry = ctypes.c_void_p()
                require(
                    self.a.GetAce(dacl, index, ctypes.byref(entry)), "ACE read failed"
                )
                header = ctypes.cast(entry, ctypes.POINTER(ACE_HEADER)).contents
                require(
                    header.type in (0, 1) and header.size >= 12,
                    "unsupported ACE structure",
                )
                mask = ctypes.c_uint32.from_address(entry.value + 4).value
                aces.append(
                    {
                        "type": header.type,
                        "flags": header.flags,
                        "mask": mask,
                        "sid": self.sid(entry.value + 8),
                    }
                )
            control = ctypes.c_ushort()
            revision = wintypes.DWORD()
            require(
                self.a.GetSecurityDescriptorControl(
                    sd, ctypes.byref(control), ctypes.byref(revision)
                ),
                "security control query failed",
            )
            check_directory_security(
                self.sid(owner),
                aces,
                info.attributes,
                strict,
                bool(control.value & 0x1000),
            )
            return (info.volume, info.index_high, info.index_low)
        finally:
            self.k.LocalFree(sd)

    def create(self, plan, certificates):
        # Standard protected application location, verified by the read-only ACL probe.
        # ProgramData is rejected: its Users ACE permits directory metadata changes.
        parent = pathlib.Path("C:/Program Files")
        require(parent.is_absolute(), "standard local path required")
        self.hold_validate(parent.anchor)
        self.hold_validate(parent)
        path = parent / ("corpora-ci-public-trust-" + uuid.uuid4().hex)
        descriptor = ctypes.c_void_p()
        require(
            self.a.ConvertStringSecurityDescriptorToSecurityDescriptorW(
                BACKUP_SDDL, 1, ctypes.byref(descriptor), None
            ),
            "backup descriptor failed",
        )
        try:
            attrs = SECURITY_ATTRIBUTES(
                ctypes.sizeof(SECURITY_ATTRIBUTES), descriptor, False
            )
            require(
                self.k.CreateDirectoryW(str(path), ctypes.byref(attrs)),
                "exclusive protected backup directory creation failed",
            )
        finally:
            self.k.LocalFree(descriptor)
        identity = self.hold_validate(path, strict=True)
        for digest, cert in sorted(certificates.items()):
            der = base64.b64decode(cert["der_base64"], validate=True)
            require(
                hashlib.sha256(der).hexdigest() == digest,
                "backup certificate identity mismatch",
            )
            with (path / (digest + ".der")).open("xb") as output:
                output.write(der)
                output.flush()
                os.fsync(output.fileno())
        with (path / "plan.json").open("x", encoding="utf-8") as output:
            json.dump(plan, output, sort_keys=True)
            output.flush()
            os.fsync(output.fileno())
        require(
            {p.name for p in path.iterdir()}
            == {h + ".der" for h in certificates} | {"plan.json"},
            "unexpected backup contents",
        )
        for digest in certificates:
            require(
                hashlib.sha256((path / (digest + ".der")).read_bytes()).hexdigest()
                == digest,
                "backup readback failed",
            )
        require(
            self.hold_validate(path, strict=True) == identity,
            "backup directory identity changed",
        )
        return {
            "protected": True,
            "only_reviewed_public_der": True,
            "path": str(path),
            "directory_identity": identity,
        }

    def close(self):
        while self.handles:
            require(
                self.k.CloseHandle(self.handles.pop()),
                "protected path lock close failed",
            )


class NativeExactStores:
    def __init__(self, inventory, certificates):
        require(
            inventory.admin_capability()
            == {"administrators_membership": True, "token_elevated": True},
            "elevated administrator required",
        )
        self.inventory = inventory
        self.certificates = certificates
        self.backend = inventory.ReadOnlyWindows()
        self.api = self.backend.api
        bind(
            self.api,
            "CertDuplicateCertificateContext",
            [inventory.PCCERT],
            inventory.PCCERT,
        )
        bind(
            self.api,
            "CertAddEncodedCertificateToStore",
            [
                wintypes.HANDLE,
                wintypes.DWORD,
                ctypes.POINTER(ctypes.c_ubyte),
                wintypes.DWORD,
                wintypes.DWORD,
                ctypes.c_void_p,
            ],
            wintypes.BOOL,
        )
        bind(
            self.api,
            "CertDeleteCertificateFromStore",
            [inventory.PCCERT],
            wintypes.BOOL,
        )

    def checked_der(self, action, add):
        key = (action["location"], action["store"], action["physical"])
        require(
            key
            in (
                {
                    ("LocalMachine", "Disallowed", ".Default"),
                    ("CurrentUser", "Disallowed", ".Default"),
                }
                if add
                else CANONICAL_REMOVALS
            ),
            "unreviewed physical write origin",
        )
        digest = action["der_sha256"]
        require(digest in self.certificates, "unreviewed DER write")
        cert = self.certificates[digest]
        der = base64.b64decode(cert["der_base64"], validate=True)
        require(
            hashlib.sha256(der).hexdigest() == digest
            and self.inventory.spki_sha256(der) == cert["spki_sha256"],
            "public DER/SPKI mismatch",
        )
        return der

    def writable(self, action):
        value = ctypes.c_wchar_p(action["store"] + "\\" + action["physical"])
        handle = self.api.CertOpenStore(
            ctypes.c_void_p(14),
            0,
            None,
            self.inventory.LOCATIONS[action["location"]] | 0x4000,
            ctypes.cast(value, ctypes.c_void_p),
        )
        require(handle, "existing physical store not writable")
        return handle

    def add_disallowed(self, action):
        der = self.checked_der(action, True)
        before = self.backend.certificates(
            action["location"], action["store"], action["physical"]
        )
        require(before["opened"], "cannot inspect target disallowed source")
        if der in before["certificates"]:
            return "already-present"
        handle = self.writable(action)
        try:
            buffer = (ctypes.c_ubyte * len(der)).from_buffer_copy(der)
            require(
                self.api.CertAddEncodedCertificateToStore(
                    handle, 1, buffer, len(der), 1, None
                ),
                "exact ADD_NEW disallowed addition failed",
            )
        finally:
            require(self.api.CertCloseStore(handle, 0), "writable store close failed")
        after = self.backend.certificates(
            action["location"], action["store"], action["physical"]
        )
        require(
            after["opened"] and der in after["certificates"],
            "disallowed addition readback failed",
        )
        return "added"

    def delete_exact(self, action):
        expected = self.checked_der(action, False)
        handle = self.writable(action)
        current = self.inventory.PCCERT()
        target = self.inventory.PCCERT()
        count = 0
        enumerated = 0
        try:
            while True:
                current = self.api.CertEnumCertificatesInStore(handle, current)
                if not current:
                    require(
                        self.inventory.last_error() == 0x80092004,
                        "unexpected enumeration error before delete",
                    )
                    break
                enumerated += 1
                require(enumerated <= 4096, "native store exceeds review bound")
                der = ctypes.string_at(current.contents.encoded, current.contents.size)
                if der == expected:
                    count += 1
                    if not target:
                        target = self.api.CertDuplicateCertificateContext(current)
                        require(target, "context duplication failed")
            require(
                count == 1 and target,
                "exact target missing or duplicate; refuse delete",
            )
            der = ctypes.string_at(target.contents.encoded, target.contents.size)
            require(
                hashlib.sha256(der).hexdigest() == action["der_sha256"],
                "target refingerprint changed",
            )
            # Documented API consumes the context on success OR failure. Never double free.
            consumed = target
            target = self.inventory.PCCERT()
            require(
                self.api.CertDeleteCertificateFromStore(consumed),
                "exact certificate delete failed",
            )
        finally:
            if current:
                self.api.CertFreeCertificateContext(current)
            if target:
                self.api.CertFreeCertificateContext(target)
            require(self.api.CertCloseStore(handle, 0), "writable store close failed")
        after = self.backend.certificates(
            action["location"], action["store"], action["physical"]
        )
        require(
            after["opened"] and expected not in after["certificates"],
            "deleted trust anchor reappeared",
        )
        return "deleted"


KNOWN_PHYSICAL_NAMES = {
    ".Default",
    ".AuthRoot",
    ".GroupPolicy",
    ".Enterprise",
    ".SmartCard",
    ".LocalMachine",
    ".Flight",
    ".TestSign",
}
ALIASES = {
    ("CurrentUser", "ROOT", ".LocalMachine"),
    ("CurrentUser", "CA", ".LocalMachine"),
}
CA_SHA256 = "796f1389bfea13c0ed78f663b765baaff54a508e5483786bd6ece73c5e3e3cbe"


def plan_inventory(report, certificates):
    """Attribute every positive anchor before planning exact certificate writes."""
    require(
        report["read_only"] and report["native_certificate_mutation_api_used"] is False,
        "read-only inventory provenance required",
    )
    require(
        report["admin_capability"]
        == {"administrators_membership": True, "token_elevated": True},
        "elevated administrator required",
    )
    require(
        report["manifest_sha256"]
        == "38b76c3e74dc30c2feb31bcd81f194b8cc03d49f2e25a06b8769b34c9d37bb8e"
        and len(certificates) == 20,
        "complete reviewed public manifest required",
    )
    expected = {
        (location, store)
        for location in (
            "LocalMachine",
            "LocalMachineEnterprise",
            "LocalMachineGroupPolicy",
            "CurrentUser",
            "CurrentUserGroupPolicy",
            "Services",
            "Users",
        )
        for store in ("ROOT", "CA", "Disallowed")
    }
    stores = report["store_inventory"]
    require(
        len(stores) == 21
        and {(row["location"], row["store"]) for row in stores} == expected,
        "incomplete or duplicate native locations",
    )
    require(
        not report["explicit_context_anchors"]["affected_or_unknown_key_matches"],
        "selected public bundle contains an affected key",
    )
    removals = []
    aliases = []
    ordinary = {}
    logical_matches = set()
    negative_defaults = {}
    for row in stores:
        location, store = row["location"], row["store"]
        require(
            all(
                not match["unknown_der_with_affected_spki"]
                for match in row["logical"]["affected_or_unknown_key_matches"]
            ),
            "unreviewed certificate uses an affected key",
        )
        if not row["opened"]:
            allowed = (
                (2, 3, 87, 0x80070057, 0x80092004)
                if location in ("Services", "Users")
                else (2, 3, 0x80092004)
            )
            require(
                row["open_error"] in allowed,
                "unreadable or unknown certificate location",
            )
            require(
                not row["logical"]["unique_der_sha256"] and not row["physical_stores"],
                "closed store has certificate identities",
            )
            require(
                not (
                    store == "Disallowed"
                    and location in ("LocalMachine", "CurrentUser")
                ),
                "required negative backing store is unavailable",
            )
            continue
        require(
            row["physical_stores"],
            "opened logical store has no attributed physical sources",
        )
        require(
            any(
                attempt["enumerated"] and not attempt["predefined_flag"]
                for attempt in row["physical_enumeration"]["attempts"]
            ),
            "successful ordinary physical enumeration required",
        )
        union = set()
        for physical in row["physical_stores"]:
            require(
                not physical.get("unsupported_name")
                and physical.get("name") in KNOWN_PHYSICAL_NAMES,
                "unclassified physical provider",
            )
            require(physical["opened"], "unreadable physical source")
            require(
                all(
                    not match["unknown_der_with_affected_spki"]
                    for match in physical["affected_or_unknown_key_matches"]
                ),
                "unreviewed certificate variant uses an affected key",
            )
            key = (location, store, physical["name"])
            hashes = set(physical["unique_der_sha256"])
            union |= hashes
            ordinary["|".join(key)] = sorted(hashes - certificates.keys())
            if store == "Disallowed":
                if (
                    location in ("LocalMachine", "CurrentUser")
                    and physical["name"] == ".Default"
                ):
                    negative_defaults[location] = hashes
                continue
            for digest in sorted(hashes & certificates.keys()):
                action = {
                    "location": location,
                    "store": store,
                    "physical": physical["name"],
                    "der_sha256": digest,
                }
                if key in CANONICAL_REMOVALS:
                    removals.append(action)
                elif key in ALIASES:
                    aliases.append(action)
                else:
                    raise RuntimeError(
                        "affected certificate in policy, enterprise, smart-card or unsupported physical source"
                    )
        require(
            set(row["logical"]["unique_der_sha256"]) == union,
            "logical store contains unattributed certificate sources",
        )
        if store != "Disallowed":
            logical_matches |= union & certificates.keys()
    require(
        set(negative_defaults) == {"LocalMachine", "CurrentUser"},
        "negative default backing stores are incomplete",
    )
    for alias in aliases:
        require(
            alias["der_sha256"]
            in {
                action["der_sha256"]
                for action in removals
                if action["location"] == "LocalMachine"
                and action["store"] == alias["store"]
            },
            "inherited affected source is not covered",
        )
    covered = {action["der_sha256"] for action in removals}
    for name in ("ROOT", "CA"):
        selected = report["python_aggregate"][name]["server_auth_selected"]
        require(
            not any(
                match["unknown_der_with_affected_spki"]
                for match in selected["affected_or_unknown_key_matches"]
            ),
            "unclassified Python-imported affected key",
        )
        native = set().union(
            *(
                set(row["logical"]["unique_der_sha256"])
                for row in stores
                if row["store"] == name and row["opened"]
            )
        )
        all_x509 = report["python_aggregate"][name]["all_x509"]
        require(
            set(all_x509["unique_der_sha256"]) == native
            and all_x509["certificate_count"] == len(native)
            and set(selected["unique_der_sha256"]) <= native
            and report["python_aggregate"][name]["all_encoding_record_count"]
            == len(native),
            "Python certificate aggregate differs from attributed native collections",
        )
        require(
            set(selected["unique_der_sha256"]) & certificates.keys() <= covered,
            "Python-imported affected anchor has no writable backing source",
        )
    require(
        logical_matches <= covered,
        "native positive affected anchors are not fully covered",
    )
    defaults = report["default_context_anchors"]["affected_or_unknown_key_matches"]
    require(
        not any(match["unknown_der_with_affected_spki"] for match in defaults)
        and {match["der_sha256"] for match in defaults} <= covered,
        "default-context affected anchors are unattributed",
    )
    additions = [
        {
            "location": location,
            "store": "Disallowed",
            "physical": ".Default",
            "der_sha256": digest,
        }
        for location in ("LocalMachine", "CurrentUser")
        for digest in sorted(certificates.keys() - negative_defaults[location])
    ]
    return {
        "removals": sorted(
            removals,
            key=lambda action: (
                action["location"],
                action["store"],
                action["physical"],
                action["der_sha256"],
            ),
        ),
        "disallowed_additions": additions,
        "ordinary_anchor_snapshot": ordinary,
    }


def report_sha256(report):
    return hashlib.sha256(
        json.dumps(report, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def _repair_inventory(
    inventory, certificates, before, collect, backup_factory, store_factory
):
    plan = plan_inventory(before, certificates)
    changed = bool(plan["removals"] or plan["disallowed_additions"])
    if not changed:
        require(
            not before["default_context_anchors"]["affected_or_unknown_key_matches"],
            "default context is not clean",
        )
        return {
            "available": True,
            "positive_anchors_removed": 0,
            "negative_entries_added": 0,
            "idempotent": True,
            "protected_backup_created": False,
            "ordinary_certificates_preserved": True,
            "fresh_default_context_clear": True,
            "transport_proof_required_separately": True,
        }
    backup = backup_factory()
    try:
        receipt = backup.create(plan, certificates)
        require(
            receipt["protected"] and receipt["only_reviewed_public_der"],
            "public backup protection failed",
        )
        require(
            report_sha256(collect()) == report_sha256(before),
            "certificate state changed during public backup",
        )
        native = store_factory(inventory, certificates)
        for action in plan["disallowed_additions"]:
            native.add_disallowed(action)
        for location in ("LocalMachine", "CurrentUser"):
            row = native.backend.certificates(location, "Disallowed", ".Default")
            require(
                row["opened"]
                and set(certificates)
                <= {hashlib.sha256(der).hexdigest() for der in row["certificates"]},
                "negative anchors incomplete; positive anchors were not removed",
            )
        for action in plan["removals"]:
            native.delete_exact(action)
        after = collect()
        after_plan = plan_inventory(after, certificates)
        require(
            not after_plan["removals"] and not after_plan["disallowed_additions"],
            "reviewed certificate writes are incomplete or affected anchors reappeared",
        )
        require(
            after_plan["ordinary_anchor_snapshot"] == plan["ordinary_anchor_snapshot"],
            "ordinary positive or negative certificate identities changed",
        )
        require(
            after["root_update_policy_presence"]
            == before["root_update_policy_presence"],
            "Windows root update policy changed",
        )
        require(
            not after["default_context_anchors"]["affected_or_unknown_key_matches"],
            "fresh default context contains an affected anchor or key",
        )
        return {
            "available": True,
            "positive_anchors_removed": len(plan["removals"]),
            "negative_entries_added": len(plan["disallowed_additions"]),
            "idempotent": False,
            "protected_backup_created": True,
            "ordinary_certificates_preserved": True,
            "fresh_default_context_clear": True,
            "transport_proof_required_separately": True,
        }
    finally:
        backup.close()


def repair(inventory, manifest_bytes, cafile, empty):
    """Repair fresh hosted Windows stores under the selected clean OpenSSL paths."""
    require(
        sys.platform == "win32"
        and os.environ.get("GITHUB_ACTIONS") == "true"
        and os.environ.get("RUNNER_ENVIRONMENT") == "github-hosted",
        "fresh hosted Windows execution required",
    )
    require(
        getattr(inventory, "__source_sha256__", None) == INVENTORY_SHA,
        "verified inventory source required",
    )
    cafile = pathlib.Path(cafile)
    empty = pathlib.Path(empty)
    require(
        cafile.is_file()
        and not cafile.is_symlink()
        and hashlib.sha256(cafile.read_bytes()).hexdigest() == CA_SHA256,
        "reviewed selected CA file required",
    )
    require(
        empty.is_dir()
        and not empty.is_symlink()
        and not empty.is_junction()
        and not list(empty.iterdir()),
        "exclusive empty OpenSSL fallback required",
    )
    certificates = inventory.manifest(manifest_bytes)
    # GITHUB_ENV is exported only after bootstrap succeeds. Match the future job
    # clients while validating fresh default contexts inside this process.
    previous = {
        name: os.environ.get(name) for name in ("SSL_CERT_FILE", "SSL_CERT_DIR")
    }
    os.environ.update({"SSL_CERT_FILE": str(cafile), "SSL_CERT_DIR": str(empty)})
    try:
        collect = lambda: inventory.collect(manifest_bytes, cafile)
        before = collect()
        return _repair_inventory(
            inventory,
            certificates,
            before,
            collect,
            SecurePublicBackup,
            NativeExactStores,
        )
    finally:
        for name, value in previous.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value


if __name__ == "__main__":
    raise SystemExit("Internal repair module; use the verified CI bootstrap.")
