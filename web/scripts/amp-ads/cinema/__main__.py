"""python3 -m cinema <command>   (run from web/scripts/amp-ads; see cinema/README.md)"""
import argparse
import json
import os
import sys

from . import gallery, plan, render, spec, voice, youtube


def main(argv=None):
    p = argparse.ArgumentParser(prog='python3 -m cinema', description=__doc__)
    sub = p.add_subparsers(dest='cmd', required=True)
    v = sub.add_parser('validate', help='check ad specs (structure, timing, text rules)')
    v.add_argument('specs', nargs='+')
    g = sub.add_parser('plan', help='shot list -> GPU-host batch dir (prompts, plan.json, supervisor)')
    g.add_argument('shotlist')
    g.add_argument('out_dir')
    g.add_argument('--remote-root', default=os.environ.get('AMP_SPARK_ROOT'))
    g.add_argument('--remote-python', default=os.environ.get('AMP_SPARK_PYTHON'))
    g.add_argument('--remote-outputs', default=os.environ.get('AMP_SPARK_OUTPUTS'))
    c = sub.add_parser('gallery', help='rebuild the grading page for a synced batch dir')
    c.add_argument('batch_dir')
    vo = sub.add_parser('voice', help='check a spec\'s take; optionally generate takes or verify a transcript')
    vo.add_argument('spec')
    vo.add_argument('--generate', type=int, metavar='N', help='generate N takes via REST (ELEVENLABS_API_KEY)')
    vo.add_argument('--transcript', help='transcription file to compare with the script')
    r = sub.add_parser('render', help='cards + mix + video per format + QC, with receipts')
    r.add_argument('specs', nargs='+')
    r.add_argument('--out', default=os.environ.get('AMP_ADS_OUT'), help='output root (default $AMP_ADS_OUT)')
    r.add_argument('--format', action='append', choices=sorted(spec.FORMATS))
    r.add_argument('--master', action='store_true', help='render 4K masters (2x delivery size)')
    r.add_argument('--divisor', type=int, default=1, help=argparse.SUPPRESS)  # smoke tests: tiny frames
    r.add_argument('--replace', action='store_true', help='move changed artifacts to superseded/ and rerender')
    rv = sub.add_parser('review', help='build review.html for finished ads under an output root')
    rv.add_argument('out_root')
    u = sub.add_parser('upload', help='upload one finished video to YouTube as PRIVATE')
    u.add_argument('video')
    u.add_argument('--title', required=True)
    u.add_argument('--description', default='')
    u.add_argument('--tag', action='append', default=[])
    a = p.parse_args(argv)
    try:
        if a.cmd == 'validate':
            for path in a.specs:
                s = spec.load(path)
                print(f'ok {s["id"]}: {s["duration"]:g}s, {len(s["shots"])} shots, {len(s["cards"])} cards, '
                      f'formats {",".join(s["formats"])}')
        elif a.cmd == 'plan':
            if not (a.remote_root and a.remote_python and a.remote_outputs):
                p.error('set AMP_SPARK_ROOT, AMP_SPARK_PYTHON and AMP_SPARK_OUTPUTS (or the --remote-* flags)')
            jobs = plan.write(a.shotlist, a.out_dir, a.remote_root, a.remote_python, a.remote_outputs)
            print(f'{len(jobs)} jobs -> {a.out_dir}')
        elif a.cmd == 'gallery':
            print(gallery.clips(a.batch_dir))
        elif a.cmd == 'voice':
            s = spec.load(a.spec)
            if a.generate:
                print(json.dumps(voice.generate(s, a.generate), indent=2))
            if a.transcript:
                ok = voice.verify(s, a.transcript)
                print('transcript matches script' if ok else 'transcript DIFFERS from script')
                if not ok:
                    return 1
            print(json.dumps(voice.check(s), indent=2))
        elif a.cmd == 'render':
            if not a.out:
                p.error('pass --out or set AMP_ADS_OUT')
            for path in a.specs:
                s = spec.load(path)
                result = render.render(s, a.out, a.format, a.master, a.divisor, a.replace)
                print(json.dumps({s['id']: result}, indent=2))
        elif a.cmd == 'review':
            print(gallery.ads(a.out_root))
        elif a.cmd == 'upload':
            print(youtube.upload(a.video, a.title, a.description, a.tag))
    except spec.SpecError as e:
        print(f'error: {e}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
