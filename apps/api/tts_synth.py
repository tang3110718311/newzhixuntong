import sys, os, json, base64
import edge_tts
import edge_tts.communicate as C

# 情绪 -> 韵律参数映射（明显加大对比度，让学员一听就分辨出不同情绪）
# 说明：edge-tts 不支持 express-as 真情感，只能用 pitch/rate/volume 模拟；
# 这里把怒/急/悲/喜/平的差距拉大，增强学员压力感知与情绪辨识度。
EMOTION_PROSODY = {
    "angry":     {"pitch": "+48%", "rate": "+55%", "volume": "+45%"},   # 愤怒：高亢、急促、大声
    "urgent":    {"pitch": "+26%", "rate": "+60%", "volume": "+26%"},  # 急切：语速极快、略高亢
    "anxious":   {"pitch": "+14%", "rate": "+40%", "volume": "+12%"},  # 焦虑：偏快、略高
    "sad":       {"pitch": "-42%", "rate": "-40%", "volume": "-45%"}, # 委屈：低沉、慢、轻声
    "satisfied": {"pitch": "+10%", "rate": "-16%", "volume": "+10%"},   # 满意：放松、略慢
    "cheerful":  {"pitch": "+38%", "rate": "+28%", "volume": "+26%"},  # 开心：明亮、轻快
    "calm":      {"pitch": "-10%", "rate": "-16%", "volume": "-14%"},  # 平静：稳重
    "serious":   {"pitch": "-18%", "rate": "-18%", "volume": "+16%"},   # 严肃：低沉、有力
    "polite":    {"pitch": "-6%",  "rate": "-12%", "volume": "-8%"},    # 客气：温和
    "default":   {"pitch": "+0Hz", "rate": "+0%",  "volume": "+0%"},
}

# 更沉稳的嗓音：男声用云扬（沉稳大气，所有情绪参数下合成稳定 3/3）
# 女声用晓依（较晓晓低沉稳重）
# 注：云希(Yunxi)虽更口语化，但实测平静/开心情绪下合成失败率极高(0/3)，会听不到语音，故不用
DEFAULT_VOICE_FEMALE = "zh-CN-XiaoyiNeural"
DEFAULT_VOICE_MALE = "zh-CN-YunyangNeural"

_orig = C.mkssml
def patched(tc, escaped_text):
    if isinstance(escaped_text, bytes):
        escaped_text = escaped_text.decode("utf-8")
    pitch = getattr(tc, "pitch", "+0Hz") or "+0Hz"
    rate = getattr(tc, "rate", "+0%") or "+0%"
    volume = getattr(tc, "volume", "+0%") or "+0%"
    # 注意：escaped_text 已被 edge-tts XML 转义，不能再插入 <break> 等标签（会破坏 SSML 导致合成失败）。
    # 停顿节奏依赖 AI 回复自身的自然标点（edge-tts 对中文逗号/句号/感叹号有原生停顿）。
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
