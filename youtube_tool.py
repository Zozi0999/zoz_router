"""
==============================================================================
UNIVERSAL YOUTUBE METADATA TOOL FOR ALL AI MODELS
==============================================================================
Menggunakan endpoint resmi YouTube oEmbed (tanpa memerlukan YouTube API Key).
Mendukung 100% seluruh model AI:
1. Universal Auto-Grounding (Dapat digunakan oleh SEMUA model tanpa function calling)
2. Anthropic Claude (via Native Tool Use / Function Calling)
3. OpenAI / OpenRouter (via Native Tool Calling)
4. Ollama (via Native Tool Calling)
==============================================================================
"""

import json
import re
import urllib.parse
import urllib.request
import urllib.error
from typing import Dict, List, Optional, Any

ALLOWED_HOSTS = {
    "youtu.be",
    "www.youtu.be",
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
}

YOUTUBE_URL_REGEX = re.compile(
    r"(?:https?://)?(?:www\.|m\.|music\.)?(?:youtube\.com/(?:watch\?(?:.*&)?v=|shorts/|live/|embed/)|youtu\.be/)([a-zA-Z0-9_-]{11})",
    re.IGNORECASE,
)


def extract_youtube_ids(text: str) -> List[str]:
    """Mengekstrak ID video YouTube yang unik dari teks apapun."""
    if not text:
        return []
    ids = []
    for match in YOUTUBE_URL_REGEX.finditer(text):
        vid_id = match.group(1)
        if vid_id and vid_id not in ids:
            ids.append(vid_id)
    return ids


