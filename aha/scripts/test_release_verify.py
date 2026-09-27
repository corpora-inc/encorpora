import io
import json
import os
from pathlib import Path
import struct
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import zipfile
import release_verify as release


def elf(alignment=16384, relro_end=16384, load=True):
    data = bytearray(64 + 2*56)
    data[:6] = b'\x7fELF\x02\x01'
    struct.pack_into('<Q', data, 32, 64)
    struct.pack_into('<HH', data, 54, 56, 2)
    struct.pack_into('<IIQQQQQQ', data, 64, 1 if load else 0, 4, 0, 0, 0, 10, 10, alignment)
    struct.pack_into('<IIQQQQQQ', data, 120, 0x6474e552, 4, 0, 0, 0, 0, relro_end, 1)
    return bytes(data)


class FakeStore:
    def __init__(self, replies):
        self.replies = replies
        self.calls = []
    def request(self, method, path, **kwargs):
        self.calls.append((method,path))
        key=(method,path)
        if key not in self.replies:
            raise AssertionError(f'Unexpected request: {key}')
        value = self.replies[key]
        return value() if callable(value) else value


def ios_replies():
    return {
        ('GET','apps'): {'data':[{'id':'app'}]},
        ('GET','betaGroups/group'): {'data':{'attributes':{'isInternalGroup':True}}},
        ('GET','betaGroups/group/app'): {'data':{'id':'app'}},
        ('GET','betaGroups/group/betaTesters'): {'data':[{'id':'existing'}]},
        ('GET','builds'): {'data':[{'id':'build','attributes':{'uploadedDate':'2026-09-27T15:00:00Z','processingState':'VALID','expired':False}}]},
        ('POST','betaGroups/group/relationships/builds'): {},
        ('GET','builds/build/betaGroups'): {'data':[{'id':'group'}]},
        ('GET','builds/build/buildBetaDetail'): {'data':{'attributes':{'internalBuildState':'IN_BETA_TESTING'}}},
    }


