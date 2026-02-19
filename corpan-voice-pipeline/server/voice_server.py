"""
Corpán Voice Generation Server
==============================
Runs on the DGX Spark. Accepts TTS jobs over HTTP, queues them,
generates audio using Chatterbox Multilingual or Qwen3-TTS,
and returns completed audio files.

Setup (on DGX Spark):
    conda create -yn corpan-voice python=3.11
    conda activate corpan-voice
    pip install chatterbox-tts fastapi uvicorn pydantic aiofiles

    # For Qwen3-TTS support (optional, adds 10 more languages):
    pip install qwen-tts

Run:
    uvicorn voice_server:app --host 0.0.0.0 --port 8700

Access from your Mac:
    http://<spark-ip>:8700/docs   (interactive API docs)
    http://<spark-ip>:8700/status (queue status)
"""

import asyncio
import hashlib
import json
import logging
import os
import shutil
import time
import uuid
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional

import torch
import torchaudio as ta
from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DATA_DIR = Path(os.environ.get("CORPAN_VOICE_DATA", "./voice-data"))
VOICES_DIR = DATA_DIR / "voices"
JOBS_DIR = DATA_DIR / "jobs"
OUTPUT_DIR = DATA_DIR / "output"

for d in [VOICES_DIR, JOBS_DIR, OUTPUT_DIR]:
    d.mkdir(parents=True, exist_ok=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("corpan-voice")

# ---------------------------------------------------------------------------
# Supported languages per engine
# ---------------------------------------------------------------------------

CHATTERBOX_LANGUAGES = {
    "ar", "da", "de", "el", "en", "es", "fi", "fr", "he", "hi",
    "it", "ja", "ko", "ms", "nl", "no", "pl", "pt", "ru", "sv",
    "sw", "tr", "zh",
}

QWEN3_TTS_LANGUAGES = {
    "zh", "en", "ja", "ko", "de", "fr", "ru", "pt", "es", "it",
}

# Languages only Qwen3 covers (none currently — Chatterbox is superset)
# Languages neither covers natively (your South Asian languages):
UNSUPPORTED_NATIVE = {
    "ta", "te", "kn", "mr", "gu", "pa", "ur", "bn", "vi", "th", "id",
}

# ---------------------------------------------------------------------------
# Models (lazy-loaded on first use)
# ---------------------------------------------------------------------------

_chatterbox_model = None
_chatterbox_multilingual_model = None
_qwen3_model = None


def get_chatterbox():
    """Load Chatterbox English model (best quality for English)."""
    global _chatterbox_model
    if _chatterbox_model is None:
        logger.info("Loading Chatterbox English model...")
        from chatterbox.tts import ChatterboxTTS
        _chatterbox_model = ChatterboxTTS.from_pretrained(device="cuda")
        logger.info("Chatterbox English model loaded.")
    return _chatterbox_model


def get_chatterbox_multilingual():
    """Load Chatterbox Multilingual model (23 languages)."""
    global _chatterbox_multilingual_model
    if _chatterbox_multilingual_model is None:
        logger.info("Loading Chatterbox Multilingual model...")
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
        _chatterbox_multilingual_model = ChatterboxMultilingualTTS.from_pretrained(device="cuda")
        logger.info("Chatterbox Multilingual model loaded.")
    return _chatterbox_multilingual_model


def get_qwen3_tts():
    """Load Qwen3-TTS model (alternative engine, 10 languages)."""
    global _qwen3_model
    if _qwen3_model is None:
        logger.info("Loading Qwen3-TTS model...")
        try:
            from qwen_tts import QwenTTS
            _qwen3_model = QwenTTS.from_pretrained(
                "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
                device="cuda"
            )
            logger.info("Qwen3-TTS model loaded.")
        except ImportError:
            logger.warning("Qwen3-TTS not installed. Only Chatterbox available.")
            _qwen3_model = False  # Sentinel: tried and failed
    return _qwen3_model if _qwen3_model is not False else None


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

class EngineChoice(str, Enum):
    auto = "auto"
    chatterbox = "chatterbox"
    qwen3 = "qwen3"


class JobStatus(str, Enum):
    queued = "queued"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class GenerateRequest(BaseModel):
    """Single TTS generation request."""
    text: str = Field(..., description="Text to synthesize")
    language: str = Field(..., description="ISO language code (e.g. 'en', 'es', 'hi')")
    voice_id: str = Field(..., description="Voice profile ID (from /voices)")
    engine: EngineChoice = Field(
        default=EngineChoice.auto,
        description="TTS engine: 'auto' picks best for language"
    )
    exaggeration: float = Field(default=0.35, ge=0.0, le=1.0, description="Emotion intensity (Chatterbox)")
    cfg: float = Field(default=0.5, ge=0.0, le=1.0, description="Voice conformity (Chatterbox)")
    output_format: str = Field(default="wav", description="Output: 'wav' or 'opus'")


class BatchRequest(BaseModel):
    """Batch of TTS generation requests (e.g., a full chapter)."""
    book_id: str = Field(..., description="Book identifier (e.g. 'monte-alban')")
    chapter_id: str = Field(..., description="Chapter identifier (e.g. 'ch01')")
    voice_id: str = Field(..., description="Voice profile ID")
    engine: EngineChoice = Field(default=EngineChoice.auto)
    exaggeration: float = Field(default=0.35, ge=0.0, le=1.0)
    cfg: float = Field(default=0.5, ge=0.0, le=1.0)
    segments: list[dict] = Field(
        ...,
        description="List of segments from segments.json. Each needs 'id', 'language', and 'tts.text'"
    )


class JobInfo(BaseModel):
    job_id: str
    status: JobStatus
    created_at: str
    completed_at: Optional[str] = None
    total_segments: int = 0
    completed_segments: int = 0
    failed_segments: int = 0
    current_segment: Optional[str] = None
    error: Optional[str] = None
    output_dir: Optional[str] = None


# ---------------------------------------------------------------------------
# Job queue
# ---------------------------------------------------------------------------

job_queue: asyncio.Queue = asyncio.Queue()
jobs: dict[str, JobInfo] = {}
_worker_started = False


async def process_queue():
    """Background worker that processes TTS jobs sequentially."""
    logger.info("Queue worker started.")
    while True:
        job_id, batch = await job_queue.get()
        try:
            await process_batch_job(job_id, batch)
        except Exception as e:
            logger.error(f"Job {job_id} failed: {e}")
            if job_id in jobs:
                jobs[job_id].status = JobStatus.failed
                jobs[job_id].error = str(e)
        finally:
            job_queue.task_done()


async def process_batch_job(job_id: str, batch: BatchRequest):
    """Process a batch of segments."""
    job = jobs[job_id]
    job.status = JobStatus.processing

    # Create output directory
    out_dir = OUTPUT_DIR / batch.book_id / batch.chapter_id / job_id
    out_dir.mkdir(parents=True, exist_ok=True)
    job.output_dir = str(out_dir)

    # Load voice profile
    voice_path = VOICES_DIR / f"{batch.voice_id}.wav"
    if not voice_path.exists():
        raise FileNotFoundError(f"Voice profile '{batch.voice_id}' not found")

    voice_path_str = str(voice_path)
    manifest = []

    for i, segment in enumerate(batch.segments):
        seg_id = segment.get("id", f"seg_{i:04d}")
        language = segment.get("language", "en")

        # Extract TTS text — supports both flat and nested format
        tts_data = segment.get("tts", {})
        if isinstance(tts_data, dict):
            text = tts_data.get("text", segment.get("text", ""))
            pause_after = tts_data.get("pause_after_ms", 800)
        else:
            text = segment.get("text", "")
            pause_after = 800

        if not text.strip():
            logger.warning(f"Segment {seg_id}: empty text, skipping")
            continue

        job.current_segment = seg_id
        logger.info(f"Job {job_id} | Segment {i+1}/{job.total_segments}: {seg_id} ({language})")

        try:
            # Pick engine
            engine = pick_engine(batch.engine, language)
            output_path = out_dir / f"{seg_id}.wav"

            # Generate audio (run in executor to not block event loop)
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                generate_audio,
                text, language, voice_path_str, engine,
                batch.exaggeration, batch.cfg, str(output_path)
            )

            manifest.append({
                "segment_id": seg_id,
                "language": language,
                "file": f"{seg_id}.wav",
                "duration_estimate_s": estimate_duration(text),
                "pause_after_ms": pause_after,
                "engine": engine,
                "status": "ok",
            })
            job.completed_segments += 1

        except Exception as e:
            logger.error(f"Segment {seg_id} failed: {e}")
            manifest.append({
                "segment_id": seg_id,
                "language": language,
                "file": None,
                "error": str(e),
                "status": "failed",
            })
            job.failed_segments += 1

    # Write manifest
    manifest_path = out_dir / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump({
            "book_id": batch.book_id,
            "chapter_id": batch.chapter_id,
            "voice_id": batch.voice_id,
            "generated_at": datetime.utcnow().isoformat(),
            "segments": manifest,
        }, f, indent=2)

    job.status = JobStatus.completed
    job.completed_at = datetime.utcnow().isoformat()
    job.current_segment = None
    logger.info(f"Job {job_id} completed: {job.completed_segments} ok, {job.failed_segments} failed")


