# 🚀 MediaVault - Universal Video, Audio & Playlist Downloader

**MediaVault** is an aesthetic, high-performance web application designed to download videos, playlists, multi-link batches, and direct media files in both **Audio** (MP3 320kbps, M4A, WAV) and **Video** (4K, 1080p, 720p MP4) formats with real-time progress tracking, instantaneous playlist flat-indexing, and an in-browser media library.

---

## 🎨 Aesthetic Creator Color Palettes
MediaVault features built-in theme presets inspired by modern creator aesthetic palettes:
- **🖤 Black & Silver (Noir Luxury)**: Dark luxury branding with crisp silver highlights (`#0D0D0D`, `#2B2B2B`, `#8E8E8E`).
- **🌊 Navy & Soft Blue**: Professional, modern, trustworthy studio aesthetic (`#0F1E3A`, `#1E2F4F`, `#8DB4D6`).
- **🌿 Sage & Cream**: Calm, minimal, lifestyle creator palette (`#F2F5EF`, `#A8B5A0`).
- **⚡ Neon Cyber**: Sleek dark mode with glassmorphism glow (`#060913`, `#6366F1`, `#06B6D4`).

---

## 🛠️ Technology Stack Breakdown

### Backend Stack
- **Python 3.13**: Core runtime for asynchronous server logic.
- **FastAPI**: Modern, fast web framework for REST API endpoints and background tasks.
- **Uvicorn**: High-performance ASGI server implementation.
- **yt-dlp**: Powerful Python library supporting media extraction across 1,000+ streaming sites.
- **static-ffmpeg**: Self-contained, portable binary provider for FFmpeg (handles video merging, audio conversion, and bitrate encoding).
- **sse-starlette**: Server-Sent Events (SSE) streaming engine for real-time progress updates.

### Frontend Stack
- **React 18 + Vite 8**: Ultra-fast Single Page Application (SPA) framework and build system.
- **Tailwind CSS v4**: Utility-first CSS framework with dynamic CSS custom properties for instant theme switching.
- **Lucide React**: Crisp modern icon system.
- **Glassmorphism Design System**: Custom backdrop blur panels, responsive flex/grid layouts, glowing progress bars, and floating badges.

---

## 📁 Directory Structure

```
c:\yt_downloader/
├── backend/
│   ├── main.py              # FastAPI application server & API routes
│   ├── downloader.py        # yt-dlp wrapper, flat playlist extractor & fallback stream engine
│   ├── job_manager.py       # Async job queue & SSE progress event generator
│   ├── requirements.txt     # Python backend dependencies
│   └── downloads/           # Saved media storage directory
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx           # App branding & Aesthetic Theme Switcher
│   │   │   ├── SingleDownloader.jsx # Single URL preview & format options
│   │   │   ├── PlaylistExtractor.jsx# Instant playlist flat indexer & batch checklist
│   │   │   ├── BulkDownloader.jsx   # Multi-link batch downloader
│   │   │   └── FileLibrary.jsx      # Server file browser & HTML5 player
│   │   ├── App.jsx                  # Main tab router & theme controller
│   │   ├── index.css                # CSS custom properties & theme tokens
│   │   └── main.jsx                 # React DOM root
│   ├── package.json
│   └── vite.config.js
└── run.py                       # One-click unified launcher script
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python 3.10+** (Python 3.13 installed)
- **Node.js 18+** & `npm`

### One-Click Launch
Run the unified python script from the root directory:
```bash
python run.py
```
This automatically starts:
- **Backend API**: `http://localhost:8008`
- **Web UI**: `http://localhost:5174` (or `http://localhost:5173`)

---

## 📡 API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Health check endpoint returning API status |
| `/api/info` | `POST` | Fetches metadata (title, thumbnail, duration, view count) or instant flat playlist index |
| `/api/download` | `POST` | Queues single video or playlist track download job |
| `/api/bulk-download` | `POST` | Queues multi-link URL list |
| `/api/progress/{job_id}` | `GET` | SSE stream returning live download percentage, MB/s speed, ETA |
| `/api/files` | `GET` | Lists all saved media files in `backend/downloads/` |
| `/api/files/download/{filename}` | `GET` | Direct stream/download endpoint for saved files |
| `/api/files/{filename}` | `DELETE` | Deletes file from server storage |

---

## ⚡ Performance & Download Benchmarks

- **Playlist Flat Indexing**: Under **1 second** for playlists with 50 to 100+ videos.
- **Audio Extraction (MP3 320kbps)**: ~**3-5 seconds** per track.
- **Full HD Video (1080p MP4)**: ~**15-30 seconds** per track.
