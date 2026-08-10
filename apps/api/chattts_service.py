import base64
import io
import json
import logging
import os
import re
import threading
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Tuple

import numpy as np
import soundfile as sf
import torch

try:
    import ChatTTS
except Exception as exc:  # pragma: no cover - surfaced by /health
    ChatTTS = None
    IMPORT_ERROR = exc
else:
    IMPORT_ERROR = None


ROOT_DIR = Path(__file__).resolve().parents[2]
MODEL_DIR = Path(
    os.environ.get("CHAT_TTS_MODEL_DIR")
    or os.environ.get("CHATTS_MODEL_DIR")
    or ROOT_DIR / "storage" / "models" / "chattts"
)
PORT = int(os.environ.get("CHAT_TTS_PORT") or os.environ.get("CHATTS_PORT") or "8179")
HOST = os.environ.get("CHAT_TTS_HOST") or "127.0.0.1"
SAMPLE_RATE = 24000
MAX_TEXT_CHARS = 1200
LOG_FILE = Path(os.environ.get("CHAT_TTS_LOG_FILE") or ROOT_DIR / ".logs" / "chattts-service.log")
MAX_CACHE_ITEMS = int(os.environ.get("CHAT_TTS_CACHE_ITEMS") or "32")

VOICE_SEEDS = {
    "chattts-female-306": 306,
    "chattts-female-418": 418,
    "chattts-male-873": 873,
    "chattts-male-952": 952,
}

EMOTION_CODE_PROMPTS = {
    "angry": "[speed_8]",
    "urgent": "[speed_8]",
    "anxious": "[speed_7]",
    "sad": "[speed_3]",
    "satisfied": "[speed_4]",
    "cheerful": "[speed_6]",
    "calm": "[speed_4]",
    "serious": "[speed_4]",
    "polite": "[speed_4]",
    "default": "[speed_5]",
}

EMOTION_REFINE_PROMPTS = {
    "angry": "[oral_7][laugh_0][break_4]",
    "urgent": "[oral_7][laugh_0][break_3]",
    "anxious": "[oral_6][laugh_0][break_4]",
    "sad": "[oral_2][laugh_0][break_7]",
    "satisfied": "[oral_3][laugh_1][break_6]",
    "cheerful": "[oral_5][laugh_2][break_4]",
    "calm": "[oral_2][laugh_0][break_6]",
    "serious": "[oral_2][laugh_0][break_5]",
    "polite": "[oral_3][laugh_0][break_6]",
    "default": "[oral_3][laugh_0][break_5]",
}

LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
logging.basicConfig(
    level=os.environ.get("CHAT_TTS_LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler(LOG_FILE, encoding="utf-8")],
)

chat = None
loaded = False
load_error = ""
speaker_cache: Dict[int, str] = {}
audio_cache: OrderedDict[Tuple[str, str, int], Tuple[str, str]] = OrderedDict()
synth_lock = threading.Lock()
cache_lock = threading.Lock()
cache_hits = 0
cache_misses = 0


def load_model() -> None:
    global chat, loaded, load_error
    if ChatTTS is None:
        load_error = f"ChatTTS import failed: {IMPORT_ERROR}"
        logging.error(load_error)
        return

    logging.info("Loading ChatTTS model from %s", MODEL_DIR)
    chat = ChatTTS.Chat()
    try:
        loaded = bool(
            chat.load(
                source="custom",
                custom_path=str(MODEL_DIR),
                compile=False,
                device=torch.device("cpu"),
            )
        )
    except Exception as exc:
        loaded = False
        load_error = str(exc)
        logging.exception("ChatTTS load failed")
    else:
        load_error = "" if loaded else "chat.load returned False"
        logging.info("ChatTTS loaded=%s", loaded)


def parse_voice_seed(voice: str) -> int:
    if voice in VOICE_SEEDS:
        return VOICE_SEEDS[voice]
    match = re.search(r"(\d{2,8})", voice or "")
    if match:
        return int(match.group(1))
    lowered = (voice or "").lower()
    if "male" in lowered and "female" not in lowered:
        return VOICE_SEEDS["chattts-male-873"]
    return VOICE_SEEDS["chattts-female-306"]


def get_speaker(seed: int) -> str:
    assert chat is not None
    if seed not in speaker_cache:
        with torch.random.fork_rng(devices=[]):
            torch.manual_seed(seed)
            speaker_cache[seed] = chat.sample_random_speaker()
    return speaker_cache[seed]


def synthesize(text: str, emotion: str, voice: str) -> Tuple[str, str, bool]:
    global cache_hits, cache_misses
    if not loaded or chat is None:
        raise RuntimeError(load_error or "ChatTTS model is not loaded")

    clean_text = " ".join((text or "").split())[:MAX_TEXT_CHARS]
    if not clean_text:
        raise ValueError("empty text")

    emotion = emotion if emotion in EMOTION_CODE_PROMPTS else "default"
    seed = parse_voice_seed(voice)
    cache_key = (clean_text, emotion, seed)

    with cache_lock:
        cached = audio_cache.get(cache_key)
        if cached is not None:
            audio_cache.move_to_end(cache_key)
            cache_hits += 1
            return cached[0], cached[1], True
        cache_misses += 1

    speaker = get_speaker(seed)

    params_refine = ChatTTS.Chat.RefineTextParams(
        prompt=EMOTION_REFINE_PROMPTS[emotion],
        temperature=0.75 if emotion in {"angry", "urgent", "anxious"} else 0.65,
        top_P=0.7,
        top_K=20,
        manual_seed=seed,
        show_tqdm=False,
    )
    params_code = ChatTTS.Chat.InferCodeParams(
        spk_emb=speaker,
        prompt=EMOTION_CODE_PROMPTS[emotion],
        temperature=0.35,
        repetition_penalty=1.05,
        manual_seed=seed,
        show_tqdm=False,
    )

    with synth_lock:
        wavs = chat.infer(
            clean_text,
            skip_refine_text=False,
            params_refine_text=params_refine,
            params_infer_code=params_code,
        )

    if not wavs:
        raise RuntimeError("ChatTTS returned empty wav")

    wav = np.asarray(wavs[0], dtype=np.float32)
    if wav.ndim > 1:
        wav = wav.reshape(-1)

    buf = io.BytesIO()
    sf.write(buf, wav, SAMPLE_RATE, format="WAV")
    audio_base64 = base64.b64encode(buf.getvalue()).decode("ascii")
    with cache_lock:
        audio_cache[cache_key] = (audio_base64, "wav")
        audio_cache.move_to_end(cache_key)
        while len(audio_cache) > MAX_CACHE_ITEMS:
            audio_cache.popitem(last=False)
    return audio_base64, "wav", False


def json_response(handler: BaseHTTPRequestHandler, status: int, body: Dict[str, Any]) -> None:
    raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(raw)))
    handler.end_headers()
    handler.wfile.write(raw)


class Handler(BaseHTTPRequestHandler):
    server_version = "ZxtChatTTS/1.0"

    def do_GET(self) -> None:
        if self.path.rstrip("/") == "/health":
            json_response(self, 200, {
                "ok": True,
                "hasLoaded": loaded,
                "modelDir": str(MODEL_DIR),
                "error": load_error,
                "cacheSize": len(audio_cache),
                "cacheLimit": MAX_CACHE_ITEMS,
                "cacheHits": cache_hits,
                "cacheMisses": cache_misses,
            })
            return
        json_response(self, 404, {"ok": False, "error": "not found"})

    def do_POST(self) -> None:
        if self.path.rstrip("/") != "/synthesize":
            json_response(self, 404, {"ok": False, "error": "not found"})
            return
        try:
            content_length = int(self.headers.get("Content-Length") or "0")
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            audio_base64, fmt, cached = synthesize(
                text=str(payload.get("text") or ""),
                emotion=str(payload.get("emotion") or "default"),
                voice=str(payload.get("voice") or "chattts-female-306"),
            )
            json_response(self, 200, {
                "ok": True,
                "audioBase64": audio_base64,
                "format": fmt,
                "engine": "chattts",
                "cached": cached,
            })
        except Exception as exc:
            logging.exception("ChatTTS synthesize failed")
            json_response(self, 502, {"ok": False, "error": str(exc)[:500]})

    def log_message(self, fmt: str, *args: Any) -> None:
        logging.info("%s - %s", self.address_string(), fmt % args)


def main() -> int:
    load_model()
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    logging.info("ChatTTS service listening on http://%s:%s", HOST, PORT)
    httpd.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
