# Runbook: Quantize Whisper Large v3 → q8_0 ggml for iPad

**Goal.** Produce a `ggml-large-v3-q8_0.bin` file (full-decoder Large
v3 at 8-bit precision) for distribution to Corpán's pronunciation-
coach pack. `ggerganov/whisper.cpp` only publishes a q5_0 quant of
the full Large; the q8 is bigger and higher-quality, and we believe
it'll be the new best on iPad for Telugu / Tamil / Bengali and
other non-Latin-script languages.

**Intended runner.** A DGX Spark agent (or any Linux/macOS box with
Git, a C++ toolchain, and AWS CLI). The actual work is just a
numeric re-encoding of weights — no GPU required, though one
speeds the encoder validation step. Wall-time budget: ~15 minutes
including download.

**Output to produce.**
- `ggml-large-v3-q8_0.bin` — expected size ~1.55–1.7 GB.
- SHA256 of the produced file, for the registry entry.
- Uploaded to the project's S3 pack-asset bucket at a stable URL.

---

## 0. Prereqs

- `git`, `cmake`, a C++17 compiler, `wget` or `curl`.
- AWS CLI configured with credentials that can write to the pack-
  asset bucket. (The Corpán team's CI publish role has this.)
- ~6 GB free disk (whisper.cpp source ~200 MB, fp16 source weights
  ~3 GB, quantized output ~1.6 GB, plus build artifacts).

---

## 1. Clone and build whisper.cpp's `quantize` binary

```sh
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp

# CMake build — works on Linux, macOS, and the DGX. The `quantize`
# binary is pure CPU; no need for CUDA / Metal flags here.
cmake -B build -DBUILD_SHARED_LIBS=OFF
cmake --build build --config Release -j --target quantize
```

Expected output:
```
[100%] Linking CXX executable bin/quantize
```

Verify:
```sh
./build/bin/quantize --help 2>&1 | head -3
# Should print: usage: ./build/bin/quantize model-f32.gguf model-quant.gguf type [nthreads]
```

(The whisper.cpp `quantize` ignores the "gguf" suffix in the usage
text — it operates on the legacy ggml `.bin` format we use.)

---

## 2. Download the fp16 Large v3 source

```sh
mkdir -p models
wget -O models/ggml-large-v3.bin \
    https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin
```

Expected size ~3.09 GB. Verify the SHA256 against ggerganov's
listing on the HF page (the README in `whisper.cpp/models` has the
canonical hashes; or just check it's around 3.09 GB and proceed —
the quantize step will fail loudly on a corrupt file).

---

## 3. Quantize to q8_0

```sh
./build/bin/quantize \
    models/ggml-large-v3.bin \
    models/ggml-large-v3-q8_0.bin \
    q8_0
```

Quantization types reference (for the curious):
- `q4_0` — 4-bit, smallest, lossy.
- `q5_0` — 5-bit, what ggerganov ships for Large.
- `q5_1` — 5-bit with slightly different scaling.
- `q8_0` — 8-bit, what we want here. Closest to fp16 quality.

Expected:
- Walltime: a few minutes on modern CPU; well under a minute on
  the DGX.
- Output size: **~1.55–1.7 GB**. (Roughly half fp16 + per-block
  scale factors.)

Verify:
```sh
ls -la models/ggml-large-v3-q8_0.bin
file models/ggml-large-v3-q8_0.bin    # should report "data" (binary)
```

Capture the SHA256 — we'll want it for the registry entry and for
device-side integrity checking:
```sh
shasum -a 256 models/ggml-large-v3-q8_0.bin
```

---

## 4. Smoke-test locally before uploading

Make sure the quantized model loads and decodes a known sample,
so we don't ship a broken artifact.

```sh
# Build the `whisper-cli` binary too for the smoke test.
cmake --build build --config Release -j --target whisper-cli

# Use whisper.cpp's bundled sample (~11 s of English audio).
./build/bin/whisper-cli \
    --model models/ggml-large-v3-q8_0.bin \
    --file samples/jfk.wav \
    --language en \
    --print-colors
```

Expected: a coherent English transcription of the JFK clip. If
this comes back as gibberish, the quantize step produced a corrupt
artifact and we abort.

---

## 5. Upload to S3

Replace `<BUCKET>` with the pack-asset bucket name (see
`corpan/corpan-app/src/contentPacks/PRODUCTION_SETUP.md` §1 for
the bucket convention used by the rest of the pack registry).

```sh
aws s3 cp \
    models/ggml-large-v3-q8_0.bin \
    s3://<BUCKET>/whisper-models/ggml-large-v3-q8_0.bin \
    --content-type application/octet-stream \
    --acl public-read
```

Verify it's reachable over HTTPS:
```sh
curl -sI https://<BUCKET>.s3.amazonaws.com/whisper-models/ggml-large-v3-q8_0.bin \
    | head -5
# Should print: HTTP/1.1 200 OK
#               content-length: <1.5G+ bytes>
```

If using a CloudFront / custom CDN domain in front of S3, capture
that URL instead. The native plugin's iOS ATS settings allow HTTPS
download from any domain.

---

## 6. Wire it into the pack

Report back two things to the Corpán engineering team:

1. **Public download URL** (S3 or CDN).
2. **SHA256** captured in step 3.
3. **Exact filesize** in bytes (for `approxSizeMB` if it diverges
   from the ~1650 MB estimate I put in the registry).

The registry slot is already drafted at
`corpan/packs/pronunciation-coach/src/modelRegistry.ts` (entry id
`large_q8_full`, label `"Large q8 ★"`). The remaining work is:

- Uncomment the `downloadUrl: ...` line and set it to your URL.
- Update `approxSizeMB` if the actual file diverges from 1650.
- Extend `tauri-plugin-stt`'s `installModel` Rust/Swift/Kotlin
  bridge to forward the optional `downloadUrl` from the pack so
  the native side downloads from the custom URL instead of the
  hardcoded `huggingface.co/ggerganov/whisper.cpp/resolve/main/`
  base. (This is a small follow-up; the registry entry is staged
  but not yet wired to a custom URL.)
- Bump the pack version (`packs/pronunciation-coach/package.json`
  + `manifest.json`) so the device picks up the new entry.

---

## Troubleshooting

- **`quantize` errors with `whisper_model_quantize: failed to load
  model from ...`**: the source `ggml-large-v3.bin` is corrupt or
  truncated. Redownload from the HF URL.
- **Quantized output looks fine but `whisper-cli` smoke test
  produces gibberish**: confirm `BUILD_SHARED_LIBS=OFF` in the
  CMake config — some shared-lib builds have produced misaligned
  weights on certain platforms. Clean rebuild fixes it.
- **`whisper-cli` not found**: the target wasn't built. Re-run
  `cmake --build build --config Release -j --target whisper-cli`.
- **S3 upload returns 403**: AWS creds don't have
  `s3:PutObject` for the target prefix. Check the CI publish role
  or use a user with explicit permissions.

---

## Reference: where this file is consumed

- Pack registry slot: `packs/pronunciation-coach/src/modelRegistry.ts`,
  search for `large_q8_full`.
- Native install path: `plugins/tauri-plugin-stt/ios/Sources/STTPlugin.swift::installModel`
  (currently hardcodes the HF base; needs the small extension noted
  in §6 to honor a custom URL from the pack).
- Bucket / IAM conventions:
  `corpan-app/src/contentPacks/PRODUCTION_SETUP.md`.

Once this lands, expected accuracy improvement over the current
Large q5 on Telugu / Tamil / Bengali should be measurable from the
device os_log `Whisper | [stt-cal] heard:` lines in the
pronunciation-coach pack's existing trace. See `corpan/CLAUDE.md`
and `corpan/DEV_LOOP.md` for the live-trace setup.
