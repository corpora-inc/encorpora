"""Exercise real temporary Java CA stores; never modify the installed JDK."""
from pathlib import Path
import re
import shutil
import os
import sys
import ssl
import subprocess
import tempfile
import unittest

import yaml

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parents[1]
CERTIFICATES = re.compile(r"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----", re.S)


class JavaTrustTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        temporary = tempfile.TemporaryDirectory()
        cls.addClassCleanup(temporary.cleanup)
        cls.classes = Path(temporary.name)
        subprocess.run([shutil.which("javac"), "--release", "17", "-d", str(cls.classes),
                        str(SCRIPTS / "RemoveDistrustedRoots.java")], capture_output=True, check=True, timeout=30)

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.folder = Path(self.directory.name)
        self.store = self.folder / "temporary-ca-store"
        self.store_type = "PKCS12"
        self.java = shutil.which("java")
        self.keytool = shutil.which("keytool")
        self.assertTrue(self.java and self.keytool, "Java and keytool are required")
        affected = CERTIFICATES.findall((SCRIPTS / "java-trust-fixtures/affected-roots.pem").read_text())
        self.assertGreater(len(affected), 0)
        self.affected_count = len(affected)
        for index, certificate in enumerate(affected):
            self.add_certificate("affected" + str(index), certificate)
        control = CERTIFICATES.findall((ROOT / "corpan/infra/terraform/tls-trust/ca-certificates.pem").read_text())[0]
        self.add_certificate("control", control)

    def command(self, arguments):
        return subprocess.run(arguments, capture_output=True, text=True, timeout=30, check=True)

    def add_certificate(self, alias, certificate):
        path = self.folder / (alias + ".crt")
        path.write_text(certificate)
        self.command([self.keytool, "-importcert", "-noprompt", "-alias", alias,
                      "-file", str(path), "-keystore", str(self.store), "-storetype", self.store_type, "-storepass", "changeit"])

    def repair(self, path=None):
        return self.command([self.java, "-cp", str(self.classes), "RemoveDistrustedRoots", str(path or self.store)])

    def test_exact_removal_preserves_control_metadata_backup_and_idempotence(self):
        original = self.store.read_bytes()
        self.store.chmod(0o640)
        before = self.store.stat()
        result = self.repair()
        self.assertIn("removed " + str(self.affected_count), result.stdout)
        control = self.command([self.keytool, "-exportcert", "-rfc", "-alias", "control",
                                "-keystore", str(self.store), "-storepass", "changeit"])
        self.assertEqual([ssl.PEM_cert_to_DER_cert(pem) for pem in CERTIFICATES.findall(control.stdout)],
                         [ssl.PEM_cert_to_DER_cert((self.folder / "control.crt").read_text())])
        for index in range(self.affected_count):
            with self.assertRaises(subprocess.CalledProcessError):
                self.command([self.keytool, "-exportcert", "-rfc", "-alias", "affected" + str(index),
                              "-keystore", str(self.store), "-storepass", "changeit"])
        after = self.store.stat()
        self.assertEqual((after.st_mode & 0o777, after.st_uid, after.st_gid),
                         (before.st_mode & 0o777, before.st_uid, before.st_gid))
        backup = self.store.with_name(self.store.name + ".before-emudhra")
        self.assertEqual(backup.read_bytes(), original)
        cleaned = self.store.read_bytes()
        self.repair()
        self.assertEqual(self.store.read_bytes(), cleaned)
        self.assertEqual(backup.read_bytes(), original)

    def test_jks_format_and_ordinary_root_are_preserved(self):
        self.store = self.folder / "jks-ca-store"
        self.store_type = "JKS"
        self.add_certificate("affected", (self.folder / "affected0.crt").read_text())
        self.add_certificate("control", (self.folder / "control.crt").read_text())
        self.assertEqual(self.store.read_bytes()[:4], bytes.fromhex("feedfeed"))
        self.repair()
        self.assertEqual(self.store.read_bytes()[:4], bytes.fromhex("feedfeed"))
        self.command([self.keytool, "-exportcert", "-rfc", "-alias", "control", "-keystore", str(self.store), "-storepass", "changeit"])
        with self.assertRaises(subprocess.CalledProcessError):
            self.command([self.keytool, "-exportcert", "-rfc", "-alias", "affected", "-keystore", str(self.store), "-storepass", "changeit"])

    def test_refuses_to_replace_store_with_no_remaining_trust_anchors(self):
        self.command([self.keytool, "-delete", "-alias", "control", "-keystore", str(self.store), "-storepass", "changeit"])
        original = self.store.read_bytes()
        with self.assertRaises(subprocess.CalledProcessError):
            self.repair()
        self.assertEqual(self.store.read_bytes(), original)
        self.assertFalse(self.store.with_name(self.store.name + ".before-emudhra").exists())

    def test_invalid_input_fails_without_replacing_it(self):
        self.store.write_bytes(b"invalid CA store")
        with self.assertRaises(subprocess.CalledProcessError):
            self.repair()
        self.assertEqual(self.store.read_bytes(), b"invalid CA store")
        self.assertFalse(self.store.with_name(self.store.name + ".before-emudhra").exists())

    def test_symlinked_jdk_store_keeps_its_link_and_updates_the_target(self):
        link = self.folder / "cacerts-link"
        link.symlink_to(self.store)
        self.repair(link)
        self.assertTrue(link.is_symlink())
        self.assertIn("store unchanged", self.repair().stdout)

    @unittest.skipUnless(sys.platform == "linux" and os.geteuid() != 0 and shutil.which("sudo"),
                         "requires a Linux runner with passwordless sudo")
    def test_privileged_launcher_repairs_root_owned_symlink_target(self):
        subprocess.run(["sudo", "-n", "true"], check=True, capture_output=True, timeout=10)
        link = self.folder / "jdk-cacerts"
        link.symlink_to(self.store)
        original = self.store.read_bytes()
        self.store.chmod(0o644)
        self.folder.chmod(0o755)
        self.command(["sudo", "-n", "chown", "0:0", str(self.store), str(self.folder)])
        try:
            with self.assertRaises(subprocess.CalledProcessError) as failure:
                self.repair(link)
            self.assertIn("AccessDeniedException", failure.exception.stderr)
            self.assertEqual(self.store.read_bytes(), original)
            self.assertFalse(self.store.with_name(self.store.name + ".before-emudhra").exists())
            self.command(["sudo", "-n", self.java, str(SCRIPTS / "RemoveDistrustedRoots.java"), str(link)])
            self.assertTrue(link.is_symlink())
            self.assertEqual(self.store.stat().st_uid, 0)
            self.assertEqual(self.store.stat().st_mode & 0o777, 0o644)
            self.assertEqual(self.store.with_name(self.store.name + ".before-emudhra").read_bytes(), original)
            self.assertIn("store unchanged", self.repair().stdout)
        finally:
            for path in (self.store, self.store.with_name(self.store.name + ".before-emudhra"), self.folder):
                if path.exists():
                    self.command(["sudo", "-n", "chown", str(os.geteuid()) + ":" + str(os.getegid()), str(path)])

    def test_backup_symlink_is_rejected_before_store_replacement(self):
        original = self.store.read_bytes()
        backup = self.store.with_name(self.store.name + ".before-emudhra")
        backup.symlink_to(self.folder / "absent")
        with self.assertRaises(subprocess.CalledProcessError):
            self.repair()
        self.assertEqual(self.store.read_bytes(), original)