def get_youtube_info(url_or_id: str, timeout: int = 10) -> Dict[str, Any]:
    """
    Mengambil judul video, nama channel, dan thumbnail dari URL atau ID YouTube via oEmbed.
    Dilengkapi proteksi SSRF (host whitelist) dan zero API key requirement.
    """
    if not url_or_id:
        raise ValueError("URL atau ID video YouTube tidak boleh kosong.")

    clean_input = url_or_id.strip()
    video_id = None

    # Jika input berupa ID 11 karakter murni
    if re.match(r"^[a-zA-Z0-9_-]{11}$", clean_input):
        video_id = clean_input
        canonical_url = f"https://www.youtube.com/watch?v={video_id}"
    else:
        # Validasi host untuk keamanan SSRF
        if not clean_input.startswith(("http://", "https://")):
            clean_input = "https://" + clean_input

        parsed = urllib.parse.urlparse(clean_input)
        hostname = (parsed.hostname or "").lower()
        if hostname not in ALLOWED_HOSTS:
            raise ValueError(f"Host '{hostname}' tidak diizinkan. Hanya URL YouTube resmi yang diizinkan.")

        id_match = YOUTUBE_URL_REGEX.search(clean_input)
        if id_match:
            video_id = id_match.group(1)
            canonical_url = f"https://www.youtube.com/watch?v={video_id}"
        else:
            canonical_url = clean_input

    # Panggil YouTube oEmbed API
    oembed_endpoint = f"https://www.youtube.com/oembed?url={urllib.parse.quote(canonical_url)}&format=json"

    req = urllib.request.Request(
        oembed_endpoint,
        headers={"User-Agent": "ZozRouter-YouTubeTool/1.0 (Mozilla/5.0 Compatible)"},
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                return {
                    "success": True,
                    "video_id": video_id,
                    "url": canonical_url,
                    "title": data.get("title", "Tanpa Judul"),
                    "channel": data.get("author_name", "Kreator YouTube"),
                    "channel_url": data.get("author_url", ""),
                    "thumbnail": data.get("thumbnail_url", f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg" if video_id else ""),
                    "type": data.get("type", "video"),
                    "provider": data.get("provider_name", "YouTube"),
                }
            else:
                return {
                    "success": False,
                    "error": f"YouTube oEmbed mengembalikan status HTTP {response.status}",
                    "url": canonical_url,
                }
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return {
                "success": False,
                "error": "Video tidak ditemukan atau berstatus privat/dihapus (HTTP 404).",
                "url": canonical_url,
            }
        return {"success": False, "error": f"HTTP Error {e.code}: {e.reason}", "url": canonical_url}
    except Exception as e:
        return {"success": False, "error": str(e), "url": canonical_url}


# ==============================================================================
# METODE 1: UNIVERSAL AUTO-GROUNDING (BISA DIGUNAKAN OLEH 100% SEMUA MODEL)
# ==============================================================================
# Solusi terbaik untuk model yang TIDAK mendukung tool calling (misal model lokal
# Ollama, model kecil, Llama 2/3, Mistral, Gemma, Nemotron, dll.)
# ==============================================================================

def enrich_prompt_with_youtube(prompt: str) -> str:
    """
    Mendeteksi tautan YouTube di dalam prompt pengguna, mengambil metadata oEmbed secara
    otomatis di latar belakang, dan menyuntikkan data terverifikasi ke dalam prompt.
    Dapat langsung dikirim ke model apapun tanpa konfigurasi tool calling!
    """
    video_ids = extract_youtube_ids(prompt)
    if not video_ids:
        return prompt

    infos = []
    for vid_id in video_ids:
        info = get_youtube_info(vid_id)
        if info.get("success"):
            infos.append(info)

    if not infos:
        return prompt

    grounding_blocks = []
    for idx, v in enumerate(infos, 1):
        block = (
            f"[DATA TERVERIFIKASI VIDEO YOUTUBE #{idx}]\n"
            f"- URL Video: {v['url']}\n"
            f"- Judul Video: \"{v['title']}\"\n"
            f"- Nama Channel / Kreator: \"{v['channel']}\" ({v.get('channel_url', '')})\n"
            f"- Thumbnail: {v.get('thumbnail', '')}\n"
            f"(Data resmi real-time via YouTube oEmbed)"
        )
        grounding_blocks.append(block)

    grounding_header = (
        "\n\n### REAL-TIME YOUTUBE VIDEO GROUNDING DATA:\n"
        + "\n\n".join(grounding_blocks)
        + "\n\nInstruksi untuk AI: Gunakan informasi metadata resmi di atas untuk menjawab dan menganalisis "
        "video YouTube yang ditanyakan pengguna secara tepat, akurat, dan tanpa halusinasi.\n"
    )

    return prompt + grounding_header


# ==============================================================================
# METODE 2: TOOL DEFINITIONS UNTUK MODEL DENGAN FUNCTION CALLING
# ==============================================================================

# 1. Skema untuk Anthropic Claude
YOUTUBE_TOOL_ANTHROPIC = {
    "name": "get_youtube_info",
    "description": (
        "Mengambil judul, nama channel kreator, URL channel, dan thumbnail dari URL atau ID video YouTube resmi. "
        "Gunakan tool ini setiap kali pengguna menyertakan tautan YouTube atau menanyakan informasi mengenai video YouTube."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "URL lengkap video YouTube (contoh: https://youtu.be/... atau https://www.youtube.com/watch?v=...) atau ID video 11 karakter.",
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
        "description": "Mengambil judul, nama channel kreator, dan thumbnail dari video YouTube resmi menggunakan oEmbed.",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "URL video YouTube (misal: https://youtu.be/...)",
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

def example_anthropic_tool_loop(prompt: str, api_key: Optional[str] = None):
    """Contoh tool calling loop menggunakan SDK Anthropic Claude."""
    try:
        import anthropic
    except ImportError:
        print("[!] Install anthropic terlebih dahulu: pip install anthropic")
        return

    client = anthropic.Anthropic(api_key=api_key)
    messages = [{"role": "user", "content": prompt}]

    while True:
        resp = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1024,
            tools=[YOUTUBE_TOOL_ANTHROPIC],
            messages=messages,
        )

        if resp.stop_reason != "tool_use":
            print("\n[Claude Jawaban Akhir]:\n", resp.content[0].text)
            break

        messages.append({"role": "assistant", "content": resp.content})
        tool_results = []

        for block in resp.content:
            if block.type == "tool_use":
                print(f"[+] Menjalankan tool '{block.name}' dengan argumen:", block.input)
                try:
                    tool_output = json.dumps(get_youtube_info(block.input.get("url", "")))
                except Exception as e:
                    tool_output = json.dumps({"success": False, "error": str(e)})

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": tool_output,
                })

        messages.append({"role": "user", "content": tool_results})


def example_openai_tool_loop(prompt: str, api_key: Optional[str] = None, base_url: Optional[str] = None):
    """Contoh tool calling loop menggunakan SDK OpenAI / OpenRouter."""
    try:
        import openai
    except ImportError:
        print("[!] Install openai terlebih dahulu: pip install openai")
        return

    client = openai.OpenAI(api_key=api_key, base_url=base_url)
    messages = [{"role": "user", "content": prompt}]

    while True:
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
                args = json.loads(tc.function.arguments)
                print(f"[+] Menjalankan tool '{tc.function.name}' dengan argumen:", args)
                out = json.dumps(get_youtube_info(args.get("url", "")))
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": out,
                })


# ==============================================================================
# CLI EXECUTION ENTRYPOINT
# ==============================================================================
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Penggunaan CLI:")
        print("  1. Ambil info video langsung:")
        print("     python youtube_tool.py https://youtu.be/tscOUFxV3qA")
        print("\n  2. Perkaya prompt untuk SEMUA MODEL (Universal):")
        print("     python youtube_tool.py --enrich \"Apa isi video https://youtu.be/tscOUFxV3qA ini?\"")
        sys.exit(0)

    arg = sys.argv[1]
    if arg == "--enrich" and len(sys.argv) > 2:
        prompt_input = " ".join(sys.argv[2:])
        enriched = enrich_prompt_with_youtube(prompt_input)
        print("=== PROMPT TERKAYA UNTUK SEMUA MODEL ===")
        print(enriched)
    else:
        info = get_youtube_info(arg)
        print(json.dumps(info, indent=2, ensure_ascii=False))
