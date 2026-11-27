#!/usr/bin/env python3
"""
ZOZ ROUTER — Hybrid Bilingual Auto-Language STT Engine (Web Speech / Audio Bridge)
Menerima audio rekaman mikrofon (WebM/OGG/WAV/MP4/MP3), menormalisasi ke WAV PCM
16 kHz mono via FFmpeg, lalu menjalankan pengenalan ucapan paralel (en-US & id-ID)
dan memilih hasil berakurasi serta koherensi bahasa tertinggi secara otomatis.

Komunikasi via STDIN JSON -> STDOUT JSON agar bebas injeksi argumen shell.
"""

from __future__ import annotations

import concurrent.futures
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from typing import Any, Dict, List, Optional, Tuple

import speech_recognition as sr

ID_FUNCTION_WORDS = {
    "yang", "untuk", "dengan", "adalah", "dari", "ini", "itu", "saya", "aku",
    "kamu", "anda", "kita", "kami", "tolong", "buatkan", "buat", "jelaskan",
    "bagaimana", "gimana", "kenapa", "mengapa", "apa", "apakah", "bisa", "dapat",
    "ada", "tidak", "nggak", "gak", "bukan", "atau", "dan", "serta", "akan",
    "sudah", "udah", "telah", "belum", "sedang", "lagi", "jangan", "secara",
    "lengkap", "tentang", "pada", "di", "ke", "oleh", "karena", "karna",
    "supaya", "agar", "kalau", "jika", "bila", "halaman", "berkas", "suara",
    "bahasa", "fitur", "tombol", "warna", "tampilan", "bisnis", "kopi",
    "tambahkan", "hapus", "ubah", "perbaiki", "cek", "cari", "buka", "simpan",
}

EN_FUNCTION_WORDS = {
    "the", "a", "an", "for", "of", "to", "in", "on", "at", "by", "with",
    "from", "into", "about", "between", "through", "and", "or", "but", "is",
    "are", "was", "were", "be", "been", "being", "have", "has", "had", "do",
    "does", "did", "will", "would", "could", "should", "can", "may", "might",
    "this", "that", "these", "those", "what", "which", "how", "why", "when",
    "where", "who", "my", "your", "our", "please", "create", "make", "build",
    "write", "explain", "calculate", "give", "show", "find", "list", "use",
    "using", "formula", "formulas", "mechanism", "mechanisms", "tension",
    "force", "physics", "equation", "function", "code", "script", "system",
    "design", "model", "data", "test", "error", "fix", "website", "page",
    "check", "open", "search", "english",
}

# Kata serapan/salah-dengar khas decoder id-ID saat mendengar ucapan Inggris murni
ID_FALSE_ENGLISH_ARTIFACTS = {
    "handphone", "henpon", "manajemen", "magnesium", "mekanis", "polisi",
    "bintang", "cahaya", "kuatkan", "ketik",
}

EN_FALSE_ID_CALQUES = {
    "how long", "what can", "to long", "turn on", "my love",
}


def tokenize_words(text: str) -> List[str]:
    return [w.lower() for w in re.findall(r"[A-Za-zÀ-ÿ0-9']+", text or "") if w]


def format_transcript_text(raw: str) -> str:
    text = re.sub(r"\s+", " ", str(raw or "")).strip()
    if not text:
        return ""
    text = (
        re.sub(r"\s+([,?!;])", r"\1", text)
    )
    text = re.sub(r"([A-Za-zÀ-ÿ])\s+\.(?=\s|$)", r"\1.", text)
    text = re.sub(r"([?!;])(?=[A-Za-zÀ-ÿ])", r"\1 ", text)
    text = re.sub(r"([A-Za-zÀ-ÿ]),(?=[A-Za-zÀ-ÿ])", r"\1, ", text)
    text = re.sub(r"\s{2,}", " ", text).strip()
    text = re.sub(r"(^|[.!?]\s+)([a-z])", lambda m: m.group(1) + m.group(2).upper(), text)
    return text


