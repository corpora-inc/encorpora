import io
import os
from pathlib import Path
import struct
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


if __name__ == '__main__': unittest.main()
