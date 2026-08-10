import sys, os, json, base64
import edge_tts
import edge_tts.communicate as C

# 情绪 -> 韵律参数映射（继续增强对比度，让学员感受真实压力）
EMOTION_PROSODY = {
    "angry":     {"pitch": "+38%", "rate": "+42%", "volume": "+35%"},   # 愤怒：高亢、急促、大声
    "urgent":    {"pitch": "+18%", "rate": "+50%", "volume": "+18%"},  # 急切：语速极快、略高亢
    "anxious":   {"pitch": "+10%", "rate": "+32%", "volume": "+8%"},   # 焦虑：偏快、略高
    "sad":       {"pitch": "-32%", "rate": "-32%", "volume": "-38%"}, # 委屈：低沉、慢、轻声
    "satisfied": {"pitch": "+6%",  "rate": "-12%", "volume": "+6%"},   # 满意：放松、略慢
    "cheerful":  {"pitch": "+26%", "rate": "+20%", "volume": "+18%"},  # 开心：明亮、轻快
    "calm":      {"pitch": "-8%",  "rate": "-12%", "volume": "-12%"},  # 平静：稳重
    "serious":   {"pitch": "-14%", "rate": "-14%", "volume": "+12%"},  # 严肃：低沉、有力
    "polite":    {"pitch": "-4%",  "rate": "-10%", "volume": "-6%"},   # 客气：温和
    "default":   {"pitch": "+0Hz", "rate": "+0%",  "volume": "+0%"},
}

# 更沉稳的嗓音：女声用晓依（较晓晓低沉稳重），男声用云扬（沉稳大气）
DEFAULT_VOICE_FEMALE = "zh-CN-XiaoyiNeural"
DEFAULT_VOICE_MALE = "zh-CN-YunyangNeural"

_orig = C.mkssml
def patched(tc, escaped_text):
    if isinstance(escaped_text, bytes):
        escaped_text = escaped_text.decode("utf-8")
    pitch = getattr(tc, "pitch", "+0Hz") or "+0Hz"
    rate = getattr(tc, "rate", "+0%") or "+0%"
    volume = getattr(tc, "volume", "+0%") or "+0%"
    return ("<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' "
            "xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='zh-CN'>"
            f"<voice name='{tc.voice}'>"
            f"<prosody pitch='{pitch}' rate='{rate}' volume='{volume}'>{escaped_text}</prosody>"
            "</voice></speak>")
C.mkssml = patched

class EC(edge_tts.Communicate):
    def __init__(self, text="", voice=DEFAULT_VOICE_FEMALE, pitch="+0Hz", rate="+0%", volume="+0%", **kw):
        super().__init__(text=text, voice=voice, **kw)
        self.tts_config.pitch = pitch
        self.tts_config.rate = rate
        self.tts_config.volume = volume

async def synth(text, voice, emotion, out_path):
    p = EMOTION_PROSODY.get(emotion, EMOTION_PROSODY["default"])
    c = EC(text=text, voice=voice, pitch=p["pitch"], rate=p["rate"], volume=p["volume"])
    await c.save(out_path)

def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else "{}"
    if arg.endswith(".json") and os.path.exists(arg):
        with open(arg, "r", encoding="utf-8") as f:
            raw = f.read()
    else:
        raw = arg
    payload = json.loads(raw)
    text = payload.get("text", "")
    voice = payload.get("voice", DEFAULT_VOICE_FEMALE)
    emotion = payload.get("emotion", "default")
    out_path = payload.get("out")

    if not out_path:
        out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tts_out.mp3")

    try:
        import asyncio
        asyncio.run(synth(text, voice, emotion, out_path))
        if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
            with open(out_path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("ascii")
            os.remove(out_path)
            print(json.dumps({"ok": True, "audioBase64": b64, "format": "mp3"}))
        else:
            print(json.dumps({"ok": False, "error": "empty audio"}))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)[:300]}))

if __name__ == "__main__":
    main()
