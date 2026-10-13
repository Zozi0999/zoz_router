"""
==============================================================================
UNIVERSAL YOUTUBE METADATA & GROUNDING TOOL (PYTHON) - UPGRADED v2.0
==============================================================================
Menggunakan YouTube oEmbed & parser metadata terverifikasi (Zero API Key).
Mendukung 100% seluruh ekosistem AI:
1. Universal Auto-Grounding (Dapat digunakan oleh SEMUA model tanpa function calling)
2. Anthropic Claude (via Native Tool Use / Function Calling)
3. OpenAI / OpenRouter (via Native Tool Calling)
4. Ollama (via Native Tool Calling)

Pembaruan & Fitur Unggulan v2.0:
1. Anti-Hallucination Grounding Directives: Memberikan instruksi ketat kepada AI
   mengenai batasan data (mencegah halusinasi isi video saat transkrip tidak ada).
2. Thread-Safe In-Memory TTL Cache: Mencegah data basi dan lonjakan latensi dengan
   batas TTL (4 jam) dan kapasitas maksimum (200 entri).
3. Network Resilience & Exponential Backoff: Mekanisme retry otomatis pada HTTP 429
   (Rate Limit) dan status HTTP 5xx serta kegagalan jaringan sementara.
4. Regex URL Universal: Mendukung youtu.be, watch, shorts, live, embed, /v/, playlist,
   dan query parameter kompleks.
5. Konkurensi Paralel Cepat: ThreadPoolExecutor untuk pemrosesan multi-link instan.
6. Hardened Tool Calling Loops: Guard batas giliran (max_turns) untuk mencegah infinite
   loop serta penanganan multi-content block pada respons SDK Anthropic Claude.
==============================================================================
"""

import json
import re
import time
import threading
import urllib.parse
import urllib.request
import urllib.error
import concurrent.futures
from typing import Dict, List, Optional, Any

ALLOWED_HOSTS = {
    "youtu.be",
    "www.youtu.be",
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
}

# Regex YouTube komprehensif (watch, shorts, live, embed, /v/, playlist)
YOUTUBE_URL_REGEX = re.compile(
    r"(?:https?://)?(?:www\.|m\.|music\.)?(?:youtube\.com/(?:watch\?(?:.*&)?v=|shorts/|live/|embed/|v/)|youtu\.be/)([a-zA-Z0-9_-]{11})(?:[^\s]*)?",
    re.IGNORECASE,
)

PLAYLIST_URL_REGEX = re.compile(
    r"(?:https?://)?(?:www\.|m\.)?youtube\.com/playlist\?(?:.*&)?list=([a-zA-Z0-9_-]+)",
    re.IGNORECASE,
)


class TTLCache:
    """Thread-safe In-Memory LRU/FIFO Cache dengan batas Time-To-Live (TTL)."""

    def __init__(self, max_entries: int = 200, ttl_seconds: float = 4 * 3600):
        self.max_entries = max_entries
        self.ttl_seconds = ttl_seconds
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            item = self._cache.get(key)
            if not item:
                return None
            if time.time() > item["expires_at"]:
                del self._cache[key]
                return None
            return item["value"]

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            now = time.time()
            if len(self._cache) >= self.max_entries:
                # Singkirkan item paling awal dibuat (FIFO eviction)
                oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k]["created_at"])
                del self._cache[oldest_key]
            self._cache[key] = {
                "value": value,
                "expires_at": now + self.ttl_seconds,
                "created_at": now,
            }

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()


memory_cache = TTLCache(max_entries=200, ttl_seconds=4 * 3600)


def extract_youtube_ids(text: str) -> List[str]:
    """Mengekstrak ID video YouTube yang unik (11 karakter) dari teks apapun."""
    if not text:
        return []
    ids: List[str] = []
    for match in YOUTUBE_URL_REGEX.finditer(text):
        vid_id = match.group(1)
        if vid_id and vid_id not in ids:
            ids.append(vid_id)
    return ids


def urlopen_with_retry(
    req: urllib.request.Request,
    timeout: int = 8,
    max_retries: int = 2,
    backoff_factor: float = 0.5,
) -> tuple[int, bytes]:
    """
    Menjalankan HTTP request dengan mekanisme retry otomatis dan exponential backoff.
    Menangani status HTTP 429 (Rate Limit), server error 5xx, dan transient network error.
    """
    attempt = 0
    while True:
        attempt += 1
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                status = getattr(response, "status", 200)
                body = response.read()
                return status, body
        except urllib.error.HTTPError as e:
            # Retry jika terkena rate limit (429) atau error server (500, 502, 503, 504)
            if (e.code == 429 or 500 <= e.code <= 504) and attempt <= max_retries:
                sleep_time = backoff_factor * (2 ** (attempt - 1))
                time.sleep(sleep_time)
                continue
            raise
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt <= max_retries:
                sleep_time = backoff_factor * attempt
                time.sleep(sleep_time)
                continue
            raise


