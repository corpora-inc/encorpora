"""Read-only public Windows certificate collections used by Python TLS clients.

Host certificate identities stay internal to the repair. Only public ROOT, CA
and Disallowed collections are read; private-key/MY stores are never opened.
"""

import base64, ctypes, hashlib, json, os, pathlib, re, ssl, sys
from ctypes import wintypes

MANIFEST_SHA256 = "38b76c3e74dc30c2feb31bcd81f194b8cc03d49f2e25a06b8769b34c9d37bb8e"
LOCATIONS = {
    "LocalMachine": 0x20000,
    "LocalMachineEnterprise": 0x90000,
    "LocalMachineGroupPolicy": 0x80000,
    "CurrentUser": 0x10000,
    "CurrentUserGroupPolicy": 0x70000,
    "Services": 0x50000,
    "Users": 0x60000,
}
STORES = ("ROOT", "CA", "Disallowed")


def require(ok, message):
    if not ok:
        raise RuntimeError(message)


def last_error():
    return ctypes.get_last_error() & 0xFFFFFFFF


def tlv(data, start):
    require(start + 2 <= len(data), "truncated DER")
    tag = data[start]
    n = data[start + 1]
    offset = start + 2
    if n & 128:
        count = n & 127
        require(0 < count <= 4 and offset + count <= len(data), "invalid DER length")
        length = int.from_bytes(data[offset : offset + count], "big")
        require(length >= 128 and data[offset] != 0, "noncanonical DER length")
        offset += count
    else:
        length = n
    end = offset + length
    require(end <= len(data), "DER length exceeds input")
    return tag, offset, end


def spki_sha256(der):
    tag, start, end = tlv(der, 0)
    require(tag == 0x30 and end == len(der), "not one DER certificate")
    tag, tbs_start, tbs_end = tlv(der, start)
    require(tag == 0x30, "missing TBSCertificate")
    fields = []
    cursor = tbs_start
    while cursor < tbs_end:
        begin = cursor
        tag, body, cursor = tlv(der, cursor)
        require(cursor <= tbs_end, "TBS field overflow")
        fields.append((tag, begin, body, cursor))
    offset = 1 if fields and fields[0][0] == 0xA0 else 0
    require(len(fields) > offset + 5, "certificate fields missing")
    tag, begin, body, end = fields[offset + 5]
    require(tag == 0x30, "SPKI sequence missing")
    inner_tag, inner_start, inner_end = tlv(der, body)
    require(inner_tag == 0x30, "SPKI algorithm missing")
    bit_tag, bit_start, bit_end = tlv(der, inner_end)
    require(
        bit_tag == 3 and bit_end == end and bit_start < bit_end and der[bit_start] <= 7,
        "SPKI key missing",
    )
    return hashlib.sha256(der[begin:end]).hexdigest()


def manifest(data):
    require(isinstance(data, bytes), "public manifest bytes required")
    require(
        hashlib.sha256(data).hexdigest() == MANIFEST_SHA256,
        "reviewed public manifest digest mismatch",
    )
    doc = json.loads(data)
    items = doc["certificates"]
    require(
        len(items) == 20 and len({x["der_sha256"] for x in items}) == 20,
        "reviewed manifest cardinality mismatch",
    )
    require(
        sum(x["kind"] == "root" for x in items) == 4, "reviewed root count mismatch"
    )
    for x in items:
        der = base64.b64decode(x["der_base64"], validate=True)
        require(
            hashlib.sha256(der).hexdigest() == x["der_sha256"]
            and spki_sha256(der) == x["spki_sha256"],
            "public DER/SPKI identity mismatch",
        )
    return {x["der_sha256"]: x for x in items}


class CERT_CONTEXT(ctypes.Structure):
    _fields_ = [
        ("encoding", wintypes.DWORD),
        ("encoded", ctypes.POINTER(ctypes.c_ubyte)),
        ("size", wintypes.DWORD),
        ("info", ctypes.c_void_p),
        ("store", wintypes.HANDLE),
    ]


PCCERT = ctypes.POINTER(CERT_CONTEXT)


