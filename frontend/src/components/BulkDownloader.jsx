import React, { useState } from 'react';
import { Layers, Download, Video, Music, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

export default function BulkDownloader({ API_BASE, onDownloadSuccess }) {
  const [text, setText] = useState('');
  const [formatType, setFormatType] = useState('video');
  const [quality, setQuality] = useState('Best Quality');

  const [loading, setLoading] = useState(false);
  const [bulkStatus, setBulkStatus] = useState(null);
  const [error, setError] = useState(null);

  const executeDownloadJobSync = (itemUrl) => {
    return new Promise(async (resolve) => {
      try {
        const res = await fetch(`${API_BASE}/api/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: itemUrl,
            mode: 'bulk',
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
            setBulkStatus((prev) => ({
              ...prev,
              itemProgress: update.progress || 0,
              itemSpeed: update.speed || 'Downloading...',
              itemStatus: update.status,
              itemError: update.error || null,
            }));

            if (update.status === 'completed') {
              eventSource.close();
              resolve(true);
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

  const handleStartBulk = async () => {
    const urls = text
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (urls.length === 0) return;

    setLoading(true);
    setError(null);
    setBulkStatus({
      total: urls.length,
      current: 0,
      completed: 0,
      failed: 0,
      currentUrl: 'Starting bulk queue...',
      itemProgress: 0,
      itemSpeed: '0 B/s',
    });

    for (let i = 0; i < urls.length; i++) {
      const targetUrl = urls[i];
      setBulkStatus((prev) => ({
        ...prev,
        current: i + 1,
        currentUrl: targetUrl,
        itemProgress: 0,
        itemSpeed: 'Starting...',
      }));

      const isSuccess = await executeDownloadJobSync(targetUrl);

      if (isSuccess) {
        setBulkStatus((prev) => ({ ...prev, completed: prev.completed + 1 }));
      } else {
        setBulkStatus((prev) => ({ ...prev, failed: prev.failed + 1 }));
      }
    }

    setLoading(false);
    if (onDownloadSuccess) onDownloadSuccess();
  };

  const getUrlCount = () => {
    return text.split('\n').map((u) => u.trim()).filter((u) => u.length > 0).length;
  };

  return (
    <div className="w-full space-y-6">
      <div className="glass-panel p-6 sm:p-8">
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2 text-white">
          <Layers className="w-5 h-5 text-pink-400" /> Multi-Link Bulk Downloader
        </h2>
        <p className="text-sm text-gray-400 mb-6">
          Paste multiple video, audio, or file URLs below (one link per line) to batch download them sequentially onto your server.
        </p>

        <div className="space-y-4">
          <textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`https://www.youtube.com/watch?v=...\nhttps://vimeo.com/...\nhttps://example.com/audio.mp3`}
            className="input-glass font-mono text-sm leading-relaxed"
          />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            {/* Format Pickers */}
            <div className="flex items-center gap-3">
              <div className="flex rounded-xl bg-white/5 border border-white/10 p-1">
                <button
                  type="button"
                  onClick={() => setFormatType('video')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    formatType === 'video' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Video className="w-3.5 h-3.5" /> Video (MP4)
                </button>
                <button
                  type="button"
                  onClick={() => setFormatType('audio')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    formatType === 'audio' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Music className="w-3.5 h-3.5" /> Audio (MP3)
                </button>
              </div>

              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="select-glass text-xs"
              >
                {formatType === 'video' ? (
                  <>
                    <option value="Best Quality">Best Quality</option>
                    <option value="1080p">1080p</option>
                    <option value="720p">720p</option>
                  </>
                ) : (
                  <>
                    <option value="320 kbps (High)">320 kbps (High)</option>
                    <option value="128 kbps (Standard)">128 kbps</option>
                  </>
                )}
              </select>
            </div>

            <button
              type="button"
              disabled={loading || getUrlCount() === 0}
              onClick={handleStartBulk}
              className="btn-primary py-2.5 px-6 text-sm flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Download All ({getUrlCount()} Links)
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>{error}</div>
          </div>
        )}
      </div>

      {/* Progress status */}
      {bulkStatus && (
        <div className="glass-panel p-6 space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 font-semibold text-white">
              {loading ? (
                <RefreshCw className="w-4 h-4 text-pink-400 animate-spin" />
              ) : (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              )}
              <span>Bulk Item {bulkStatus.current} of {bulkStatus.total}</span>
            </div>
            <span className="font-mono font-bold text-pink-400">
              {bulkStatus.itemProgress || 0}%
            </span>
          </div>

          <div className="w-full bg-black/60 rounded-full h-3.5 overflow-hidden p-0.5 border border-white/10">
            <div
              className="progress-bar-fill"
              style={{ width: `${bulkStatus.itemProgress || 0}%` }}
            ></div>
          </div>

          <p className="text-xs text-gray-400 font-mono truncate">
            Active Link: <span className="text-gray-200">{bulkStatus.currentUrl}</span>
          </p>

          <div className="flex gap-4 text-xs text-gray-400">
            <span>Saved Files: <strong className="text-emerald-400">{bulkStatus.completed}</strong></span>
            <span>Failed / Skipped: <strong className="text-red-400">{bulkStatus.failed}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