def get_youtube_info(url_or_id: str, timeout: int = 8) -> Dict[str, Any]:
    """
    Mengambil metadata resmi (judul, nama kreator, URL channel, thumbnail) dari URL atau ID YouTube via oEmbed.
    Dilengkapi proteksi SSRF (host whitelist), zero API key requirement, dan in-memory TTL caching.
    """
    if not url_or_id or not isinstance(url_or_id, str):
        raise ValueError("URL atau ID video YouTube tidak boleh kosong.")

    clean_input = url_or_id.strip()
    video_id: Optional[str] = None
    playlist_id: Optional[str] = None
    canonical_url: str = ""

    # 1. Jika input berupa ID 11 karakter murni
    if re.match(r"^[a-zA-Z0-9_-]{11}$", clean_input):
        video_id = clean_input
        canonical_url = f"https://www.youtube.com/watch?v={video_id}"
    else:
        # Validasi host untuk keamanan SSRF
        url_to_parse = clean_input if clean_input.startswith(("http://", "https://")) else f"https://{clean_input}"
        try:
            parsed = urllib.parse.urlparse(url_to_parse)
        except Exception as e:
            raise ValueError(f"Format URL tidak valid: {e}")

        hostname = (parsed.hostname or "").lower()
        if hostname not in ALLOWED_HOSTS:
            raise ValueError(f"Host '{hostname}' tidak diizinkan. Hanya URL YouTube resmi yang diizinkan.")

        id_match = YOUTUBE_URL_REGEX.search(url_to_parse)
        if id_match:
            video_id = id_match.group(1)
            canonical_url = f"https://www.youtube.com/watch?v={video_id}"
        else:
            canonical_url = url_to_parse

        pl_match = PLAYLIST_URL_REGEX.search(url_to_parse)
        if pl_match:
            playlist_id = pl_match.group(1)

    # 2. Periksa in-memory cache dengan TTL
    cached = memory_cache.get(canonical_url)
    if cached:
        result_from_cache = dict(cached)
        result_from_cache["from_cache"] = True
        return result_from_cache

    # 3. Panggil YouTube oEmbed API
    oembed_endpoint = f"https://www.youtube.com/oembed?url={urllib.parse.quote(canonical_url)}&format=json"
    req = urllib.request.Request(
        oembed_endpoint,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/json, text/html, */*",
        },
    )

    try:
        status, body = urlopen_with_retry(req, timeout=timeout)
        if status == 200:
            data = json.loads(body.decode("utf-8"))
            result = {
                "success": True,
                "video_id": video_id,
                "playlist_id": playlist_id,
                "url": canonical_url,
                "title": data.get("title", "Tanpa Judul"),
                "channel": data.get("author_name", "Kreator YouTube"),
                "channel_url": data.get("author_url", ""),
                "thumbnail": data.get(
                    "thumbnail_url",
                    f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg" if video_id else "",
                ),
                "type": data.get("type", "video"),
                "provider": data.get("provider_name", "YouTube"),
                "has_transcript": False,  # oEmbed murni metadata (transkrip teks tidak tersedia di oEmbed)
                "timestamp": int(time.time() * 1000),
            }
            memory_cache.set(canonical_url, result)
            return result
        else:
            return {
                "success": False,
                "error": f"YouTube oEmbed mengembalikan status HTTP {status}",
                "url": canonical_url,
                "video_id": video_id,
            }
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return {
                "success": False,
                "error": "Video tidak ditemukan atau berstatus privat/dihapus (HTTP 404).",
                "url": canonical_url,
                "video_id": video_id,
            }
        elif e.code == 429:
            return {
                "success": False,
                "error": "YouTube menerapkan pembatasan laju kueri (HTTP 429 Rate Limit). Coba beberapa saat lagi.",
                "url": canonical_url,
                "video_id": video_id,
            }
        return {
            "success": False,
            "error": f"HTTP Error {e.code}: {e.reason}",
            "url": canonical_url,
            "video_id": video_id,
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Kegagalan jaringan YouTube oEmbed: {e}",
            "url": canonical_url,
            "video_id": video_id,
        }


# ==============================================================================
# METODE 1: UNIVERSAL AUTO-GROUNDING (BISA DIGUNAKAN OLEH 100% SEMUA MODEL)
# ==============================================================================
# Solusi terbaik untuk model yang TIDAK mendukung tool calling (misal model lokal
# Ollama, model kecil, Llama 2/3, Mistral, Gemma, Nemotron, dll.)
# Menggunakan ThreadPoolExecutor untuk eksekusi paralel multi-link yang cepat.
# ==============================================================================

def enrich_prompt_with_youtube(prompt: str, max_workers: int = 5) -> str:
    """
    Mendeteksi tautan YouTube di dalam prompt pengguna, mengambil metadata oEmbed secara
    konkuren/paralel di latar belakang, dan menyuntikkan data terverifikasi ke dalam prompt
    beserta panduan integritas ketat anti-halusinasi.
    """
    if not prompt or not isinstance(prompt, str):
        return prompt

    video_ids = extract_youtube_ids(prompt)
    if not video_ids:
        return prompt

    # Eksekusi paralel asinkron/konkuren menggunakan ThreadPoolExecutor
    infos: List[Dict[str, Any]] = []
    worker_count = min(len(video_ids), max_workers)
    with concurrent.futures.ThreadPoolExecutor(max_workers=worker_count) as executor:
        future_to_vid = {executor.submit(get_youtube_info, vid_id): vid_id for vid_id in video_ids}
        for future in concurrent.futures.as_completed(future_to_vid):
            try:
                res = future.result()
                if res and res.get("success"):
                    infos.append(res)
            except Exception:
                pass

    if not infos:
        return prompt

    # Urutkan berdasarkan urutan kemunculan ID di prompt
    infos.sort(key=lambda x: video_ids.index(x.get("video_id")) if x.get("video_id") in video_ids else 999)

    grounding_blocks = []
    for idx, v in enumerate(infos, 1):
        block = (
            f"[DATA TERVERIFIKASI VIDEO YOUTUBE #{idx}]\n"
            f"- URL Resmi: {v['url']}\n"
            f"- ID Video: {v.get('video_id') or 'N/A'}\n"
            f"- Judul Video: \"{v['title']}\"\n"
            f"- Nama Channel / Kreator: \"{v['channel']}\" ({v.get('channel_url') or 'N/A'})\n"
            f"- Thumbnail: {v.get('thumbnail') or ''}\n"
            f"- Status Transkrip: Tidak tersedia dalam metadata oEmbed."
        )
        grounding_blocks.append(block)

    grounding_header = (
        "\n\n### DATA METADATA RESMI YOUTUBE (VERIFIED GROUNDING):\n"
        + "\n\n".join(grounding_blocks)
        + "\n\n### PANDUAN INTEGRITAS & ANTI-HALUSINASI UNTUK ASISTEN AI:\n"
        "1. Informasi di atas adalah metadata resmi terverifikasi real-time via YouTube oEmbed.\n"
        "2. BATASAN DATA: Data di atas HANYA memuat judul dan nama channel/kreator, dan TIDAK MEMUAT transkrip/rekaman isi suara video.\n"
        "3. DILARANG BERHALUSINASI: Dilarang mengarang, menebak, atau mereka-reka isi dialog, kesimpulan, atau alur adegan detail dari video di atas semata-mata berdasarkan judulnya.\n"
        "4. JAWABAN JUJUR: Jika pengguna meminta 'Rangkum isi video ini' atau 'Apa kesimpulan video ini?', jelaskan fakta judul dan kreatornya, lalu sampaikan secara transparan kepada pengguna bahwa transkrip penuh percakapan di dalam video tidak tersedia.\n"
    )

    return prompt + grounding_header


# ==============================================================================
# METODE 2: TOOL DEFINITIONS UNTUK MODEL DENGAN FUNCTION CALLING
# ==============================================================================

# 1. Skema untuk Anthropic Claude
YOUTUBE_TOOL_ANTHROPIC = {
    "name": "get_youtube_info",
    "description": (
        "Mengambil metadata resmi (judul, nama kreator, URL channel, dan thumbnail) dari tautan atau ID video YouTube resmi via oEmbed. "
        "Gunakan tool ini setiap kali pengguna memberikan tautan YouTube atau menanyakan informasi mengenai video YouTube."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "URL video YouTube (contoh: https://youtu.be/... atau https://www.youtube.com/watch?v=...) atau ID video 11 karakter.",
            }
        },
        "required": ["url"],
    },
}

# 2. Skema untuk OpenAI & OpenRouter
YOUTUBE_TOOL_OPENAI = {
    "type": "function",
    "function": {
        "name": "get_youtube_info",
        "description": "Mengambil metadata resmi (judul, nama kreator, thumbnail) dari video YouTube via oEmbed.",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "URL lengkap video YouTube atau ID video 11 karakter.",
                }
            },
            "required": ["url"],
        },
    },
}

# 3. Skema untuk Ollama Tools
YOUTUBE_TOOL_OLLAMA = YOUTUBE_TOOL_OPENAI


# ==============================================================================
# IMPLEMENTASI CONTOH PENGGUNAAN (ANTHROPIC, OPENAI, OLLAMA)
# ==============================================================================

def example_anthropic_tool_loop(prompt: str, api_key: Optional[str] = None, max_turns: int = 8):
    """
    Contoh tool calling loop menggunakan SDK Anthropic Claude.
    Dilengkapi batas maksimum giliran (max_turns) dan penanganan multi-content block.
    """
    try:
        import anthropic
    except ImportError:
        print("[!] Install anthropic terlebih dahulu: pip install anthropic")
        return

    client = anthropic.Anthropic(api_key=api_key)
    messages = [{"role": "user", "content": prompt}]
    turns = 0

    while turns < max_turns:
        turns += 1
        resp = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1024,
            tools=[YOUTUBE_TOOL_ANTHROPIC],
            messages=messages,
        )

        if resp.stop_reason != "tool_use":
            # Ekstraksi seluruh teks dari seluruh content block secara aman
            text_parts = [
                getattr(b, "text", "")
                for b in resp.content
                if getattr(b, "type", None) == "text" or hasattr(b, "text")
            ]
            final_text = "\n".join(filter(None, text_parts)) or str(resp.content)
            print("\n[Claude Jawaban Akhir]:\n", final_text)
            break

        messages.append({"role": "assistant", "content": resp.content})
        tool_results = []

        for block in resp.content:
            if getattr(block, "type", None) == "tool_use":
                print(f"[+] Menjalankan tool '{block.name}' dengan argumen:", block.input)
                try:
                    target_url = block.input.get("url", "") if isinstance(block.input, dict) else ""
                    tool_output = json.dumps(get_youtube_info(target_url), ensure_ascii=False)
                except Exception as e:
                    tool_output = json.dumps({"success": False, "error": str(e)}, ensure_ascii=False)

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": tool_output,
                })

        messages.append({"role": "user", "content": tool_results})
    else:
        print(f"[!] Batas giliran maksimum ({max_turns}) tercapai. Menghentikan loop.")


def example_openai_tool_loop(
    prompt: str,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    max_turns: int = 8,
):
    """
    Contoh tool calling loop menggunakan SDK OpenAI / OpenRouter.
    Dilengkapi batas maksimum giliran (max_turns) untuk mencegah infinite loop.
    """
    try:
        import openai
    except ImportError:
        print("[!] Install openai terlebih dahulu: pip install openai")
        return

    client = openai.OpenAI(api_key=api_key, base_url=base_url)
    messages = [{"role": "user", "content": prompt}]
    turns = 0

    while turns < max_turns:
        turns += 1
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=[YOUTUBE_TOOL_OPENAI],
            temperature=0.3,
        )

        choice = resp.choices[0]
        msg = choice.message

        if not msg.tool_calls:
            print("\n[OpenAI Jawaban Akhir]:\n", msg.content)
            break

        messages.append(msg)
        for tc in msg.tool_calls:
            if tc.function.name == "get_youtube_info":
                try:
                    args = json.loads(tc.function.arguments)
                except Exception:
                    args = {}
                print(f"[+] Menjalankan tool '{tc.function.name}' dengan argumen:", args)
                out = json.dumps(get_youtube_info(args.get("url", "")), ensure_ascii=False)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": out,
                })
    else:
        print(f"[!] Batas giliran maksimum ({max_turns}) tercapai. Menghentikan loop.")


# ==============================================================================
# CLI EXECUTION ENTRYPOINT
# ==============================================================================
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Penggunaan CLI Python (v2.0):")
        print("  1. Ambil info video:")
        print("     python youtube_tool.py https://youtu.be/tscOUFxV3qA")
        print("\n  2. Perkaya prompt dengan proteksi anti-halusinasi (Universal):")
        print('     python youtube_tool.py --enrich "Rangkum video https://youtu.be/tscOUFxV3qA ini"')
        sys.exit(0)

    arg = sys.argv[1]
    if arg == "--enrich" and len(sys.argv) > 2:
        prompt_input = " ".join(sys.argv[2:])
        enriched = enrich_prompt_with_youtube(prompt_input)
        print("=== PROMPT TERKAYA DENGAN GROUNDING ANTI-HALUSINASI ===")
        print(enriched)
    else:
        info = get_youtube_info(arg)
        print(json.dumps(info, indent=2, ensure_ascii=False))
