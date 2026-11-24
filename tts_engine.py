#!/usr/bin/env python3
"""
ZOZ ROUTER — Neural Read Aloud Engine (edge-tts Streaming)
Mengalirkan audio MP3 (audio/mpeg) langsung dari Microsoft Edge Neural TTS
tanpa menyimpan file permanen di server.

Mendukung dua mode:
1. Streaming CLI Bridge (dipakai otomatis oleh server.js pada port 4040):
   echo '{"text":"Halo dunia","voice":"id-ID-GadisNeural","rate":"+0%"}' | python -u tts_engine.py --stream
2. Mode Standalone FastAPI (opsional):
   uvicorn tts_engine:app --host 127.0.0.1 --port 8000
"""

import asyncio
import json
import re
import sys
from typing import AsyncIterator, Dict, Optional

ALLOWED_VOICES: Dict[str, Dict[str, str]] = {
    "id-ID-GadisNeural": {
        "id": "id-ID-GadisNeural",
        "label": "Gadis (Indonesia — Perempuan Natural)",
        "shortLabel": "Gadis",
        "lang": "id-ID",
        "gender": "Female",
    },
    "id-ID-ArdiNeural": {
        "id": "id-ID-ArdiNeural",
        "label": "Ardi (Indonesia — Laki-laki Natural)",
        "shortLabel": "Ardi",
        "lang": "id-ID",
        "gender": "Male",
    },
    "en-US-AriaNeural": {
        "id": "en-US-AriaNeural",
        "label": "Aria (English — Female Natural)",
        "shortLabel": "Aria",
        "lang": "en-US",
        "gender": "Female",
    },
    "en-US-GuyNeural": {
        "id": "en-US-GuyNeural",
        "label": "Guy (English — Male Natural)",
        "shortLabel": "Guy",
        "lang": "en-US",
        "gender": "Male",
    },
}

DEFAULT_VOICE = "id-ID-GadisNeural"
MAX_TEXT_CHARS = 6000
RATE_RE = re.compile(r"^[+-](?:[0-4]?\d|50)%$")

# Emoji & symbol pictographs range (prevent awkward verbalization of emojis)
EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001F5FF"
    "\U0001F600-\U0001F64F"
    "\U0001F680-\U0001F6FF"
    "\U0001F700-\U0001F77F"
    "\U0001F780-\U0001F7FF"
    "\U0001F800-\U0001F8FF"
    "\U0001F900-\U0001F9FF"
    "\U0001FA00-\U0001FAFF"
    "\U00002600-\U000027BF"
    "\U0000FE0F"
    "\U0000200D"
    "]+",
    flags=re.UNICODE,
)


def normalize_voice(voice: Optional[str]) -> str:
    candidate = (voice or "").strip()
    return candidate if candidate in ALLOWED_VOICES else DEFAULT_VOICE


def normalize_rate(rate: Optional[str]) -> str:
    candidate = (rate or "+0%").strip()
    if RATE_RE.match(candidate):
        val = int(candidate[:-1])
        val = max(-25, min(50, val))
        return f"+{val}%" if val >= 0 else f"{val}%"
    return "+0%"