class ReadOnlyWindows:
    def __init__(self):
        require(sys.platform == "win32", "Windows inventory requires native Windows")
        self.api = ctypes.WinDLL("crypt32", use_last_error=True)
        self.api.CertOpenStore.argtypes = (
            ctypes.c_void_p,
            wintypes.DWORD,
            ctypes.c_void_p,
            wintypes.DWORD,
            ctypes.c_void_p,
        )
        self.api.CertOpenStore.restype = wintypes.HANDLE
        self.api.CertEnumCertificatesInStore.argtypes = (wintypes.HANDLE, PCCERT)
        self.api.CertEnumCertificatesInStore.restype = PCCERT
        self.api.CertFreeCertificateContext.argtypes = (PCCERT,)
        self.api.CertFreeCertificateContext.restype = wintypes.BOOL
        self.api.CertCloseStore.argtypes = (wintypes.HANDLE, wintypes.DWORD)
        self.api.CertCloseStore.restype = wintypes.BOOL
        self.callback_type = ctypes.WINFUNCTYPE(
            wintypes.BOOL,
            ctypes.c_void_p,
            wintypes.DWORD,
            wintypes.LPCWSTR,
            ctypes.c_void_p,
            ctypes.c_void_p,
            ctypes.c_void_p,
        )
        self.api.CertEnumPhysicalStore.argtypes = (
            ctypes.c_void_p,
            wintypes.DWORD,
            ctypes.c_void_p,
            self.callback_type,
        )
        self.api.CertEnumPhysicalStore.restype = wintypes.BOOL

    def physical_names(self, location, store):
        names = []
        attempts = []

        @self.callback_type
        def callback(system, flags, name, info, reserved, arg):
            if len(names) >= 128:
                return False
            names.append(name)
            return True

        value = ctypes.c_wchar_p(store)
        for include_predefined in (0, 1):
            ok = self.api.CertEnumPhysicalStore(
                ctypes.cast(value, ctypes.c_void_p),
                LOCATIONS[location] | include_predefined,
                None,
                callback,
            )
            attempts.append(
                {
                    "predefined_flag": bool(include_predefined),
                    "enumerated": bool(ok),
                    "error": None if ok else last_error(),
                }
            )
        require(len(names) < 128, "physical store inventory exceeds bound")
        return {"names": sorted(set(names)), "attempts": attempts}

    def certificates(self, location, store, physical=None):
        value = ctypes.c_wchar_p(store if physical is None else store + "\\" + physical)
        # OPEN_EXISTING plus READONLY: this inventory cannot create a store.
        handle = self.api.CertOpenStore(
            ctypes.c_void_p(10 if physical is None else 14),
            0,
            None,
            LOCATIONS[location] | 0x8000 | 0x4000,
            ctypes.cast(value, ctypes.c_void_p),
        )
        if not handle:
            return {"opened": False, "error": last_error(), "certificates": []}
        result = []
        context = PCCERT()
        try:
            while True:
                context = self.api.CertEnumCertificatesInStore(handle, context)
                if not context:
                    error = last_error()
                    require(
                        error == 0x80092004,
                        f"certificate enumeration failed: {location}/{store}/{physical} 0x{error:08x}",
                    )
                    break
                require(
                    context.contents.encoding & 1,
                    "non-X509 store content requires review",
                )
                der = ctypes.string_at(context.contents.encoded, context.contents.size)
                result.append(der)
                require(
                    len(result) <= 4096, "certificate store inventory exceeds bound"
                )
            return {"opened": True, "error": None, "certificates": result}
        finally:
            if context:
                self.api.CertFreeCertificateContext(context)
            require(
                self.api.CertCloseStore(handle, 0),
                "read-only certificate store failed to close",
            )


def admin_capability():
    shell = ctypes.WinDLL("shell32", use_last_error=True)
    shell.IsUserAnAdmin.restype = wintypes.BOOL
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.GetCurrentProcess.restype = wintypes.HANDLE
    kernel.CloseHandle.argtypes = (wintypes.HANDLE,)
    adv = ctypes.WinDLL("advapi32", use_last_error=True)
    adv.OpenProcessToken.argtypes = (
        wintypes.HANDLE,
        wintypes.DWORD,
        ctypes.POINTER(wintypes.HANDLE),
    )
    adv.GetTokenInformation.argtypes = (
        wintypes.HANDLE,
        ctypes.c_int,
        ctypes.c_void_p,
        wintypes.DWORD,
        ctypes.POINTER(wintypes.DWORD),
    )
    token = wintypes.HANDLE()
    require(
        adv.OpenProcessToken(kernel.GetCurrentProcess(), 8, ctypes.byref(token)),
        "cannot query current token",
    )
    try:
        elevated = wintypes.DWORD()
        size = wintypes.DWORD()
        require(
            adv.GetTokenInformation(
                token,
                20,
                ctypes.byref(elevated),
                ctypes.sizeof(elevated),
                ctypes.byref(size),
            ),
            "cannot query token elevation",
        )
        return {
            "administrators_membership": bool(shell.IsUserAnAdmin()),
            "token_elevated": bool(elevated.value),
        }
    finally:
        kernel.CloseHandle(token)


