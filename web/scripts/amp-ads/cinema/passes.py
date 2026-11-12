"""Exact 3D scene -> registered control passes -> composite over a generated world.

    passes     Blender renders beauty (RGBA), depth and normal frames from one
               scene; FFmpeg encodes depth/normal/edge/matte control videos and
               a plain preview. `passes.json` records sizes, hashes and the
               geometry check.
    composite  the exact beauty frames over any background video (a generated
               environment, or a geometry-guided restyle of the same shot).

Blender controls what is true; the video model only controls how it looks.
"""
import json
import math
import os
import shutil
import sys
from pathlib import Path

from . import graph
from .render import probe, run, sha, stamp, write_json
from .scene3d import geometry
from .spec import SpecError

HERE = Path(__file__).resolve().parent
SCENES = {'hatbox': HERE / 'scene3d' / 'hatbox.py'}
BACKDROP = '0x071624'
CONTROL = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-pix_fmt', 'yuv420p']


def blender_command(scene, out, width, height, frames, samples):
    """Blender if installed (AMP_BLENDER or PATH), else this Python with the bpy wheel."""
    args = ['--out', out, '--width', width, '--height', height, '--frames', frames, '--samples', samples]
    exe = os.environ.get('AMP_BLENDER') or shutil.which('blender')
    head = [exe, '-b', '--factory-startup', '--python', SCENES[scene], '--'] if exe else [sys.executable, SCENES[scene]]
    return [str(a) for a in head + args]


def encode_commands(out, size, fps):
    """argv per derived video. Edges and matte come from the beauty frames, so
    every control video shares the beauty render's pixels exactly."""
    out = Path(out)
    w, h = size
    seq = lambda name: ['-framerate', str(fps), '-i', str(out / name / '%04d.png')]  # noqa: E731
    head = ['ffmpeg', '-hide_banner', '-nostdin', '-n']
    over = f'color={BACKDROP}:s={w}x{h}:r={fps}[bg];[bg][0:v]overlay=shortest=1:format=auto'
    return {
        'depth.mp4': [*head, *seq('depth'), *CONTROL, str(out / 'depth.mp4')],
        'normal.mp4': [*head, *seq('normal'), *CONTROL, str(out / 'normal.mp4')],
        'edge.mp4': [*head, *seq('beauty'), '-filter_complex',
                     f'color=black:s={w}x{h}:r={fps}[bg];[bg][0:v]overlay=shortest=1:format=auto,'
                     'edgedetect=low=0.06:high=0.18,format=yuv420p', *CONTROL, str(out / 'edge.mp4')],
        'matte.mp4': [*head, *seq('beauty'), '-vf', 'alphaextract,format=yuv420p', *CONTROL, str(out / 'matte.mp4')],
        'preview.mp4': [*head, *seq('beauty'), '-filter_complex', f'{over},format=yuv420p',
                        *CONTROL, str(out / 'preview.mp4')],
    }


def geometry_check(grid=None):
    """Band areas of the drawn mesh in each state against 2 pi R dz. The flat
    and cylinder states are isometric, so they agree to the facet error of a
    circle; the sphere converges from below as the mesh is refined."""
    grid = grid or geometry.Grid()
    exact = geometry.exact_band_area(grid)
    report = {'exactBandArea': exact, 'exactTotal': 4 * math.pi * geometry.R ** 2, 'states': {}}
    for name, (push, unroll) in {'sphere': (0, 0), 'cylinder': (1, 0), 'half-unrolled': (1, 0.5), 'flat': (1, 1)}.items():
        areas = geometry.band_areas(grid, grid.vertices(push, unroll))
        report['states'][name] = {'total': sum(areas), 'maxBandError': max(abs(a - exact) / exact for a in areas)}
    worst = max(s['maxBandError'] for s in report['states'].values())
    if worst > 0.01 or report['states']['flat']['maxBandError'] > 1e-9:
        raise SpecError(f'hat-box geometry check failed: {report}')
    return report


