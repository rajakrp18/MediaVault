import os
import sys
import math
import logging
import requests
import yt_dlp
from typing import Dict, Any, List

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Try static_ffmpeg for portable ffmpeg binary execution
try:
    import static_ffmpeg
    static_ffmpeg.add_paths()
    logger.info("static_ffmpeg loaded successfully")
except Exception as e:
    logger.warning(f"Could not initialize static_ffmpeg: {e}")

DOWNLOADS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "downloads"))
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

# Global cookie browser setting (can be changed via API)
# Options: None (use cookies.txt if exists), 'chrome', 'firefox', 'edge', 'brave', 'opera', 'chromium', 'vivaldi'
COOKIE_BROWSER = None


def set_cookie_browser(browser: str):
    global COOKIE_BROWSER
    COOKIE_BROWSER = browser
    logger.info(f"Cookie browser source set to: {browser}")


def get_cookie_browser():
    return COOKIE_BROWSER


def format_bytes(size: float) -> str:
    if size <= 0:
        return "0 B"
    size_name = ("B", "KB", "MB", "GB", "TB")
    i = int(math.floor(math.log(size, 1024)))
    p = math.pow(1024, i)
    s = round(size / p, 2)
    return f"{s} {size_name[i]}"


def get_yt_dlp_options(quiet=True) -> dict:
    opts = {
        'quiet': quiet,
        'no_warnings': quiet,
        'extract_flat': False,
        'skip_download': False,
        'ignoreerrors': False,
        'nocheckcertificate': True,
        'geo_bypass': True,
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'web']
            }
        },
    }

    # Priority 1: Use browser cookies if configured
    global COOKIE_BROWSER
    if COOKIE_BROWSER:
        opts['cookiesfrombrowser'] = (COOKIE_BROWSER,)
        logger.info(f"Using cookies from browser: {COOKIE_BROWSER}")
    else:
        # Priority 2: Try several cookie file names (user may not rename the file)
        backend_dir = os.path.dirname(__file__)
        candidate_files = [
            os.path.join(backend_dir, "cookies.txt"),
            os.path.join(backend_dir, "cookies"),
            os.path.join(backend_dir, "youtube.com_cookies.txt"),
            os.path.join(backend_dir, "www.youtube.com_cookies.txt"),
        ]
        found_cookies = None
        for cf in candidate_files:
            if os.path.exists(cf) and os.path.getsize(cf) > 100:
                found_cookies = cf
                break

        if found_cookies:
            opts['cookiefile'] = found_cookies
            logger.info(f"Using cookies from file: {found_cookies}")
        else:
            logger.warning("No cookies configured. YouTube downloads may fail bot detection.")

    return opts


def embed_id3_metadata(filepath: str, title: str, artist: str, thumbnail_url: str = None):
    """Embed ID3v2 tags (Title, Artist, Album, Cover Art) into exported MP3 file using Mutagen + Pillow."""
    if not filepath.endswith('.mp3') or not os.path.exists(filepath):
        return

    try:
        from mutagen.id3 import ID3, TIT2, TPE1, TALB, APIC, ID3NoHeaderError
        from PIL import Image
        import io

        try:
            audio = ID3(filepath)
        except ID3NoHeaderError:
            audio = ID3()

        if title:
            audio.add(TIT2(encoding=3, text=title))
        if artist:
            audio.add(TPE1(encoding=3, text=artist))
            audio.add(TALB(encoding=3, text=f"{artist} Collection"))

        if thumbnail_url:
            try:
                img_res = requests.get(thumbnail_url, timeout=10)
                if img_res.status_code == 200:
                    image = Image.open(io.BytesIO(img_res.content)).convert("RGB")
                    output_bytes = io.BytesIO()
                    image.save(output_bytes, format="JPEG", quality=90)
                    jpeg_data = output_bytes.getvalue()

                    audio.add(APIC(
                        encoding=3,
                        mime='image/jpeg',
                        type=3,  # 3 = Front cover
                        desc=u'Cover',
                        data=jpeg_data
                    ))
            except Exception as img_err:
                logger.warning(f"Could not convert/embed thumbnail for ID3 tagging: {img_err}")

        audio.save(filepath, v2_version=3)
        logger.info(f"ID3 tags embedded successfully: {filepath}")
    except Exception as tag_err:
        logger.warning(f"Failed to embed ID3 tags: {tag_err}")