def describe(certs, known):
    blocked_keys = {x["spki_sha256"] for x in known.values()}
    rows = []
    for der in certs:
        digest = hashlib.sha256(der).hexdigest()
        spki = spki_sha256(der)
        rows.append(
            {
                "der_sha256": digest,
                "spki_sha256": spki,
                "known_affected": digest in known,
                "unknown_der_with_affected_spki": digest not in known
                and spki in blocked_keys,
            }
        )
    return {
        "certificate_count": len(rows),
        "unique_der_sha256": sorted({x["der_sha256"] for x in rows}),
        "affected_or_unknown_key_matches": [
            x
            for x in rows
            if x["known_affected"] or x["unknown_der_with_affected_spki"]
        ],
    }


def collect(manifest_bytes, cafile):
    require(
        sys.platform == "win32"
        and os.environ.get("GITHUB_ACTIONS") == "true"
        and os.environ.get("RUNNER_ENVIRONMENT") == "github-hosted",
        "fresh hosted Windows only",
    )
    known = manifest(manifest_bytes)
    backend = ReadOnlyWindows()
    stores = []
    for location in LOCATIONS:
        for store in STORES:
            opened = backend.certificates(location, store)
            physical = backend.physical_names(location, store)
            row = {
                "location": location,
                "store": store,
                "opened": opened["opened"],
                "open_error": opened["error"],
                "logical": describe(opened["certificates"], known),
                "physical_enumeration": physical,
                "physical_stores": [],
            }
            for name in physical["names"]:
                if not re.fullmatch(r"\.[A-Za-z0-9_.-]{1,127}", name):
                    row["physical_stores"].append(
                        {
                            "name_sha256": hashlib.sha256(name.encode()).hexdigest(),
                            "unsupported_name": True,
                        }
                    )
                    continue
                opened = backend.certificates(location, store, name)
                row["physical_stores"].append(
                    {
                        "name": name,
                        "opened": opened["opened"],
                        "open_error": opened["error"],
                        **describe(opened["certificates"], known),
                    }
                )
            stores.append(row)
    aggregates = {}
    for name in ("ROOT", "CA"):
        certs = ssl.enum_certificates(name)
        der = [
            data
            for data, encoding, trust in certs
            if encoding == "x509_asn"
            and (trust is True or ssl.Purpose.SERVER_AUTH.oid in trust)
        ]
        aggregates[name] = {
            "all_encoding_record_count": len(certs),
            "all_x509": describe(
                [data for data, encoding, trust in certs if encoding == "x509_asn"],
                known,
            ),
            "server_auth_selected": describe(der, known),
        }
    default = ssl.create_default_context()
    explicit = ssl.create_default_context(cafile=str(cafile))
    import winreg

    policies = {}
    for key in ("DisableRootAutoUpdate", "EnableDisallowedCertAutoUpdate"):
        try:
            with winreg.OpenKey(
                winreg.HKEY_LOCAL_MACHINE,
                r"SOFTWARE\Policies\Microsoft\SystemCertificates\AuthRoot",
                0,
                winreg.KEY_READ,
            ) as handle:
                value, kind = winreg.QueryValueEx(handle, key)
            policies[key] = {
                "present": True,
                "type": kind,
                "dword": value if kind == winreg.REG_DWORD else None,
            }
        except FileNotFoundError:
            policies[key] = {"present": False}
    return {
        "read_only": True,
        "native_certificate_mutation_api_used": False,
        "image_version": os.environ.get("ImageVersion"),
        "python_version": sys.version.split()[0],
        "python_ssl_source_sha256": hashlib.sha256(
            pathlib.Path(ssl.__file__).read_bytes()
        ).hexdigest(),
        "openssl": ssl.OPENSSL_VERSION,
        "default_verify_flags": default.verify_flags,
        "verify_partial_chain_supported": hasattr(ssl, "VERIFY_X509_PARTIAL_CHAIN"),
        "admin_capability": admin_capability(),
        "manifest_sha256": MANIFEST_SHA256,
        "store_inventory": stores,
        "python_aggregate": aggregates,
        "default_context_anchors": describe(
            default.get_ca_certs(binary_form=True), known
        ),
        "explicit_context_anchors": describe(
            explicit.get_ca_certs(binary_form=True), known
        ),
        "root_update_policy_presence": policies,
        "scope": "public ROOT/CA/Disallowed certificates only; no MY store, subjects, private keys, credentials, identity or environment values",
    }


if __name__ == "__main__":
    raise SystemExit("Internal inventory module; use the verified CI bootstrap.")
