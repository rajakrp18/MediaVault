import asyncio
import time
from typing import Dict, Any, AsyncGenerator

class JobManager:
    def __init__(self):
        self.jobs: Dict[str, Dict[str, Any]] = {}
        self.listeners: Dict[str, list[asyncio.Queue]] = {}

    def create_job(self, job_id: str, url: str, mode: str, format_type: str, quality: str) -> Dict[str, Any]:
        job_data = {
            "job_id": job_id,
            "url": url,
            "mode": mode, # 'single', 'playlist', 'bulk', 'direct'
            "format_type": format_type, # 'audio', 'video'
            "quality": quality,
            "status": "queued", # queued, downloading, processing, completed, error
            "progress": 0.0,
            "speed": "0 B/s",
            "eta": "Unknown",
            "downloaded_bytes": 0,
            "total_bytes": 0,
            "filename": None,
            "filepath": None,
            "error": None,
            "title": "Initializing...",
            "thumbnail": None,
            "created_at": time.time()
        }
        self.jobs[job_id] = job_data
        self.listeners[job_id] = []
        return job_data

    def get_job(self, job_id: str) -> Dict[str, Any]:
        return self.jobs.get(job_id)

    def update_job(self, job_id: str, updates: Dict[str, Any]):
        if job_id in self.jobs:
            self.jobs[job_id].update(updates)
            self._notify_listeners(job_id)

    def subscribe(self, job_id: str) -> asyncio.Queue:
        queue = asyncio.Queue()
        if job_id not in self.listeners:
            self.listeners[job_id] = []
        self.listeners[job_id].append(queue)
        
        # Send initial state immediately
        if job_id in self.jobs:
            queue.put_nowait(self.jobs[job_id])
            
        return queue

    def unsubscribe(self, job_id: str, queue: asyncio.Queue):
        if job_id in self.listeners and queue in self.listeners[job_id]:
            self.listeners[job_id].remove(queue)

    def _notify_listeners(self, job_id: str):
        if job_id in self.listeners and job_id in self.jobs:
            data = dict(self.jobs[job_id])
            for queue in self.listeners[job_id]:
                try:
                    queue.put_nowait(data)
                except asyncio.QueueFull:
                    pass

    async def event_generator(self, job_id: str) -> AsyncGenerator[Dict[str, Any], None]:
        queue = self.subscribe(job_id)
        try:
            while True:
                data = await queue.get()
                yield {
                    "event": "update",
                    "data": data
                }
                if data.get("status") in ["completed", "error"]:
                    break
        finally:
            self.unsubscribe(job_id, queue)

job_manager = JobManager()