def pick_engine(preference: EngineChoice, language: str) -> str:
    """Select the best engine for a given language."""
    if preference == EngineChoice.chatterbox:
        return "chatterbox"
    if preference == EngineChoice.qwen3:
        return "qwen3"

    # Auto selection
    if language == "en":
        return "chatterbox"  # English-specific model is highest quality
    if language in CHATTERBOX_LANGUAGES:
        return "chatterbox_multilingual"
    if language in QWEN3_TTS_LANGUAGES:
        return "qwen3"

    # Unsupported language — try Chatterbox multilingual anyway (zero-shot)
    logger.warning(f"Language '{language}' not natively supported. Attempting Chatterbox zero-shot.")
    return "chatterbox_multilingual"


def generate_audio(
    text: str,
    language: str,
    voice_path: str,
    engine: str,
    exaggeration: float,
    cfg: float,
    output_path: str,
):
    """Generate audio for a single text segment. Runs synchronously (called via executor)."""

    if engine == "chatterbox":
        model = get_chatterbox()
        wav = model.generate(
            text,
            audio_prompt_path=voice_path,
            exaggeration=exaggeration,
            cfg=cfg,
        )
        ta.save(output_path, wav, model.sr)

    elif engine == "chatterbox_multilingual":
        model = get_chatterbox_multilingual()
        wav = model.generate(
            text,
            language_id=language,
            audio_prompt_path=voice_path,
            exaggeration=exaggeration,
            cfg=cfg,
        )
        ta.save(output_path, wav, model.sr)

    elif engine == "qwen3":
        model = get_qwen3_tts()
        if model is None:
            raise RuntimeError("Qwen3-TTS not available. Install with: pip install qwen-tts")
        # Qwen3-TTS API — adapt to actual API once installed
        wav = model.generate(
            text=text,
            voice_prompt_path=voice_path,
            language=language,
        )
        ta.save(output_path, wav, model.sr)

    else:
        raise ValueError(f"Unknown engine: {engine}")

    logger.info(f"Generated: {output_path} ({engine})")