def clean_text_for_speech(raw_text: str) -> str:
    """
    Membersihkan teks jawaban AI dari Markdown, blok kode, token internal ZOZ,
    URL mentah, sitasi, simbol LaTeX, dan emoji agar enak didengarkan secara natural.
    """
    if not raw_text or not isinstance(raw_text, str):
        return ""

    text = raw_text.replace("\r\n", "\n").replace("\r", "\n")

    # 1. Hapus blok protokol berkas ZOZ & tag internal tool/thinking
    text = re.sub(
        r"<<<ZOZ_(?:FILE|EDIT|MODIFY|TASKS)[\s\S]*?(?:<<<END_ZOZ_(?:FILE|EDIT|MODIFY|TASKS)[^\n>]*>?|$)",
        " ",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(
        r"<(?:think|thinking|reasoning|thought|tool_call|function_call)>[\s\S]*?</(?:think|thinking|reasoning|thought|tool_call|function_call)>",
        " ",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(r"\[\[ZOZ_(?:IMAGE|WEATHER)_DISPLAY:[^\]]+\]\]", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\[System Note:[^\]]*\]", " ", text, flags=re.IGNORECASE)

    # 2. Hapus blok kode berpagar ```...``` agar suara tidak membacakan sintaks kode mentah
    text = re.sub(r"```[\s\S]*?```", " ", text)
    text = re.sub(r"~~~[\s\S]*?~~~", " ", text)

    # 3. Hapus gambar Markdown ![alt](url), ubah link [label](url) -> label
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", text)
    text = re.sub(r"\[([^\]]+)\]\((?:https?://|/|#)[^)]*\)", r"\1", text)

    # 4. Hapus URL mentah http(s)://... dan sitasi numerik [1], [2, 3]
    text = re.sub(r"https?://[^\s)\]>\"']+", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\[\s*\d+(?:\s*[,–-]\s*\d+)*\s*\]", "", text)

    # 5. Rapikan rumus LaTeX $$...$$ dan $...$ agar simbol backslash tidak dibaca mentah
    def _clean_latex(match: re.Match) -> str:
        expr = match.group(1) or ""
        expr = re.sub(r"\\text\{([^}]*)\}", r" \1 ", expr)
        expr = re.sub(r"\\mathrm\{([^}]*)\}", r" \1 ", expr)
        expr = re.sub(r"\\frac\{([^}]*)\}\{([^}]*)\}", r" \1 per \2 ", expr)
        expr = re.sub(r"\\sqrt\{([^}]*)\}", r" akar \1 ", expr)
        expr = expr.replace(r"\times", " kali ").replace(r"\cdot", " kali ")
        expr = expr.replace(r"\approx", " sekitar ").replace(r"\le", " kurang dari sama dengan ").replace(r"\ge", " lebih dari sama dengan ")
        expr = re.sub(r"\\[a-zA-Z]+", " ", expr)
        expr = re.sub(r"[{}^_]", " ", expr)
        return f" {expr} "

    text = re.sub(r"\$\$([\s\S]*?)\$\$", _clean_latex, text)
    text = re.sub(r"\$([^$\n]{1,180})\$", _clean_latex, text)

    # 6. Inline code `...` -> pertahankan isi teks tanpa tanda backtick
    text = re.sub(r"`([^`\n]+)`", r"\1", text)

    # 7. Bersihkan garis pemisah tabel Markdown |---|---| dan pipa tabel |
    text = re.sub(r"^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{0,}:?\s*\|?\s*$", " ", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*[-*_]{3,}\s*$", " ", text, flags=re.MULTILINE)
    text = re.sub(r"\|", ", ", text)

    # 8. Hapus penanda heading (#), blockquote (>), bullet (- / * / •)
    text = re.sub(r"^\s{0,3}#{1,6}\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*>\s?", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*[-*•◦▪]\s+", "", text, flags=re.MULTILINE)

    # 9. Hapus pembungkus tebal/miring/coret (**, __, *, _, ~~) dan tag HTML sisa
    text = re.sub(r"(\*\*|__)(.*?)\1", r"\2", text)
    text = re.sub(r"~~(.*?)~~", r"\1", text)
    text = re.sub(r"(?<!\w)[*_]([^*\n_]+)[*_](?!\w)", r"\1", text)
    text = re.sub(r"[*_~#`]+", "", text)
    text = re.sub(r"<[^>]+>", " ", text)

    # 10. Hapus emoji piktografik
    text = EMOJI_RE.sub(" ", text)

    # 11. Normalisasi jeda baris menjadi tanda baca alami dan rapikan spasi berlebih
    lines = [re.sub(r"\s+", " ", ln).strip() for ln in text.split("\n")]
    clean_lines = []
    for ln in lines:
        if not ln:
            continue
        if ln[-1] not in ".!?,;:":
            ln += "."
        clean_lines.append(ln)

    cleaned = " ".join(clean_lines)
    cleaned = re.sub(r"\s+([.,!?;:])", r"\1", cleaned)
    cleaned = re.sub(r"([.,!?;:])\1+", r"\1", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()

    if len(cleaned) > MAX_TEXT_CHARS:
        cleaned = cleaned[:MAX_TEXT_CHARS].rsplit(" ", 1)[0].strip()

    return cleaned


async def generate_audio_stream(text: str, voice: str = DEFAULT_VOICE, rate: str = "+0%") -> AsyncIterator[bytes]:
    import edge_tts

    safe_voice = normalize_voice(voice)
    safe_rate = normalize_rate(rate)
    cleaned = clean_text_for_speech(text)
    if not cleaned:
        return

    communicate = edge_tts.Communicate(cleaned, voice=safe_voice, rate=safe_rate)
    async for chunk in communicate.stream():
        if chunk.get("type") == "audio" and chunk.get("data"):
            yield chunk["data"]


async def stream_tts_to_stdout(text: str, voice: str = DEFAULT_VOICE, rate: str = "+0%") -> int:
    cleaned = clean_text_for_speech(text)
    if not cleaned:
        sys.stderr.write("EMPTY_CLEAN_TEXT\n")
        return 2

    out = sys.stdout.buffer
    emitted = 0
    async for audio_bytes in generate_audio_stream(cleaned, voice=voice, rate=rate):
        out.write(audio_bytes)
        out.flush()
        emitted += len(audio_bytes)

    if emitted == 0:
        sys.stderr.write("NO_AUDIO_EMITTED\n")
        return 3
    return 0


def create_fastapi_app():
    """Factory opsional bila pengguna ingin menjalankan microservice FastAPI /tts mandiri."""
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import StreamingResponse
    from pydantic import BaseModel

    class TTSRequest(BaseModel):
        text: str
        voice: str = DEFAULT_VOICE
        rate: str = "+0%"

    api = FastAPI(title="ZOZ Router Read Aloud TTS API")
    api.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @api.get("/tts/voices")
    async def list_voices():
        return {"voices": list(ALLOWED_VOICES.values()), "default": DEFAULT_VOICE}

    @api.post("/tts")
    async def tts_endpoint(payload: TTSRequest):
        cleaned = clean_text_for_speech(payload.text)
        if not cleaned:
            raise HTTPException(status_code=400, detail="Teks kosong setelah dibersihkan dari Markdown.")
        safe_voice = normalize_voice(payload.voice)
        safe_rate = normalize_rate(payload.rate)
        return StreamingResponse(
            generate_audio_stream(cleaned, voice=safe_voice, rate=safe_rate),
            media_type="audio/mpeg",
            headers={
                "Cache-Control": "no-store",
                "X-TTS-Voice": safe_voice,
                "X-TTS-Engine": "edge-tts",
            },
        )

    return api


def _run_cli_stream() -> int:
    raw_stdin = sys.stdin.buffer.read().decode("utf-8", errors="replace").strip()
    if not raw_stdin:
        sys.stderr.write("EMPTY_STDIN\n")
        return 2
    try:
        payload = json.loads(raw_stdin)
    except Exception as exc:
        sys.stderr.write(f"INVALID_JSON: {exc}\n")
        return 2

    text = str(payload.get("text") or "")
    voice = normalize_voice(payload.get("voice"))
    rate = normalize_rate(payload.get("rate"))

    try:
        return asyncio.run(stream_tts_to_stdout(text, voice=voice, rate=rate))
    except BrokenPipeError:
        return 0
    except Exception as exc:
        sys.stderr.write(f"TTS_STREAM_ERROR: {exc}\n")
        return 1


if __name__ == "__main__":
    if "--stream" in sys.argv:
        sys.exit(_run_cli_stream())
    elif "--clean" in sys.argv:
        raw = sys.stdin.buffer.read().decode("utf-8", errors="replace")
        sys.stdout.buffer.write(clean_text_for_speech(raw).encode("utf-8"))
        sys.exit(0)
    else:
        print(json.dumps({"voices": list(ALLOWED_VOICES.values()), "default": DEFAULT_VOICE}, ensure_ascii=False))
