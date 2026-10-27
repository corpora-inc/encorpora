"""FFmpeg argument builders. Pure functions: inputs in, argv out, so the exact
filtergraph is unit tested and recorded verbatim in every receipt."""
from .spec import timeline

BACKGROUND = '0x071624'  # letterbox colour for `contain` (product UI) shots
CARD_FADE_IN, CARD_FADE_OUT, END_FADE_IN, FINAL_FADE = 0.25, 0.35, 0.4, 0.25
VOICE_LUFS, TARGET_LUFS, TARGET_TP = -16.0, -14.0, -1.5
# Ducking: music drops roughly 8-10 dB while the voice speaks, recovers in 350 ms.
DUCK = 'sidechaincompress=threshold=0.02:ratio=6:attack=15:release=350:makeup=1'
STEREO = 'aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo'
SILENCE = f'anullsrc=r=48000:cl=stereo,{STEREO}'


def _t(x):
    return f'{x:.6g}'


def encoder_args(encoder, frame, preset='slow'):
    w, h = frame
    color = ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709']
    if encoder == 'videotoolbox':
        rate = '45M' if w * h > 2_500_000 else '16M'
        return ['-c:v', 'h264_videotoolbox', '-b:v', rate, '-pix_fmt', 'yuv420p', *color]
    if encoder == 'libx264':
        return ['-c:v', 'libx264', '-preset', preset, '-crf', '17', '-profile:v', 'high',
                '-pix_fmt', 'yuv420p', *color]
    raise ValueError('encoder must be libx264 or videotoolbox')


def video_command(spec, frame, sources, cards, end_card, mix, out, encoder='libx264', preset='slow'):
    """One format's render.

    sources: resolved shot paths in spec order. cards: [(png, start, end)].
    end_card: png shown from endCard.start to the end. mix: finished audio.
    """
    w, h = frame
    fps, total = spec['fps'], spec['duration']
    shots, times = spec['shots'], timeline(spec)
    args = ['ffmpeg', '-hide_banner', '-nostdin', '-n']
    graph = []
    for i, (shot, t, src) in enumerate(zip(shots, times, sources)):
        span = shot['out'] - shot['in']
        args += ['-ss', _t(shot['in']), '-t', _t(span), '-i', str(src)]
        if shot['fit'] == 'contain':
            fit = (f'scale={w}:{h}:force_original_aspect_ratio=decrease:flags=lanczos,'
                   f'pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color={BACKGROUND}')
        else:
            fit = f'scale={w}:{h}:force_original_aspect_ratio=increase:flags=lanczos,crop={w}:{h}'
        stretch = _t(t['renderDuration'] / span) if shot.get('retime', True) else '1'
        graph.append(f'[{i}:v]{fit},setsar=1,setpts=(PTS-STARTPTS)*{stretch},fps={fps},'
                     f'tpad=stop_mode=clone:stop_duration={_t(t["renderDuration"])},'
                     f'trim=duration={_t(t["renderDuration"])},settb=AVTB,setpts=PTS-STARTPTS,fps={fps},'
                     f'format=yuv420p[s{i}]')
    if len(shots) == 1:
        graph.append('[s0]null[cut]')
    else:
        prev = 's0'
        for i, shot in enumerate(shots[:-1]):
            tr = shot.get('transition') or {'type': 'cut'}
            kind, dur = ('fade', 1 / fps) if tr['type'] == 'cut' else (tr['type'], tr['duration'])
            label = 'cut' if i == len(shots) - 2 else f'x{i}'
            graph.append(f'[{prev}][s{i + 1}]xfade=transition={kind}:duration={_t(dur)}:'
                         f'offset={_t(times[i + 1]["outputStart"])}[{label}]')
            prev = label
    n = len(shots)
    prev = 'cut'
    for j, (png, start, end) in enumerate(cards):
        args += ['-loop', '1', '-framerate', str(fps), '-t', _t(total), '-i', str(png)]
        graph.append(f'[{n + j}:v]format=rgba,fade=t=in:st={_t(start)}:d={CARD_FADE_IN}:alpha=1,'
                     f'fade=t=out:st={_t(end - CARD_FADE_OUT)}:d={CARD_FADE_OUT}:alpha=1[c{j}]')
        graph.append(f'[{prev}][c{j}]overlay=0:0:enable=between(t\\,{_t(start)}\\,{_t(end)})[v{j}]')
        prev = f'v{j}'
    e = n + len(cards)
    es = spec['endCard']['start']
    args += ['-loop', '1', '-framerate', str(fps), '-t', _t(total), '-i', str(end_card), '-i', str(mix)]
    graph.append(f'[{e}:v]format=rgba,fade=t=in:st={_t(es)}:d={END_FADE_IN}:alpha=1[end]')
    graph.append(f'[{prev}][end]overlay=0:0:enable=gte(t\\,{_t(es)}),'
                 f'fade=t=out:st={_t(total - FINAL_FADE)}:d={FINAL_FADE},format=yuv420p[v]')
    args += ['-filter_complex', ';'.join(graph), '-map', '[v]', '-map', f'{e + 1}:a',
             *encoder_args(encoder, frame, preset), '-r', str(fps),
             '-c:a', 'copy', '-movflags', '+faststart', '-t', _t(total), str(out)]
    return args