def fetch_media_info(url: str) -> Dict[str, Any]:
    """Fetch video or playlist metadata without downloading."""
    opts = get_yt_dlp_options(quiet=True)
    opts['extract_flat'] = True  # Fast flat extraction for instant playlist indexing
    opts['skip_download'] = True

    try:
        with yt_dlp.YoutubeDL(opts) as ytdl:
            info = ytdl.extract_info(url, download=False)
            if not info:
                raise ValueError("Unable to extract info from URL")

            is_playlist = info.get('_type') == 'playlist' or 'entries' in info or 'playlist' in url.lower() or 'list=' in url.lower()

            if is_playlist:
                entries = []
                raw_entries = info.get('entries', [])
                for idx, entry in enumerate(raw_entries):
                    if not entry:
                        continue
                    v_id = entry.get('id') or entry.get('url')
                    title = entry.get('title') or f"Video #{idx+1}"
                    v_url = entry.get('webpage_url') or entry.get('url') or (f"https://www.youtube.com/watch?v={v_id}" if v_id else url)
                    
                    thumb = entry.get('thumbnail')
                    if not thumb and entry.get('thumbnails'):
                        thumb = entry.get('thumbnails')[0].get('url')
                    if not thumb and v_id:
                        thumb = f"https://i.ytimg.com/vi/{v_id}/hqdefault.jpg"

                    entries.append({
                        "index": idx + 1,
                        "id": v_id,
                        "title": title,
                        "url": v_url,
                        "duration": entry.get('duration', 0),
                        "uploader": entry.get('uploader') or entry.get('channel') or info.get('uploader') or "Unknown Channel",
                        "thumbnail": thumb
                    })

                return {
                    "type": "playlist",
                    "title": info.get('title', 'YouTube Playlist'),
                    "uploader": info.get('uploader') or info.get('channel') or "Unknown Channel",
                    "item_count": len(entries),
                    "entries": entries,
                    "thumbnail": entries[0]['thumbnail'] if entries else None
                }
            else:
                formats = info.get('formats', [])
                video_qualities = set()
                for f in formats:
                    h = f.get('height')
                    if h and isinstance(h, int):
                        if h >= 2160: video_qualities.add("4K (2160p)")
                        elif h >= 1440: video_qualities.add("1440p")
                        elif h >= 1080: video_qualities.add("1080p")
                        elif h >= 720: video_qualities.add("720p")
                        elif h >= 480: video_qualities.add("480p")
                        elif h >= 360: video_qualities.add("360p")

                sorted_qualities = sorted(list(video_qualities), key=lambda x: int(''.join(filter(str.isdigit, x)) or 0), reverse=True)
                if not sorted_qualities:
                    sorted_qualities = ["Best Quality", "720p", "360p"]
                else:
                    sorted_qualities.insert(0, "Best Quality")

                thumbnails = info.get('thumbnails', [])
                thumbnail = info.get('thumbnail')
                if not thumbnail and thumbnails:
                    thumbnail = thumbnails[-1].get('url')

                return {
                    "type": "single",
                    "title": info.get('title', 'Video'),
                    "uploader": info.get('uploader') or info.get('channel') or "Unknown Uploader",
                    "duration": info.get('duration', 0),
                    "view_count": info.get('view_count', 0),
                    "thumbnail": thumbnail,
                    "video_qualities": sorted_qualities,
                    "audio_qualities": ["320 kbps (High)", "256 kbps (Medium)", "128 kbps (Standard)"],
                    "url": info.get('webpage_url', url)
                }
    except yt_dlp.utils.DownloadError as e:
        err_str = str(e)
        if 'Could not copy' in err_str and 'cookie' in err_str.lower():
            raise ValueError(
                "Cannot access the browser's cookie database (it may be locked while the browser is running). "
                "Solution: Export cookies.txt instead — install 'Get cookies.txt LOCALLY' Chrome extension, "
                "log into YouTube, click the extension on youtube.com, save as backend/cookies.txt, "
                "then in Settings select 'None (use cookies.txt)'."
            )
        if 'Sign in' in err_str or 'bot' in err_str.lower() or 'cookies' in err_str.lower():
            raise ValueError(
                "YouTube requires authentication. "
                "Go to ⚙️ Settings → select your browser to use its cookies. "
                "Or export a cookies.txt file using the 'Get cookies.txt LOCALLY' Chrome extension."
            )
        raise


