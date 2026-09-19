import React, { useState, useEffect } from 'react';
import { ListVideo, CheckSquare, Square, Download, Video, Music, Sparkles, RefreshCw, AlertCircle, Clock, CheckCircle, Zap, ShieldCheck, Timer, FolderDown } from 'lucide-react';

export default function PlaylistExtractor({ API_BASE, onDownloadSuccess }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [playlist, setPlaylist] = useState(null);
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [error, setError] = useState(null);

  const [formatType, setFormatType] = useState('video');
  const [quality, setQuality] = useState('Best Quality');

  const [batchDownloading, setBatchDownloading] = useState(false);
  const [batchStatus, setBatchStatus] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [completedFiles, setCompletedFiles] = useState([]);

  // Timer for batch elapsed time counter
  useEffect(() => {
    let interval = null;
    if (batchDownloading) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [batchDownloading]);

  const handleFetchPlaylist = async (e) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setPlaylist(null);
    setBatchStatus(null);

    try {
      const res = await fetch(`${API_BASE}/api/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.detail || 'Could not parse playlist info');
      }

      if (data.data.type !== 'playlist') {
        throw new Error('This URL is a single video, not a playlist. Switch to the Single Media tab!');
      }

      setPlaylist(data.data);
      if (data.data.entries) {
        setSelectedIndices(data.data.entries.map((_, idx) => idx));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (!playlist || !playlist.entries) return;
    if (selectedIndices.length === playlist.entries.length) {
      setSelectedIndices([]);
    } else {
      setSelectedIndices(playlist.entries.map((_, idx) => idx));
    }
  };

  const toggleSelectIndex = (idx) => {
    if (selectedIndices.includes(idx)) {
      setSelectedIndices(selectedIndices.filter((i) => i !== idx));
    } else {
      setSelectedIndices([...selectedIndices, idx]);
    }
  };

  const estimateTime = (count, format) => {
    if (format === 'audio') {
      const seconds = count * 5; // ~5 secs per audio track
      if (seconds < 60) return `~${seconds} seconds`;
      const m = Math.floor(seconds / 60);
      return `~${m} minute${m > 1 ? 's' : ''}`;
    } else {
      const seconds = count * 20; // ~20 secs per 1080p video
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return m > 0 ? `~${m}m ${s}s` : `~${s} seconds`;
    }
  };

  // Helper to wait until a single item download job completes via SSE stream
  const executeDownloadJobSync = (itemUrl, onProgressUpdate) => {
    return new Promise(async (resolve) => {
      try {
        const res = await fetch(`${API_BASE}/api/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: itemUrl,
            mode: 'playlist',
            format_type: formatType,
            quality: quality,
          }),
        });
        const data = await res.json();
        if (!data.success || !data.job_id) {
          resolve(false);
          return;
        }

        const jobId = data.job_id;
        const eventSource = new EventSource(`${API_BASE}/api/progress/${jobId}`);

        eventSource.addEventListener('update', (e) => {
          try {
            // sse_starlette sends job data directly as JSON string in e.data
            const update = JSON.parse(e.data);
            if (!update || typeof update !== 'object') return;
            if (onProgressUpdate) onProgressUpdate(update);

            if (update.status === 'completed') {
              eventSource.close();
              resolve(update.filename || true);
            } else if (update.status === 'error') {
              eventSource.close();
              resolve(false);
            }
          } catch (err) {
            console.error('SSE parse error:', err, e.data);
          }
        });

        eventSource.onerror = () => {
          eventSource.close();
          resolve(false);
        };
      } catch (err) {
        console.error('Job error:', err);
        resolve(false);
      }
    });
  };

  const handleStartBatchDownload = async () => {
    if (!playlist || selectedIndices.length === 0) return;

    setBatchDownloading(true);
    setElapsedSeconds(0);
    setError(null);

    const itemsToDownload = selectedIndices.map((idx) => playlist.entries[idx]);
    setBatchStatus({
      total: itemsToDownload.length,
      current: 0,
      completed: 0,
      failed: 0,
      currentTitle: 'Initializing batch queue...',
      itemProgress: 0,
      itemSpeed: '0 B/s',
    });

    // Reset completed files list for new batch
    setCompletedFiles([]);
    
    for (let i = 0; i < itemsToDownload.length; i++) {
      const item = itemsToDownload[i];
      setBatchStatus((prev) => ({
        ...prev,
        current: i + 1,
        currentTitle: item.title,
        itemProgress: 0,
        itemSpeed: 'Starting...',
      }));

      const result = await executeDownloadJobSync(item.url, (update) => {
        setBatchStatus((prev) => ({
          ...prev,
          itemProgress: update.progress || 0,
          itemSpeed: update.speed || 'Downloading...',
        }));
      });

      if (result) {
        setBatchStatus((prev) => ({ ...prev, completed: prev.completed + 1 }));
        if (typeof result === 'string') {
          // Store the downloaded filename mapped to the item index
          setCompletedFiles((prev) => {
            const newList = [...prev];
            newList[selectedIndices[i]] = result;
            return newList;
          });
        }
      } else {
        setBatchStatus((prev) => ({ ...prev, failed: prev.failed + 1 }));
      }
    }

    setBatchDownloading(false);
    if (onDownloadSuccess) onDownloadSuccess();
  };

  const handleDownloadZip = async () => {
    const filenames = completedFiles.filter(Boolean);
    if (filenames.length === 0) return;

    try {
      const res = await fetch(`${API_BASE}/api/files/download-zip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filenames })
      });

      if (!res.ok) {
        console.error('Failed to create zip');
        return;
      }

      // Create a blob URL to trigger the browser download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `MediaVault_Playlist_${filenames.length}_items.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('ZIP download error:', err);
    }
  };

  const formatDuration = (secs) => {
    if (!secs) return 'N/A';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-full space-y-6">
      {/* Input Hero Card */}
      <div className="glass-panel p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <ListVideo className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-heading tracking-tight">Playlist Extractor & Selective Downloader</h2>
            <p className="text-xs text-muted">Instantly index full playlists, select tracks, and batch download in audio/video format</p>
          </div>
        </div>

        <form onSubmit={handleFetchPlaylist} className="mt-5 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste Playlist URL (e.g. https://www.youtube.com/playlist?list=...)"
            className="input-glass flex-1"
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="btn-primary"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Indexing Playlist...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" /> Extract Playlist
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold block mb-0.5">Playlist Extraction Error</strong>
              {error}
            </div>
          </div>
        )}
      </div>

      {/* Playlist Items & Selection Checklist */}
      {playlist && (
        <div className="glass-panel p-6 sm:p-8 space-y-6 animate-fadeIn">
          {/* Header Info */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/10">
            <div>
              <span className="inline-block text-[11px] font-bold tracking-wider uppercase px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 mb-2">
                Playlist Indexing Complete
              </span>
              <h3 className="text-2xl font-extrabold text-white leading-snug">{playlist.title}</h3>
              <p className="text-xs text-gray-400 mt-1">
                Channel: <span className="text-gray-200 font-semibold">{playlist.uploader}</span> •{' '}
                <span className="text-cyan-400 font-bold">{playlist.item_count} Tracks Found</span>
              </p>
            </div>

            {/* Batch Format & Quality Controls */}
            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-3 shrink-0">
              <span className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider">Global Batch Format</span>
              <div className="flex flex-wrap items-center gap-3">
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white/5 border border-white/10">
                  <button
                    type="button"
                    onClick={() => setFormatType('video')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      formatType === 'video' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5 text-indigo-300" /> Video (MP4)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormatType('audio')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      formatType === 'audio' ? 'bg-pink-600 text-white shadow' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Music className="w-3.5 h-3.5 text-pink-300" /> Audio (MP3)
                  </button>
                </div>

                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  className="select-glass text-xs py-2"
                >
                  {formatType === 'video' ? (
                    <>
                      <option value="Best Quality">Best Quality</option>
                      <option value="1080p">1080p Full HD</option>
                      <option value="720p">720p HD</option>
                    </>
                  ) : (
                    <>
                      <option value="320 kbps (High)">320 kbps (High)</option>
                      <option value="256 kbps (Medium)">256 kbps (Medium)</option>
                      <option value="128 kbps (Standard)">128 kbps</option>
                    </>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Action Bar & Time Estimate Card */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="btn-secondary py-2 px-3 text-xs"
              >
                {selectedIndices.length === playlist.entries.length ? (
                  <>
                    <CheckSquare className="w-4 h-4 text-indigo-400" /> Deselect All
                  </>
                ) : (
                  <>
                    <Square className="w-4 h-4 text-gray-400" /> Select All ({playlist.entries.length})
                  </>
                )}
              </button>

              <span className="text-xs text-gray-300 font-medium">
                <strong className="text-cyan-400 font-bold text-sm">{selectedIndices.length}</strong> of {playlist.entries.length} items selected
              </span>
            </div>

            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
              <div className="text-right text-xs text-gray-400 hidden sm:block">
                <span className="block text-[10px] uppercase font-semibold text-gray-500">Estimated Batch Time</span>
                <span className="font-bold text-indigo-300 flex items-center justify-end gap-1">
                  <Timer className="w-3.5 h-3.5" />
                  {estimateTime(selectedIndices.length, formatType)}
                </span>
              </div>

              <button
                type="button"
                disabled={batchDownloading || selectedIndices.length === 0}
                onClick={handleStartBatchDownload}
                className="btn-primary py-2.5 px-6 text-sm"
              >
                <Download className="w-4 h-4" /> Download Selected ({selectedIndices.length})
              </button>
            </div>
          </div>

          {/* Video List Table */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
            {playlist.entries.map((item, idx) => {
              const isSelected = selectedIndices.includes(idx);
              return (
                <div
                  key={idx}
                  onClick={() => toggleSelectIndex(idx)}
                  className={`flex items-center gap-4 p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500/40 text-white shadow-md'
                      : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <button type="button" className="text-indigo-400 shrink-0">
                    {isSelected ? <CheckSquare className="w-5 h-5 text-indigo-400" /> : <Square className="w-5 h-5 text-gray-600" />}
                  </button>

                  <span className="text-xs font-mono font-bold text-gray-500 w-6 shrink-0">#{idx + 1}</span>

                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt={item.title} className="w-16 h-10 object-cover rounded-lg bg-black/40 shrink-0 border border-white/10" />
                  ) : (
                    <div className="w-16 h-10 bg-gray-800 rounded-lg shrink-0 flex items-center justify-center text-[10px] text-gray-500">No img</div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-white truncate">{item.title}</h4>
                    <p className="text-xs text-gray-400 truncate">{item.uploader}</p>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {item.duration > 0 && (
                      <span className="text-xs text-gray-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5 text-gray-500" /> {formatDuration(item.duration)}
                      </span>
                    )}
                    {completedFiles[idx] && (
                      <a
                        href={`${API_BASE}/api/files/download/${encodeURIComponent(completedFiles[idx])}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-primary py-1 px-3 mt-1 text-[10px] uppercase font-bold flex items-center gap-1.5 shadow"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download className="w-3 h-3" /> Save File
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Batch Progress Bar Widget */}
      {batchStatus && (
        <div className="glass-panel p-6 space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
                {batchDownloading ? (
                  <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  Downloading Item {batchStatus.current} of {batchStatus.total} ({Math.round((batchStatus.completed / batchStatus.total) * 100)}%)
                </h4>
                <p className="text-xs text-gray-400 truncate max-w-md">
                  Active: <span className="text-gray-200 font-semibold">{batchStatus.currentTitle}</span>
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="font-mono text-xs font-semibold text-cyan-400 block">
                {batchStatus.itemSpeed}
              </span>
              <span className="font-mono text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
                {batchStatus.itemProgress || 0}%
              </span>
            </div>
          </div>

          <div className="w-full bg-black/60 rounded-full h-3.5 overflow-hidden p-0.5 border border-white/10">
            <div
              className="progress-bar-fill"
              style={{ width: `${batchStatus.itemProgress || 0}%` }}
            ></div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs text-gray-400 pt-1">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
              <span className="block text-[10px] uppercase text-gray-500">Saved Files</span>
              <strong className="text-emerald-400 text-sm font-bold">{batchStatus.completed}</strong>
            </div>

            <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
              <span className="block text-[10px] uppercase text-gray-500">Failed / Skipped</span>
              <strong className="text-red-400 text-sm font-bold">{batchStatus.failed}</strong>
            </div>

            <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
              <span className="block text-[10px] uppercase text-gray-500">Total Time Elapsed</span>
              <strong className="text-white text-sm font-bold">{formatDuration(elapsedSeconds)}</strong>
            </div>
          </div>

          {!batchDownloading && batchStatus.completed > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm animate-fadeIn">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 shrink-0" />
                <span className="font-medium text-white">Batch extraction finished successfully!</span>
              </div>
              <button
                type="button"
                onClick={handleDownloadZip}
                className="btn-primary py-2 px-5 text-xs flex items-center gap-2"
              >
                <FolderDown className="w-4 h-4" /> Download as ZIP ({batchStatus.completed} files)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