def _place(src, pieces, total, tag):
    """Lay (from, to, at) excerpts of stream `src` on a silent timeline of `total`
    seconds with concat. Every piece has an explicit length, so the result is
    exactly `total` long (apad/amix chains can lose timestamps and never end)."""
    out, chain, clock = [], [], 0.0
    out.append(f'[{src}]asplit={len(pieces)}' + ''.join(f'[{tag}i{i}]' for i in range(len(pieces))))
    for i, (a, b, at) in enumerate(pieces):
        if at - clock > 0.0005:
            out.append(f'{SILENCE},atrim=duration={_t(at - clock)}[{tag}g{i}]')
            chain.append(f'[{tag}g{i}]')
        out.append(f'[{tag}i{i}]atrim=start={_t(a)}:end={_t(b)},asetpts=PTS-STARTPTS[{tag}p{i}]')
        chain.append(f'[{tag}p{i}]')
        clock = at + (b - a)
    if total - clock > 0.0005:
        out.append(f'{SILENCE},atrim=duration={_t(total - clock)}[{tag}tail]')
        chain.append(f'[{tag}tail]')
    out.append(''.join(chain) + f'concat=n={len(chain)}:v=0:a=1[{tag}]')
    return out


def premix_command(spec, voice, music, sfx, voice_gain, music_gain, out, voice_seconds=None, sfx_seconds=()):
    """Voice placed (whole take at voice.start, or per-sentence segments), music
    bed ducked under it with a sidechain compressor, optional sound effects.
    Output is a 48 kHz premix that `loudnorm_command` brings to delivery loudness."""
    total = spec['duration']
    args = ['ffmpeg', '-hide_banner', '-nostdin', '-n']
    graph, mix = [], []
    k = 0
    if voice:
        v = spec['voice']
        args += ['-i', str(voice)]
        pieces = [(s['from'], s['to'], s['at']) for s in v.get('segments') or []] or \
            [(0.0, voice_seconds, v['start'])]
        graph.append(f'[{k}:a]{STEREO},volume={voice_gain:.2f}dB[vin]')
        graph += _place('vin', pieces, total, 'vraw')
        graph.append('[vraw]asplit=2[voice][key]' if music else '[vraw]anull[voice]')
        mix.append('[voice]')
        k += 1
    if music:
        m = spec['music']
        args += ['-ss', _t(m['offset']), '-t', _t(total), '-i', str(music)]
        graph.append(f'[{k}:a]{STEREO},volume={music_gain:.2f}dB,afade=t=in:st=0:d=0.8,'
                     f'afade=t=out:st={_t(total - 1.7)}:d=1.7[min]')
        # render.audio refuses an excerpt shorter than the ad, so this piece is exactly `total`.
        graph += _place('min', [(0.0, total, 0.0)], total, 'bed')
        if voice:
            graph.append(f'[bed][key]{DUCK}[music]')
            mix.append('[music]')
        else:
            mix.append('[bed]')
        k += 1
    for i, (path, fx, length) in enumerate(zip(sfx, spec.get('sfx', []), sfx_seconds)):
        args += ['-i', str(path)]
        graph.append(f'[{k}:a]{STEREO},volume={fx["gainDb"]:.2f}dB[fxin{i}]')
        graph += _place(f'fxin{i}', [(0.0, min(length, total - fx['at']), fx['at'])], total, f'fx{i}')
        mix.append(f'[fx{i}]')
        k += 1
    if len(mix) == 1:
        graph.append(f'{mix[0]}anull[a]')
    else:
        graph.append(''.join(mix) + f'amix=inputs={len(mix)}:normalize=0:duration=first[a]')
    # -t caps the output even if a filter misbehaves (an unbounded apad once wrote 24 GB).
    args += ['-filter_complex', ';'.join(graph), '-map', '[a]', '-t', _t(total), '-ar', '48000',
             '-c:a', 'pcm_f32le', str(out)]
    return args


def loudnorm_command(premix, measured, out):
    """Second loudnorm pass: linear gain to -14 LUFS with a -1.5 dBTP ceiling."""
    ln = (f'loudnorm=I={TARGET_LUFS}:TP={TARGET_TP}:LRA=11:measured_I={measured["input_i"]}:'
          f'measured_TP={measured["input_tp"]}:measured_LRA={measured["input_lra"]}:'
          f'measured_thresh={measured["input_thresh"]}:offset={measured["target_offset"]}:linear=true')
    return ['ffmpeg', '-hide_banner', '-nostdin', '-n', '-i', str(premix), '-af', f'{ln},aresample=48000',
            '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', str(out)]