def estimate_duration(text: str) -> float:
    """Rough estimate of audio duration in seconds."""
    words = len(text.split())
    return round(words / 2.5, 1)  # ~150 wpm = 2.5 words/sec


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Corpán Voice Generation Server",
    description="TTS generation server for Corpán book packs. Runs on DGX Spark.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    global _worker_started
    if not _worker_started:
        asyncio.create_task(process_queue())
        _worker_started = True
        logger.info("Corpán Voice Server started.")
        logger.info(f"Data directory: {DATA_DIR}")
        logger.info(f"GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'}")


# -- Voice Profiles ---------------------------------------------------------

@app.post("/voices/upload", tags=["voices"])
async def upload_voice(
    voice_id: str,
    file: UploadFile = File(..., description="WAV file, 10-15 seconds, clean audio, single speaker"),
):
    """Upload a voice sample to create a voice profile."""
    if not voice_id.replace("-", "").replace("_", "").isalnum():
        raise HTTPException(400, "voice_id must be alphanumeric (hyphens/underscores ok)")

    dest = VOICES_DIR / f"{voice_id}.wav"
    with open(dest, "wb") as f:
        content = await file.read()
        f.write(content)

    return {
        "voice_id": voice_id,
        "path": str(dest),
        "size_bytes": len(content),
        "message": f"Voice profile '{voice_id}' saved. Use this voice_id in generation requests.",
    }


@app.get("/voices", tags=["voices"])
async def list_voices():
    """List all available voice profiles."""
    voices = []
    for wav in sorted(VOICES_DIR.glob("*.wav")):
        stat = wav.stat()
        voices.append({
            "voice_id": wav.stem,
            "filename": wav.name,
            "size_bytes": stat.st_size,
            "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
        })
    return {"voices": voices}


# -- Single Generation ------------------------------------------------------

@app.post("/generate", tags=["generate"])
async def generate_single(req: GenerateRequest):
    """Generate audio for a single text. Returns the WAV file directly."""
    voice_path = VOICES_DIR / f"{req.voice_id}.wav"
    if not voice_path.exists():
        raise HTTPException(404, f"Voice profile '{req.voice_id}' not found. Upload one first.")

    engine = pick_engine(req.engine, req.language)
    output_id = hashlib.md5(f"{req.text}:{req.language}:{req.voice_id}".encode()).hexdigest()[:12]
    output_path = JOBS_DIR / f"single_{output_id}.wav"

    try:
        generate_audio(
            req.text, req.language, str(voice_path), engine,
            req.exaggeration, req.cfg, str(output_path)
        )
    except Exception as e:
        raise HTTPException(500, f"Generation failed: {e}")

    return FileResponse(
        str(output_path),
        media_type="audio/wav",
        filename=f"corpan_{req.language}_{output_id}.wav",
    )