def score_stt_alternative(
    text: str,
    lang: str,
    raw_confidence: Optional[float],
    rank: int,
    token_freq_across_alts: Optional[Dict[str, int]] = None,
) -> Dict[str, Any]:
    tokens = tokenize_words(text)
    if not tokens:
        return {"text": "", "lang": lang, "score": -999.0, "confidence": 0.0}

    is_en = lang.lower().startswith("en")
    en_hits = sum(1 for t in tokens if t in EN_FUNCTION_WORDS)
    id_hits = sum(1 for t in tokens if t in ID_FUNCTION_WORDS)

    base_conf = float(raw_confidence) if (raw_confidence is not None and raw_confidence > 0) else 0.72
    if rank > 0 and raw_confidence is None:
        base_conf = max(0.45, base_conf - 0.015 * rank)

    score = base_conf * 100.0
    low = text.lower()

    if is_en:
        score += en_hits * 7.5
        score -= id_hits * 8.0
        for calque in EN_FALSE_ID_CALQUES:
            if calque in low and id_hits == 0 and en_hits <= 2:
                score -= 14.0
        # Penalti bila kata acak tak nyambung bernilai confidence rendah
        if base_conf < 0.65:
            score -= (0.65 - base_conf) * 45.0
    else:
        score += id_hits * 8.5
        # Jika hasil decoder id-ID justru didominasi kata fungsi English tanpa fungsi Indonesia -> indikasi kuat pembicara berbahasa Inggris!
        if en_hits >= 1 and id_hits == 0:
            score -= (en_hits * 7.5 + 8.0)
        # Deteksi artefak phonetic drift (mis. "handphone my love for attention magnesium")
        drift_hits = sum(1 for t in tokens if t in ID_FALSE_ENGLISH_ARTIFACTS)
        if drift_hits > 0 and id_hits == 0:
            score -= drift_hits * 12.0
        if "my love" in low and id_hits == 0:
            score -= 15.0

    if token_freq_across_alts:
        consensus = sum(token_freq_across_alts.get(t, 1) for t in tokens) / max(len(tokens), 1)
        score += min(consensus, 4.0) * 1.2

    # Bonus ringan jika panjang kata bermakna realistis (tidak terpotong 1 kata sisa saat kalimat panjang)
    score += min(len(tokens), 12) * 0.4 - (rank * 0.2)

    return {
        "text": format_transcript_text(text),
        "lang": lang,
        "confidence": round(base_conf, 4),
        "en_hits": en_hits,
        "id_hits": id_hits,
        "score": round(score, 3),
        "rank": rank,
    }


def select_best_transcription(results_by_lang: List[Dict[str, Any]], mode: str = "auto") -> Dict[str, Any]:
    scored_pool: List[Dict[str, Any]] = []

    for entry in results_by_lang:
        lang = str(entry.get("lang") or "id-ID")
        raw = entry.get("raw")
        if not isinstance(raw, dict):
            continue
        alts = raw.get("alternative")
        if not isinstance(alts, list) or not alts:
            continue

        top_conf = alts[0].get("confidence") if isinstance(alts[0], dict) else None
        freq: Dict[str, int] = {}
        for alt in alts:
            if isinstance(alt, dict):
                for tok in set(tokenize_words(str(alt.get("transcript") or ""))):
                    freq[tok] = freq.get(tok, 0) + 1

        for idx, alt in enumerate(alts[:5]):
            if not isinstance(alt, dict):
                continue
            tr = str(alt.get("transcript") or "").strip()
            if not tr:
                continue
            alt_conf = alt.get("confidence") if "confidence" in alt else top_conf
            try:
                conf_val = float(alt_conf) if alt_conf is not None else None
            except Exception:
                conf_val = None
            scored = score_stt_alternative(tr, lang, conf_val, idx, freq)
            scored_pool.append(scored)

    if not scored_pool:
        return {
            "success": False,
            "text": "",
            "language": "id-ID" if mode == "id-ID" else ("en-US" if mode == "en-US" else "id-ID"),
            "confidence": 0.0,
            "candidates": [],
        }

    scored_pool.sort(key=lambda item: item["score"], reverse=True)
    winner = scored_pool[0]

    # Cek bahasa dominan akhir berdasar konten teks pemenang bila ada campur Inggris dalam decoder id-ID
    detected_lang = winner["lang"]
    if mode == "auto" and winner.get("en_hits", 0) > winner.get("id_hits", 0) and winner.get("id_hits", 0) == 0:
        detected_lang = "en-US"

    return {
        "success": True,
        "text": winner["text"],
        "language": detected_lang,
        "confidence": winner["confidence"],
        "score": winner["score"],
        "candidates": scored_pool[:6],
    }


