import os
import uuid
import asyncio
import logging
import zipfile
import tempfile
from typing import List, Optional
from fastapi import FastAPI, BackgroundTasks, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from job_manager import job_manager
from downloader import fetch_media_info, download_media_job, DOWNLOADS_DIR, set_cookie_browser, get_cookie_browser

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="MediaVault API", version="1.0.0")

# Enable CORS for Vite frontend (http://localhost:5173, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class InfoRequest(BaseModel):
    url: str


class DownloadRequest(BaseModel):
    url: str
    mode: Optional[str] = "single"   # single, playlist, bulk, direct
    format_type: Optional[str] = "video"  # video, audio
    quality: Optional[str] = "Best Quality"


class BulkDownloadRequest(BaseModel):
    urls: List[str]
    format_type: Optional[str] = "video"
    quality: Optional[str] = "Best Quality"


class ZipDownloadRequest(BaseModel):
    filenames: List[str]


class CookieSettingsRequest(BaseModel):
    browser: Optional[str] = None  # 'chrome', 'firefox', 'edge', 'brave', 'opera', or null to disable


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "message": "MediaVault API is running",
        "cookie_browser": get_cookie_browser(),
        "downloads_dir": DOWNLOADS_DIR
    }


@app.get("/api/settings")
def get_settings():
    backend_dir = os.path.dirname(__file__)
    cookie_candidates = ["cookies.txt", "cookies", "youtube.com_cookies.txt", "www.youtube.com_cookies.txt"]
    cookies_file_exists = any(
        os.path.exists(os.path.join(backend_dir, f)) and
        os.path.getsize(os.path.join(backend_dir, f)) > 100
        for f in cookie_candidates
    )
    return {
        "cookie_browser": get_cookie_browser(),
        "available_browsers": ["chrome", "firefox", "edge", "brave", "opera", "chromium", "vivaldi"],
        "cookies_file_exists": cookies_file_exists
    }


@app.post("/api/settings")
def update_settings(req: CookieSettingsRequest):
    """Set which browser to pull cookies from for YouTube authentication."""
    set_cookie_browser(req.browser)
    return {
        "success": True,
        "cookie_browser": req.browser,
        "message": f"Cookie source set to: {req.browser or 'none (use cookies.txt)'}"
    }


@app.post("/api/info")
def get_info(req: InfoRequest):
    try:
        info = fetch_media_info(req.url)
        return {"success": True, "data": info}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/download")
def start_download(req: DownloadRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())[:8]
    job_manager.create_job(
        job_id=job_id,
        url=req.url,
        mode=req.mode,
        format_type=req.format_type,
        quality=req.quality
    )

    def run_job_bg():
        try:
            download_media_job(
                job_id=job_id,
                url=req.url,
                format_type=req.format_type,
                quality=req.quality,
                job_manager=job_manager
            )
        except Exception as err:
            logger.error(f"Background job {job_id} error: {err}")

    background_tasks.add_task(run_job_bg)
    return {"success": True, "job_id": job_id}


@app.post("/api/bulk-download")
def start_bulk_download(req: BulkDownloadRequest, background_tasks: BackgroundTasks):
    job_ids = []
    valid_urls = [u.strip() for u in req.urls if u.strip()]

    for url in valid_urls:
        job_id = str(uuid.uuid4())[:8]
        job_manager.create_job(
            job_id=job_id,
            url=url,
            mode="bulk",
            format_type=req.format_type,
            quality=req.quality
        )
        job_ids.append(job_id)

    def run_bulk_bg():
        for j_id, url in zip(job_ids, valid_urls):
            try:
                download_media_job(
                    job_id=j_id,
                    url=url,
                    format_type=req.format_type,
                    quality=req.quality,
                    job_manager=job_manager
                )
            except Exception as err:
                logger.error(f"Bulk item {j_id} failed: {err}")

    background_tasks.add_task(run_bulk_bg)
    return {"success": True, "job_ids": job_ids}


@app.get("/api/progress/{job_id}")
async def get_progress_stream(job_id: str):
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return EventSourceResponse(job_manager.event_generator(job_id))


@app.get("/api/files")
def list_files():
    files = []
    if os.path.exists(DOWNLOADS_DIR):
        for f in os.listdir(DOWNLOADS_DIR):
            filepath = os.path.join(DOWNLOADS_DIR, f)
            if os.path.isfile(filepath):
                stat = os.stat(filepath)
                ext = os.path.splitext(f)[1].lower().replace('.', '')
                files.append({
                    "name": f,
                    "size_bytes": stat.st_size,
                    "size_mb": round(stat.st_size / (1024 * 1024), 2),
                    "created_at": stat.st_mtime,
                    "ext": ext,
                    "is_video": ext in ['mp4', 'webm', 'mkv', 'mov', 'avi'],
                    "is_audio": ext in ['mp3', 'm4a', 'wav', 'aac', 'flac', 'ogg']
                })
    files.sort(key=lambda x: x['created_at'], reverse=True)
    return {"success": True, "files": files}


@app.get("/api/files/download/{filename}")
def stream_file(filename: str):
    filepath = os.path.join(DOWNLOADS_DIR, filename)
    if not os.path.exists(filepath) or not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(filepath, media_type="application/octet-stream", filename=filename)


@app.post("/api/files/download-zip")
def download_zip(req: ZipDownloadRequest, background_tasks: BackgroundTasks):
    if not req.filenames:
        raise HTTPException(status_code=400, detail="No filenames provided")

    # Create a temporary file for the zip
    fd, temp_path = tempfile.mkstemp(suffix=".zip", prefix="mediavault_playlist_")
    os.close(fd)

    added_files = 0
    try:
        with zipfile.ZipFile(temp_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for filename in req.filenames:
                filepath = os.path.join(DOWNLOADS_DIR, filename)
                if os.path.exists(filepath) and os.path.isfile(filepath):
                    zipf.write(filepath, arcname=filename)
                    added_files += 1

        if added_files == 0:
            os.remove(temp_path)
            raise HTTPException(status_code=404, detail="None of the requested files were found")
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=f"Error creating zip: {str(e)}")

    def cleanup():
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
                logger.info(f"Cleaned up temporary zip: {temp_path}")
            except Exception as e:
                logger.error(f"Failed to clean up temp zip {temp_path}: {e}")

    background_tasks.add_task(cleanup)
    
    # Generate a user-friendly filename for the zip
    zip_filename = f"MediaVault_Playlist_{len(req.filenames)}_items.zip"
    
    return FileResponse(
        temp_path,
        media_type="application/zip",
        filename=zip_filename
    )


@app.delete("/api/files/{filename}")
def delete_file(filename: str):
    filepath = os.path.join(DOWNLOADS_DIR, filename)
    if os.path.exists(filepath) and os.path.isfile(filepath):
        os.remove(filepath)
        return {"success": True, "message": "File deleted"}
    raise HTTPException(status_code=404, detail="File not found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8008, reload=False)