class ReleaseTests(unittest.TestCase):
    def test_all_segments_require_alignment_and_relro(self):
        self.assertEqual(release.verify_elf(elf()),1)
        for invalid in (elf(4096),elf(relro_end=4096),elf(load=False),b'invalid'):
            with self.assertRaises(ValueError): release.verify_elf(invalid)

    def test_each_library_checked_and_empty_bundle_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'app.aab'
            with zipfile.ZipFile(path,'w') as z:
                z.writestr('base/lib/arm64-v8a/one.so',elf())
                z.writestr('base/lib/x86_64/two.so',elf(4096))
            with self.assertRaises(ValueError): release.verify_bundle(path)
            with zipfile.ZipFile(path,'w') as z: z.writestr('metadata','empty')
            with self.assertRaises(ValueError): release.verify_bundle(path)

    @patch.dict(os.environ,{'AHA_TESTFLIGHT_GROUP_ID':'group'})
    def test_ios_rejects_external_empty_or_wrong_app_group(self):
        for key,value in [
            (('GET','betaGroups/group'),{'data':{'attributes':{'isInternalGroup':False}}}),
            (('GET','betaGroups/group/app'),{'data':{'id':'other'}}),
            (('GET','betaGroups/group/betaTesters'),{'data':[]}),
        ]:
            replies=ios_replies();replies[key]=value
            with self.assertRaises(ValueError): release.ios_app_and_group(FakeStore(replies))

    @patch.dict(os.environ,{'AHA_TESTFLIGHT_GROUP_ID':'group'})
    @patch('sys.stdout', new_callable=io.StringIO)
    def test_ios_requires_beta_availability_not_processing_alone(self, _output):
        replies=ios_replies();store=FakeStore(replies)
        release.ios_verify(store,'42',0)
        self.assertNotIn(('POST','betaGroups/group/relationships/builds'),store.calls)
        replies[('GET','builds/build/buildBetaDetail')]={'data':{'attributes':{'internalBuildState':'MISSING_EXPORT_COMPLIANCE'}}}
        with self.assertRaises(ValueError): release.ios_verify(FakeStore(replies),'42',0)

    @patch.dict(os.environ,{'AHA_TESTFLIGHT_GROUP_ID':'group'})
    @patch('sys.stdout', new_callable=io.StringIO)
    def test_ios_attaches_only_existing_authorized_group(self, _output):
        replies=ios_replies()
        replies[('GET','builds/build/betaGroups')]={'data':[]}
        def attach():
            replies[('GET','builds/build/betaGroups')]={'data':[{'id':'group'}]}
            return {}
        replies[('POST','betaGroups/group/relationships/builds')]=attach
        store=FakeStore(replies)
        release.ios_verify(store,'42',0)
        writes=[call for call in store.calls if call[0]=='POST']
        self.assertEqual(writes,[('POST','betaGroups/group/relationships/builds')])

    @patch.dict(os.environ,{'AHA_TESTFLIGHT_GROUP_ID':'group'})
    def test_ios_rejects_stale_upload(self):
        store=FakeStore(ios_replies())
        with self.assertRaises(ValueError): release.ios_verify(store,'42',9999999999)
        self.assertNotIn(('POST','betaGroups/group/relationships/builds'),store.calls)

    @patch('sys.stdout', new_callable=io.StringIO)
    def test_play_requires_completed_release_and_existing_audience(self, _output):
        base=release.BUNDLE+'/edits'
        replies={('POST',base):{'id':'edit'},
            ('GET',base+'/edit/tracks/internal'):{'releases':[{'versionCodes':['42'],'status':'completed'}]},
            ('GET',base+'/edit/testers/internal'):{'googleGroups':['existing-audience']},
            ('DELETE',base+'/edit'): {}}
        store=FakeStore(replies);release.play_check(store,'42')
        replies[('GET',base+'/edit/tracks/internal')]['releases'][0]['status']='draft'
        store=FakeStore(replies)
        with self.assertRaises(ValueError): release.play_check(store,'42')
        self.assertIn(('DELETE',base+'/edit'),store.calls)
        replies[('GET',base+'/edit/testers/internal')]={}
        with self.assertRaises(ValueError): release.play_check(FakeStore(replies),None)

    def test_console_evidence_is_exact_and_fresh(self):
        evidence={'version':1,'bundleId':release.BUNDLE,'track':'internal','versionCode':'42',
                  'verifiedAt':10000,'existingTesterCount':1,'evidenceSha256':'a'*64}
        with patch.dict(os.environ,{'PLAY_EMAIL_AUDIENCE_ATTESTATION':json.dumps(evidence)}):
            self.assertEqual(release.validate_play_attestation('42',10010,now=10100),evidence)
            # Native building may take longer; the same evidence and run remain bounded.
            release.validate_play_attestation('42',10010,final=True,now=20000)
            with self.assertRaises(ValueError): release.validate_play_attestation('42',10010,now=13601)
            with self.assertRaises(ValueError): release.validate_play_attestation('42',10010,final=True,now=24401)
            with self.assertRaises(ValueError): release.validate_play_attestation('42',14000,final=True,now=15000)

    def test_console_evidence_rejects_scope_time_count_and_hash_errors(self):
        evidence={'version':1,'bundleId':release.BUNDLE,'track':'internal','versionCode':'42',
                  'verifiedAt':10000,'existingTesterCount':1,'evidenceSha256':'a'*64}
        invalid=[{'versionCode':'43'},{'versionCode':42},{'bundleId':'other.app'},
                 {'track':'production'},{'verifiedAt':10011},{'verifiedAt':6399},
                 {'verifiedAt':True},{'existingTesterCount':0},{'existingTesterCount':101},
                 {'existingTesterCount':True},{'evidenceSha256':'not-a-hash'},
                 {'evidenceSha256':'a'*63},{'email':'do-not-include-identities'},{'version':True}]
        for change in invalid:
            with self.subTest(change=change):
                with patch.dict(os.environ,{'PLAY_EMAIL_AUDIENCE_ATTESTATION':json.dumps(evidence|change)}):
                    with self.assertRaises(ValueError): release.validate_play_attestation('42',10010,now=10010)
        for raw in ['[]','null','{','x'*2049]:
            with patch.dict(os.environ,{'PLAY_EMAIL_AUDIENCE_ATTESTATION':raw}):
                with self.assertRaises(ValueError): release.validate_play_attestation('42',10010,now=10010)

    @patch('sys.stdout', new_callable=io.StringIO)
    def test_console_attested_audience_still_requires_completed_release(self, output):
        evidence={'version':1,'bundleId':release.BUNDLE,'track':'internal','versionCode':'42',
                  'verifiedAt':10000,'existingTesterCount':1,'evidenceSha256':'a'*64}
        base=release.BUNDLE+'/edits'
        replies={('POST',base):{'id':'edit'},
            ('GET',base+'/edit/tracks/internal'):{'releases':[{'versionCodes':['42'],'status':'completed'}]},
            ('GET',base+'/edit/testers/internal'):{},('DELETE',base+'/edit'): {}}
        with patch.dict(os.environ,{'PLAY_EMAIL_AUDIENCE_ATTESTATION':json.dumps(evidence)}), patch('release_verify.time.time',return_value=10020):
            release.play_check(FakeStore(replies),None,audience_build='42',since=10010)
            release.play_check(FakeStore(replies),'42',since=10010)
            self.assertIn('Console-attested',output.getvalue())
            self.assertIn('not API-verified membership',output.getvalue())
            replies[('GET',base+'/edit/tracks/internal')]['releases'][0]['status']='draft'
            with self.assertRaises(ValueError): release.play_check(FakeStore(replies),'42',since=10010)
            with self.assertRaises(ValueError): release.play_check(FakeStore(replies),None,audience_build='43',since=10010)

    @patch('sys.stdout', new_callable=io.StringIO)
    def test_artifact_access_check_does_not_upload_or_read_audience(self, output):
        base=release.BUNDLE+'/edits'
        store=FakeStore({('POST',base):{'id':'edit'},
            ('GET',base+'/edit/tracks/internal'):{},('DELETE',base+'/edit'): {}})
        release.play_app_access(store)
        self.assertEqual(store.calls,[('POST',base),('GET',base+'/edit/tracks/internal'),('DELETE',base+'/edit')])
        self.assertIn('artifact-only',output.getvalue())
        self.assertIn('no audience, upload, or delivery',output.getvalue())

    def test_workflow_platform_routing_keeps_artifact_mode_android_only(self):
        workflow=(Path(__file__).resolve().parents[2]/'.github/workflows/release-aha.yml').read_text()
        routing='\n'.join(line.strip() for line in workflow.splitlines()
                          if line.strip().startswith(('echo "ios=', 'echo "android=', 'echo "android_upload=')))
        expected={'both':{'ios':'true','android':'true','android_upload':'true'},
                  'ios':{'ios':'true','android':'false','android_upload':'true'},
                  'android':{'ios':'false','android':'true','android_upload':'true'},
                  'android-artifact':{'ios':'false','android':'true','android_upload':'false'}}
        for mode,values in expected.items():
            result=subprocess.run(['bash','-euc',routing],env=dict(os.environ,PLATFORMS=mode),
                                  text=True,capture_output=True,check=True)
            self.assertEqual(dict(line.split('=',1) for line in result.stdout.splitlines()),values)


if __name__ == '__main__': unittest.main()
