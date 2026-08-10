#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
sherpa_tts_service.py - Lightweight TTS service using sherpa-onnx

主引擎：vits-icefall-zh-aishell3（多说话人，175 个音色，含男女声，CPU 推理极快）
兜底：   vits-melo-tts-zh_en（单女声，自然度更高）

API: POST /synthesize  body: {"text", "voice", "emotion"}
Response: {"ok": true, "audioBase64": "...", "format": "wav", "sampleRate": 22050}

Environment variables:
  SHERPA_TTS_PORT       - Port to listen on (default 8180)
  SHERPA_TTS_HOST       - Host to bind (default 127.0.0.1)
  SHERPA_TTS_MODEL_DIR  - aishell3 model dir (default storage/models/vits-icefall-zh-aishell3)
  SHERPA_TTS_MELO_DIR   - melo model dir (default storage/models/vits-melo-tts-zh_en)
  SHERPA_TTS_THREADS    - Number of threads (default 8)
  SHERPA_TTS_SPEED_SCALE- Global speed scale, <1 slower (default 0.85)
"""

import base64
import io
import json
import logging
import os
import struct
import threading
import wave
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import numpy as np
import sherpa_onnx

# ── Configuration ──────────────────────────────────────────────────────────
ROOT_DIR = Path(__file__).resolve().parents[2]
MODEL_DIR = Path(
    os.environ.get("SHERPA_TTS_MODEL_DIR")
    or str(ROOT_DIR / "storage" / "models" / "vits-icefall-zh-aishell3")
)
MELO_DIR = Path(
    os.environ.get("SHERPA_TTS_MELO_DIR")
    or str(ROOT_DIR / "storage" / "models" / "vits-melo-tts-zh_en")
)
PORT = int(os.environ.get("SHERPA_TTS_PORT") or "8180")
HOST = os.environ.get("SHERPA_TTS_HOST") or "127.0.0.1"
NUM_THREADS = int(os.environ.get("SHERPA_TTS_THREADS") or "8")
# 统一输出采样率，便于前端 <audio> 稳定播放
OUTPUT_RATE = 22050
MAX_TEXT_CHARS = 2000
LOG_FILE = Path(ROOT_DIR / ".logs" / "sherpa-tts-service.log")

# Global speed scale (MeloTTS 1.0 体感偏快，整体下调让语音更自然)
# 可通过 SHERPA_TTS_SPEED_SCALE 环境变量覆盖（0.7~1.0 之间为宜）
SPEED_SCALE = float(os.environ.get("SHERPA_TTS_SPEED_SCALE") or "0.85")

# Emotion -> relative speed. Final speed = EMOTION_SPEED * SPEED_SCALE
EMOTION_SPEED = {
    "angry":    1.35,   # Fast + forceful
    "urgent":   1.50,   # Very fast
    "anxious":  1.20,   # Slightly fast
    "sad":      0.75,   # Slow, drawn out
    "satisfied": 0.90,  # Relaxed
    "cheerful": 1.15,   # Bright, slightly fast
    "calm":     0.85,   # Steady, measured
    "serious":  0.90,   # Deliberate
    "polite":   0.92,   # Gentle
    "default":  1.00,
}

# Voice name -> (model tag, speaker id)
# AISHELL3 前段为男性、后段为女性（sid 即 speakers.txt 顺序，0-based）
# 这里挑选若干自然度较好的男女声，男女各分配两类"性格"供场景随机
VOICE_MAP = {
    # 男声
    "sherpa-male-0": ("aishell3", 0),
    "sherpa-male-1": ("aishell3", 1),
    "sherpa-male-2": ("aishell3", 3),
    # 女声
    "sherpa-female-0": ("aishell3", 55),
    "sherpa-female-1": ("aishell3", 80),
    "sherpa-female-2": ("aishell3", 120),
    # 兜底单女声（melo）
    "sherpa-female-melo": ("melo", 0),
}
# 默认随机池（男女各若干）
DEFAULT_VOICES = [
    "sherpa-male-0", "sherpa-male-1",
    "sherpa-female-0", "sherpa-female-1", "sherpa-female-2",
]

# Audio cache: (text, voice, emotion) -> (audioBase64, format)
MAX_CACHE_ITEMS = 64
audio_cache: OrderedDict[Tuple[str, str, str], Tuple[str, str]] = OrderedDict()
cache_lock = threading.Lock()
cache_hits = 0
cache_misses = 0

# ── Logging ───────────────────────────────────────────────────────────────
LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
logging.basicConfig(
    level=os.environ.get("SHERPA_TTS_LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler(str(LOG_FILE), encoding="utf-8")],
)


# ── Load Models ──────────────────────────────────────────────────────────
models: Dict[str, Any] = {}
loaded_engines: list[str] = []
load_errors: Dict[str, str] = {}


def _build_tts(model_dir: Path) -> Optional[Any]:
    model_path = str(model_dir / "model.onnx")
    lexicon_path = str(model_dir / "lexicon.txt")
    tokens_path = str(model_dir / "tokens.txt")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found: {model_path}")
    vits = sherpa_onnx.OfflineTtsVitsModelConfig(
        model=model_path, lexicon=lexicon_path, tokens=tokens_path,
    )
    cfg = sherpa_onnx.OfflineTtsModelConfig(vits=vits, num_threads=NUM_THREADS)
    return sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=cfg))


def load_models() -> None:
    for tag, d in (("aishell3", MODEL_DIR), ("melo", MELO_DIR)):
        try:
            models[tag] = _build_tts(Path(d))
            loaded_engines.append(tag)
            logging.info("Loaded TTS engine '%s' from %s", tag, d)
        except Exception as e:
            load_errors[tag] = str(e)
            logging.error("Failed to load '%s': %s", tag, e)


def load_model() -> None:
    # 兼容旧调用名
    load_models()


def _resample(samples: np.ndarray, src_rate: int, dst_rate: int) -> np.ndarray:
    if src_rate == dst_rate:
        return samples
    n = int(round(len(samples) * dst_rate / src_rate))
    x = np.arange(len(samples))
    xq = np.linspace(0, len(samples) - 1, n)
    return np.interp(xq, x, samples).astype(samples.dtype)


def synthesize(text: str, voice: str = "default", emotion: str = "default") -> Dict[str, Any]:
    global cache_hits, cache_misses

    if not loaded_engines:
        return {"ok": False, "error": "No TTS engine loaded: " + str(load_errors)}

    if len(text) > MAX_TEXT_CHARS:
        text = text[:MAX_TEXT_CHARS]

    # 解析 voice -> (model tag, sid)
    if voice in (None, "", "default") or voice not in VOICE_MAP:
        # 随机选一个默认声音，整次调用固定
        import random
        voice = random.choice(DEFAULT_VOICES)
    model_tag, sid = VOICE_MAP[voice]

    # 缓存键包含 voice
    cache_key = (text, voice, emotion)
    with cache_lock:
        if cache_key in audio_cache:
            audio_cache.move_to_end(cache_key)
            cache_hits += 1
            b64, fmt = audio_cache[cache_key]
            return {"ok": True, "audioBase64": b64, "format": fmt,
                    "sampleRate": OUTPUT_RATE, "voice": voice, "cached": True}

    engine = models.get(model_tag)
    if engine is None:
        # 降级到任意已加载引擎
        model_tag = loaded_engines[0]
        engine = models[model_tag]
        sid = 0

    speed = round(EMOTION_SPEED.get(emotion, 1.0) * SPEED_SCALE, 3)
    audio = engine.generate(text, sid=sid, speed=speed)
    samples = np.asarray(audio.samples, dtype=np.float32)
    src_rate = int(audio.sample_rate)
    if src_rate != OUTPUT_RATE:
        samples = _resample(samples, src_rate, OUTPUT_RATE)

    raw = struct.pack(
        f'<{len(samples)}h',
        *[max(-32768, min(32767, int(s * 32767))) for s in samples]
    )
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(OUTPUT_RATE)
        wf.writeframes(raw)
    wav_bytes = buf.getvalue()
    b64 = base64.b64encode(wav_bytes).decode("ascii")

    with cache_lock:
        audio_cache[cache_key] = (b64, "wav")
        audio_cache.move_to_end(cache_key)
        while len(audio_cache) > MAX_CACHE_ITEMS:
            audio_cache.popitem(last=False)
        cache_misses += 1

    return {"ok": True, "audioBase64": b64, "format": "wav",
            "sampleRate": OUTPUT_RATE, "voice": voice, "cached": False}


# ── HTTP Handler ──────────────────────────────────────────────────────────
class TtsHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/synthesize":
            self._handle_synthesize()
        elif self.path == "/health":
            self._handle_health()
        else:
            self._send_json(404, {"ok": False, "error": "Not found"})

    def do_GET(self):
        if self.path == "/health":
            self._handle_health()
        else:
            self._send_json(404, {"ok": False, "error": "Not found"})

    def _handle_synthesize(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body) if body else {}

            text = data.get("text", "").strip()
            voice = data.get("voice", "default")
            emotion = data.get("emotion", "default")

            if not text:
                self._send_json(400, {"ok": False, "error": "text is required"})
                return

            result = synthesize(text, voice, emotion)
            status = 200 if result.get("ok") else 502
            self._send_json(status, result)

        except Exception as e:
            logging.error("Error in /synthesize: %s", e)
            self._send_json(500, {"ok": False, "error": str(e)[:300]})

    def _handle_health(self):
        self._send_json(200, {
            "ok": bool(loaded_engines),
            "engine": "sherpa-onnx-tts",
            "loaded_engines": loaded_engines,
            "load_errors": load_errors,
            "model_dir": str(MODEL_DIR),
            "sample_rate": OUTPUT_RATE,
            "voices": list(VOICE_MAP.keys()),
            "cache_hits": cache_hits,
            "cache_misses": cache_misses,
            "cache_size": len(audio_cache),
        })

    def _send_json(self, status: int, obj: dict):
        payload = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, fmt, *args):
        logging.info("HTTP %s", fmt % args if args else fmt)


# ── Main ──────────────────────────────────────────────────────────────────
def main():
    load_models()
    if not loaded_engines:
        logging.error("Cannot start service: no model loaded")
    server = ThreadingHTTPServer((HOST, PORT), TtsHandler)
    logging.info("sherpa-onnx TTS service listening on %s:%d", HOST, PORT)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logging.info("Shutting down...")
        server.shutdown()


if __name__ == "__main__":
    main()