class WorkflowJavaTrustTests(unittest.TestCase):
    def test_every_configured_android_jdk_is_repaired_before_sdk_downloads(self):
        for name in ("release-mobile.yml", "release-dynawalla.yml", "release-aha.yml"):
            jobs = yaml.safe_load((ROOT / ".github/workflows" / name).read_text())["jobs"]
            found = 0
            for job in jobs.values():
                steps = job.get("steps", [])
                for index, step in enumerate(steps):
                    if not str(step.get("uses", "")).startswith("actions/setup-java@"):
                        continue
                    found += 1
                    repair = steps[index + 1]
                    self.assertEqual(repair.get("name"), "Remove distrusted Java CA roots")
                    self.assertEqual(repair["run"], 'sudo "$JAVA_HOME/bin/java" "$GITHUB_WORKSPACE/.github/scripts/RemoveDistrustedRoots.java" "$JAVA_HOME/lib/security/cacerts"')
                    self.assertEqual(job["runs-on"], "ubuntu-latest")
                    self.assertEqual(repair.get("if"), steps[index + 2].get("if"))
                    self.assertTrue(str(steps[index + 2].get("uses", "")).startswith("android-actions/setup-android@"))
            self.assertEqual(found, 1, name + ": expected one configured Android JDK")


if __name__ == "__main__":
    unittest.main()