def download_media_job(job_id: str, url: str, format_type: str, quality: str, job_manager) -> str:
    """Download single media item with real-time status callbacks and robust ID3 tagging."""
    output_template = os.path.join(DOWNLOADS_DIR, "%(title)s [%(id)s].%(ext)s")

    def progress_hook(d):
        if d['status'] == 'downloading':
            total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
            downloaded = d.get('downloaded_bytes') or 0
            speed = d.get('speed') or 0
            eta = d.get('eta') or 0

            percent = round((downloaded / total * 100), 1) if total > 0 else 0.0

            job_manager.update_job(job_id, {
                "status": "downloading",
                "progress": percent,
                "downloaded_bytes": downloaded,
                "total_bytes": total,
                "speed": f"{format_bytes(speed)}/s" if speed else "Calculating...",
                "eta": f"{eta}s" if eta else "Unknown"
            })
        elif d['status'] == 'finished':
            job_manager.update_job(job_id, {
                "status": "processing",
                "progress": 99.0,
                "eta": "Finalizing..."
            })
        elif d['status'] == 'error':
            logger.error(f"yt-dlp progress hook error for job {job_id}: {d.get('error', 'Unknown error')}")

    base_opts = get_yt_dlp_options(quiet=True)
    ydl_opts = {
        **base_opts,
        'outtmpl': output_template,
        'progress_hooks': [progress_hook],
        'quiet': True,
        'no_warnings': True,
        'nocheckcertificate': True,
        'overwrites': True,
        'noplaylist': True,
        'windowsfilenames': True,
        'nopart': True,  # Write directly, avoid .part temp files that cause Windows file-locking errors
    }

    if format_type == 'audio':
        bitrate = "320"
        if "256" in quality: bitrate = "256"
        elif "128" in quality: bitrate = "128"

        target_ext = 'mp3'
        if 'm4a' in quality.lower(): target_ext = 'm4a'
        elif 'wav' in quality.lower(): target_ext = 'wav'

        ydl_opts.update({
            'format': 'bestaudio/best',
            'postprocessors': [
                {
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': target_ext,
                    'preferredquality': bitrate,
                },
                {
                    'key': 'FFmpegMetadata',
                    'add_metadata': True,
                }
            ]
        })
    else:  # video
        height_limit = None
        if "2160" in quality or "4K" in quality: height_limit = 2160
        elif "1440" in quality: height_limit = 1440
        elif "1080" in quality: height_limit = 1080
        elif "720" in quality: height_limit = 720
        elif "480" in quality: height_limit = 480
        elif "360" in quality: height_limit = 360

        if height_limit:
            ydl_opts['format'] = f'bestvideo[height<={height_limit}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<={height_limit}]+bestaudio/best[height<={height_limit}]/best'
        else:
            ydl_opts['format'] = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best'

        ydl_opts['merge_output_format'] = 'mp4'

    job_manager.update_job(job_id, {"status": "downloading", "progress": 1.0})

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ytdl:
            info = ytdl.extract_info(url, download=True)
            
            if info is None:
                raise ValueError("yt-dlp returned no info — download may have been blocked or URL is invalid.")

            filename = ytdl.prepare_filename(info)

            if format_type == 'audio':
                ext = 'mp3'
                if 'm4a' in quality.lower(): ext = 'm4a'
                elif 'wav' in quality.lower(): ext = 'wav'
                filename = os.path.splitext(filename)[0] + f".{ext}"

                # Ensure ID3 metadata tags & high-res thumbnail cover art are embedded via Pillow + Mutagen
                title = info.get('title')
                artist = info.get('uploader') or info.get('channel')
                thumbnails = info.get('thumbnails', [])
                thumb = info.get('thumbnail') or (thumbnails[-1].get('url') if thumbnails else None)
                embed_id3_metadata(filename, title, artist, thumb)

            elif format_type == 'video':
                base_name = os.path.splitext(filename)[0]
                if os.path.exists(base_name + '.mp4'):
                    filename = base_name + '.mp4'
                elif not os.path.exists(filename):
                    # Search for the file in downloads dir with same base name
                    for f in os.listdir(DOWNLOADS_DIR):
                        if f.startswith(os.path.basename(base_name)[:30]):
                            filename = os.path.join(DOWNLOADS_DIR, f)
                            break

            basename = os.path.basename(filename)

            job_manager.update_job(job_id, {
                "status": "completed",
                "progress": 100.0,
                "title": info.get('title', basename),
                "thumbnail": info.get('thumbnail'),
                "filename": basename,
                "filepath": filename
            })
            logger.info(f"Job {job_id} completed: {filename}")
            return filename

    except yt_dlp.utils.DownloadError as e:
        err_str = str(e)
        logger.error(f"yt-dlp DownloadError for job {job_id}: {err_str}")

        # Provide helpful error messages for common issues
        if 'Sign in' in err_str or 'bot' in err_str.lower() or 'cookies' in err_str.lower():
            friendly_error = (
                "YouTube bot detection triggered. "
                "Go to Settings (⚙️) and select your browser (Chrome/Edge/Firefox) to use your existing YouTube login cookies. "
                "Make sure you are logged into YouTube in that browser."
            )
        elif 'Private video' in err_str:
            friendly_error = "This is a private video. You must be logged in and have access to it."
        elif 'not available' in err_str.lower():
            friendly_error = "This video is not available in your region or has been removed."
        elif 'ffmpeg' in err_str.lower():
            friendly_error = "FFmpeg error during audio/video processing. Try a different quality or format."
        else:
            friendly_error = err_str[:300]

        job_manager.update_job(job_id, {
            "status": "error",
            "error": friendly_error
        })
        raise ValueError(friendly_error)

    except Exception as err:
        logger.error(f"Download job {job_id} failed: {err}")
        # Try direct file download as fallback
        if url.startswith('http://') or url.startswith('https://'):
            try:
                return download_direct_file(job_id, url, job_manager)
            except Exception as direct_err:
                logger.error(f"Direct download fallback also failed: {direct_err}")

        job_manager.update_job(job_id, {
            "status": "error",
            "error": str(err)[:300]
        })
        raise err