def render(scene, out, width=1344, height=768, frames=121, fps=24, samples=24):
    if scene not in SCENES:
        raise SpecError(f'scene must be one of {sorted(SCENES)}')
    out = Path(out)
    if (out / 'passes.json').exists():
        raise SpecError(f'{out} already holds passes; use a new directory (renders are never overwritten)')
    if width % 2 or height % 2 or frames < 2:
        raise SpecError('width and height must be even and frames at least 2')
    check = geometry_check()
    out.mkdir(parents=True, exist_ok=True)
    argv = blender_command(scene, out, width, height, frames, samples)
    run(argv)
    for name in ('beauty', 'depth', 'normal'):
        if len(list((out / name).glob('*.png'))) != frames:
            raise RuntimeError(f'{name}: expected {frames} frames')
    commands = encode_commands(out, (width, height), fps)
    for cmd in commands.values():
        run(cmd)
    manifest = {
        'scene': scene, 'createdAt': stamp(), 'size': [width, height], 'frames': frames, 'fps': fps,
        'duration': frames / fps, 'samples': samples, 'geometry': check,
        'sceneSha256': {p.name: sha(p) for p in sorted(SCENES[scene].parent.glob('*.py'))},
        'blender': [Path(argv[0]).name, *argv[1:]],
        'videos': {name: {'sha256': sha(out / name), 'ffmpeg': cmd} for name, cmd in commands.items()},
        'beautyFrames': 'beauty/%04d.png',
    }
    write_json(out / 'passes.json', manifest)
    return manifest


def composite_command(passes_dir, manifest, background, out, frame=None, encoder='libx264', preset='slow'):
    """Exact geometry over a background video. The background is cropped to
    fill, looped if short and cut to the shot; the beauty frames keep their
    own alpha, so mathematical edges stay exactly where Blender put them."""
    w, h = frame or manifest['size']
    fps, n = manifest['fps'], manifest['frames']
    chain = (f'[0:v]fps={fps},scale={w}:{h}:force_original_aspect_ratio=increase:flags=lanczos,crop={w}:{h},'
             f'setsar=1[bg];[1:v]scale={w}:{h}:flags=lanczos,format=rgba[fg];'
             f'[bg][fg]overlay=format=auto,format=yuv420p[v]')
    return ['ffmpeg', '-hide_banner', '-nostdin', '-n', '-stream_loop', '-1', '-i', str(background),
            '-framerate', str(fps), '-i', str(Path(passes_dir) / manifest['beautyFrames']),
            '-filter_complex', chain, '-map', '[v]', '-frames:v', str(n), '-an',
            *graph.encoder_args(encoder, (w, h), preset), str(out)]


def composite(passes_dir, background, out, frame=None):
    passes_dir, out = Path(passes_dir), Path(out)
    manifest_path = passes_dir / 'passes.json'
    if not manifest_path.exists():
        raise SpecError(f'{passes_dir} has no passes.json; run `passes` first')
    if out.exists():
        raise SpecError(f'{out} exists; composites are never overwritten')
    manifest = json.loads(manifest_path.read_text())
    if frame and abs(frame[0] / frame[1] - manifest['size'][0] / manifest['size'][1]) > 0.01:
        raise SpecError('composite size must keep the aspect ratio of the passes; render the scene per framing')
    out.parent.mkdir(parents=True, exist_ok=True)
    cmd = composite_command(passes_dir, manifest, background, out, frame,
                            os.environ.get('AMP_VIDEO_ENCODER', 'libx264'), os.environ.get('AMP_X264_PRESET', 'slow'))
    run(cmd)
    video = next(s for s in probe(out)['streams'] if s['codec_type'] == 'video')
    receipt = {'createdAt': stamp(), 'output': {'file': out.name, 'sha256': sha(out), 'size': [video['width'], video['height']],
                                               'frames': int(video['nb_frames'])},
               'passes': {'dir': str(passes_dir), 'manifestSha256': sha(manifest_path)},
               'background': {'file': str(background), 'sha256': sha(background)}, 'ffmpeg': cmd}
    if receipt['output']['frames'] != manifest['frames']:
        raise RuntimeError(f'composite has {receipt["output"]["frames"]} frames, expected {manifest["frames"]}')
    write_json(out.with_suffix('.receipt.json'), receipt)
    return receipt