# -- Batch Generation (Queue) -----------------------------------------------

@app.post("/batch", tags=["batch"])
async def submit_batch(batch: BatchRequest):
    """Submit a batch of segments for generation. Returns a job ID for tracking."""
    voice_path = VOICES_DIR / f"{batch.voice_id}.wav"
    if not voice_path.exists():
        raise HTTPException(404, f"Voice profile '{batch.voice_id}' not found.")

    job_id = str(uuid.uuid4())[:8]
    job = JobInfo(
        job_id=job_id,
        status=JobStatus.queued,
        created_at=datetime.utcnow().isoformat(),
        total_segments=len(batch.segments),
    )
    jobs[job_id] = job

    await job_queue.put((job_id, batch))

    return {
        "job_id": job_id,
        "status": "queued",
        "total_segments": len(batch.segments),
        "message": f"Job queued. Track progress at /jobs/{job_id}",
    }


@app.get("/jobs/{job_id}", tags=["batch"])
async def get_job_status(job_id: str):
    """Check status of a batch job."""
    if job_id not in jobs:
        raise HTTPException(404, f"Job '{job_id}' not found")
    return jobs[job_id]


@app.get("/jobs", tags=["batch"])
async def list_jobs():
    """List all jobs."""
    return {"jobs": list(jobs.values())}


@app.get("/jobs/{job_id}/download/{segment_id}", tags=["batch"])
async def download_segment(job_id: str, segment_id: str):
    """Download a single generated audio segment."""
    if job_id not in jobs:
        raise HTTPException(404, "Job not found")
    job = jobs[job_id]
    if not job.output_dir:
        raise HTTPException(400, "Job has no output yet")

    file_path = Path(job.output_dir) / f"{segment_id}.wav"
    if not file_path.exists():
        raise HTTPException(404, f"Segment '{segment_id}' not found")

    return FileResponse(str(file_path), media_type="audio/wav")


@app.get("/jobs/{job_id}/download-all", tags=["batch"])
async def download_all(job_id: str):
    """Download all generated audio as a zip."""
    if job_id not in jobs:
        raise HTTPException(404, "Job not found")
    job = jobs[job_id]
    if job.status != JobStatus.completed:
        raise HTTPException(400, f"Job status is '{job.status}', not 'completed'")
    if not job.output_dir:
        raise HTTPException(400, "No output directory")

    zip_path = Path(job.output_dir).parent / f"{job_id}.zip"
    if not zip_path.exists():
        shutil.make_archive(str(zip_path.with_suffix("")), "zip", job.output_dir)

    return FileResponse(str(zip_path), media_type="application/zip", filename=f"{job_id}.zip")


# -- Status ------------------------------------------------------------------

@app.get("/status", tags=["status"])
async def server_status():
    """Server health and queue status."""
    gpu_info = {}
    if torch.cuda.is_available():
        gpu_info = {
            "name": torch.cuda.get_device_name(0),
            "memory_total_gb": round(torch.cuda.get_device_properties(0).total_mem / 1e9, 1),
            "memory_used_gb": round(torch.cuda.memory_allocated(0) / 1e9, 1),
        }

    return {
        "status": "running",
        "gpu": gpu_info,
        "queue_size": job_queue.qsize(),
        "total_jobs": len(jobs),
        "active_jobs": sum(1 for j in jobs.values() if j.status == JobStatus.processing),
        "voices_available": len(list(VOICES_DIR.glob("*.wav"))),
        "engines": {
            "chatterbox": True,
            "chatterbox_multilingual": True,
            "qwen3": _qwen3_model is not None and _qwen3_model is not False,
        },
        "supported_languages": {
            "chatterbox_multilingual": sorted(CHATTERBOX_LANGUAGES),
            "qwen3": sorted(QWEN3_TTS_LANGUAGES),
            "unsupported_native": sorted(UNSUPPORTED_NATIVE),
        },
    }


@app.get("/languages", tags=["status"])
async def supported_languages():
    """Show which languages are supported by which engine."""
    all_langs = CHATTERBOX_LANGUAGES | QWEN3_TTS_LANGUAGES
    result = {}
    for lang in sorted(all_langs | UNSUPPORTED_NATIVE):
        engines = []
        if lang in CHATTERBOX_LANGUAGES:
            engines.append("chatterbox_multilingual")
        if lang == "en":
            engines.append("chatterbox")
        if lang in QWEN3_TTS_LANGUAGES:
            engines.append("qwen3")
        best = pick_engine(EngineChoice.auto, lang)
        result[lang] = {
            "engines": engines,
            "auto_picks": best,
            "native_support": lang not in UNSUPPORTED_NATIVE,
        }
    return result