def download_direct_file(job_id: str, url: str, job_manager) -> str:
    """Fallback handler for downloading direct file URLs (e.g. .mp4, .mp3, .pdf, .zip)."""
    response = requests.get(url, stream=True, timeout=30)
    response.raise_for_status()

    cd = response.headers.get('content-disposition')
    if cd and 'filename=' in cd:
        filename = cd.split('filename=')[-1].strip(' "\'').rstrip(';')
    else:
        filename = url.split('/')[-1].split('?')[0] or "downloaded_file"

    if not os.path.splitext(filename)[1]:
        ct = response.headers.get('content-type', '')
        if 'video' in ct: filename += '.mp4'
        elif 'audio' in ct: filename += '.mp3'
        elif 'pdf' in ct: filename += '.pdf'
        else: filename += '.bin'

    filepath = os.path.join(DOWNLOADS_DIR, filename)
    total_size = int(response.headers.get('content-length', 0))

    downloaded = 0

    with open(filepath, 'wb') as f:
        for chunk in response.iter_content(chunk_size=65536):
            if chunk:
                f.write(chunk)
                downloaded += len(chunk)
                if total_size > 0:
                    percent = round((downloaded / total_size * 100), 1)
                    job_manager.update_job(job_id, {
                        "status": "downloading",
                        "progress": percent,
                        "downloaded_bytes": downloaded,
                        "total_bytes": total_size
                    })

    basename = os.path.basename(filepath)
    job_manager.update_job(job_id, {
        "status": "completed",
        "progress": 100.0,
        "title": basename,
        "filename": basename,
        "filepath": filepath
    })
    return filepath