def resolve_ffmpeg() -> Optional[str]:
    found = shutil.which("ffmpeg")
    if found and os.path.exists(found):
        return found
    for cand in (
        r"C:\ProgramData\chocolatey\bin\ffmpeg.exe",
        r"C:\ffmpeg\bin\ffmpeg.exe",
    ):
        if os.path.exists(cand):
            return cand
    return None


def convert_to_wav_16k(input_path: str, wav_path: str) -> None:
    ffmpeg_bin = resolve_ffmpeg()
    if not ffmpeg_bin:
        raise RuntimeError("FFmpeg tidak ditemukan di PATH sistem.")
    cmd = [
        ffmpeg_bin,
        "-y",
        "-i",
        input_path,
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        wav_path,
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=True, timeout=10)


def recognize_one_language(audio_data: sr.AudioData, lang: str) -> Dict[str, Any]:
    recognizer = sr.Recognizer()
    t0 = time.time()
    try:
        raw = recognizer.recognize_google(audio_data, language=lang, show_all=True)
        return {"lang": lang, "ms": int((time.time() - t0) * 1000), "raw": raw}
    except Exception as exc:
        return {"lang": lang, "ms": int((time.time() - t0) * 1000), "raw": None, "error": str(exc)}


def transcribe_audio_file(audio_path: str, mode: str = "auto", languages: Optional[List[str]] = None) -> Dict[str, Any]:
    t_start = time.time()
    if not audio_path or not os.path.exists(audio_path):
        return {"success": False, "error": "File audio sementara tidak ditemukan."}

    if mode in ("id-ID", "en-US"):
        target_langs = [mode]
    else:
        target_langs = [str(x) for x in (languages or ["en-US", "id-ID"]) if x]
        if not target_langs:
            target_langs = ["en-US", "id-ID"]

    with tempfile.TemporaryDirectory(prefix="zoz_stt_") as tmpdir:
        wav_path = os.path.join(tmpdir, "normalized_16k.wav")
        convert_to_wav_16k(audio_path, wav_path)

        recognizer = sr.Recognizer()
        with sr.AudioFile(wav_path) as src:
            audio_data = recognizer.record(src)

        if len(target_langs) == 1:
            results = [recognize_one_language(audio_data, target_langs[0])]
        else:
            with concurrent.futures.ThreadPoolExecutor(max_workers=len(target_langs)) as pool:
                futs = [pool.submit(recognize_one_language, audio_data, lg) for lg in target_langs]
                results = [f.result() for f in futs]

    picked = select_best_transcription(results, mode=mode)
    picked["latencyMs"] = int((time.time() - t_start) * 1000)
    return picked


def main() -> int:
    try:
        raw_in = sys.stdin.read()
        req = json.loads(raw_in) if raw_in.strip() else {}
    except Exception as exc:
        sys.stdout.write(json.dumps({"success": False, "error": f"Input JSON tidak valid: {exc}"}))
        return 1

    audio_path = str(req.get("audioPath") or "").strip()
    mode = str(req.get("mode") or "auto").strip()
    languages = req.get("languages") if isinstance(req.get("languages"), list) else ["en-US", "id-ID"]

    try:
        out = transcribe_audio_file(audio_path, mode=mode, languages=languages)
        sys.stdout.write(json.dumps(out, ensure_ascii=False))
        return 0
    except Exception as exc:
        sys.stdout.write(json.dumps({"success": False, "error": str(exc)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
