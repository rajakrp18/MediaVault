import React, { useState, useEffect } from 'react';
import { Search, Download, Video, Music, Sparkles, AlertCircle, Clock, Eye, CheckCircle, RefreshCw, Zap, Gauge } from 'lucide-react';

export default function SingleDownloader({ API_BASE, onDownloadSuccess }) {
  const [url, setUrl] = useState('');
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [mediaInfo, setMediaInfo] = useState(null);
  const [error, setError] = useState(null);

  const [formatType, setFormatType] = useState('video'); // 'video' or 'audio'
  const [quality, setQuality] = useState('Best Quality');

  const [downloading, setDownloading] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [progressData, setProgressData] = useState(null);

  const handleFetchInfo = async (e) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;

    setLoadingInfo(true);
    setError(null);
    setMediaInfo(null);
    setProgressData(null);

    try {
      const res = await fetch(`${API_BASE}/api/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.detail || 'Could not parse media details');
      }

      setMediaInfo(data.data);
      if (data.data.type === 'single') {
        if (formatType === 'video' && data.data.video_qualities?.length > 0) {
          setQuality(data.data.video_qualities[0]);
        } else if (formatType === 'audio' && data.data.audio_qualities?.length > 0) {
          setQuality(data.data.audio_qualities[0]);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch media info. Please check the URL.');
    } finally {
      setLoadingInfo(false);
    }
  };

  const handleStartDownload = async () => {
    if (!url.trim()) return;

    setDownloading(true);
    setError(null);
    setProgressData({ status: 'queued', progress: 0, speed: 'Initializing stream...', eta: 'Calculating...' });

    try {
      const res = await fetch(`${API_BASE}/api/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          mode: 'single',
          format_type: formatType,
          quality: quality
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.detail || 'Failed to queue download job');
      }

      setJobId(data.job_id);
    } catch (err) {
      setError(err.message);
      setDownloading(false);
    }
  };

  // Listen to SSE progress updates
  useEffect(() => {
    if (!jobId) return;

    const eventSource = new EventSource(`${API_BASE}/api/progress/${jobId}`);

    // job_manager yields named 'update' events — must use addEventListener, not onmessage
    eventSource.addEventListener('update', (e) => {
      try {
        const update = JSON.parse(e.data);
        if (!update || typeof update !== 'object') return;
        setProgressData(update);

        if (update.status === 'completed') {
          setDownloading(false);
          eventSource.close();
          if (onDownloadSuccess) onDownloadSuccess();
        } else if (update.status === 'error') {
          setError(update.error || 'Download failed. Check if cookies are configured in Settings.');
          setDownloading(false);
          eventSource.close();
        }
      } catch (err) {
        console.error('Error parsing SSE event:', err, e.data);
      }
    });

    eventSource.onerror = (err) => {
      console.error('SSE Error:', err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [jobId, API_BASE]);

  const formatDuration = (secs) => {
    if (!secs) return 'N/A';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes <= 0) return '0 MB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="w-full space-y-6">
      {/* Input Hero Card */}
      <div className="glass-panel p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-heading tracking-tight">Single Media Downloader</h2>
            <p className="text-xs text-muted">Download high quality video (MP4) or extract audio (MP3 320kbps)</p>
          </div>
        </div>

        <form onSubmit={handleFetchInfo} className="mt-5 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste video or audio URL (YouTube, Vimeo, Twitter/X, TikTok...)"
              className="input-glass pr-20"
            />
            {url && (
              <button
                type="button"
                onClick={() => { setUrl(''); setMediaInfo(null); setError(null); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-800 text-gray-400 hover:text-white border border-white/10"
              >
                Clear
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loadingInfo || !url.trim()}
            className="btn-primary"
          >
            {loadingInfo ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Extracting...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" /> Fetch Options
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold block mb-0.5">Media Extraction Error</strong>
              {error}
            </div>
          </div>
        )}
      </div>

      {/* Metadata Preview Card */}
      {mediaInfo && (
        <div className="glass-panel p-6 sm:p-8 animate-fadeIn">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Thumbnail */}
            {mediaInfo.thumbnail && (
              <div className="relative w-full lg:w-80 aspect-video rounded-2xl overflow-hidden bg-black/60 border border-white/10 shrink-0 shadow-2xl">
                <img
                  src={mediaInfo.thumbnail}
                  alt={mediaInfo.title}
                  className="w-full h-full object-cover"
                />
                {mediaInfo.duration > 0 && (
                  <div className="absolute bottom-3 right-3 px-2.5 py-1 bg-black/85 text-white text-xs font-bold rounded-lg backdrop-blur-md border border-white/10 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    {formatDuration(mediaInfo.duration)}
                  </div>
                )}
              </div>
            )}

            {/* Content Details & Options */}
            <div className="flex-1 space-y-4">
              <div>
                <span className="inline-block text-[11px] font-bold tracking-wider uppercase px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mb-2">
                  {mediaInfo.type === 'playlist' ? 'Playlist Link' : 'Media Track'}
                </span>
                <h3 className="text-xl font-bold text-white leading-snug line-clamp-2">{mediaInfo.title}</h3>
                <p className="text-xs text-gray-400 mt-1">Channel / Creator: <span className="text-gray-200 font-semibold">{mediaInfo.uploader}</span></p>
              </div>

              {/* Format Selectors */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Download Format</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFormatType('video');
                          if (mediaInfo.video_qualities?.length > 0) setQuality(mediaInfo.video_qualities[0]);
                        }}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                          formatType === 'video'
                            ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                        }`}
                      >
                        <Video className="w-4 h-4 text-indigo-400" /> Video (MP4)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFormatType('audio');
                          if (mediaInfo.audio_qualities?.length > 0) setQuality(mediaInfo.audio_qualities[0]);
                        }}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                          formatType === 'audio'
                            ? 'bg-pink-600/30 border-pink-500 text-white shadow-lg shadow-pink-500/25'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                        }`}
                      >
                        <Music className="w-4 h-4 text-pink-400" /> Audio (MP3)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Quality Preset</label>
                    <select
                      value={quality}
                      onChange={(e) => setQuality(e.target.value)}
                      className="select-glass w-full py-2.5"
                    >
                      {formatType === 'video' ? (
                        mediaInfo.video_qualities?.map((q) => (
                          <option key={q} value={q}>{q}</option>
                        )) || <option value="Best Quality">Best Quality</option>
                      ) : (
                        mediaInfo.audio_qualities?.map((q) => (
                          <option key={q} value={q}>{q}</option>
                        )) || <option value="320 kbps (High)">320 kbps (High)</option>
                      )}
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10">
                  <span className="text-xs text-gray-400">
                    Target: <strong className="text-indigo-300 font-bold">{formatType === 'video' ? 'MP4 Video' : 'MP3 Audio'} ({quality})</strong>
                  </span>
                  <button
                    type="button"
                    disabled={downloading}
                    onClick={handleStartDownload}
                    className="btn-primary text-sm py-2.5 px-6 w-full sm:w-auto"
                  >
                    <Download className="w-4 h-4" /> Start Download Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Progress Bar Widget */}
      {progressData && (
        <div className="glass-panel p-6 space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                {progressData.status === 'completed' ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                ) : (
                  <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold text-white capitalize">{progressData.status}</h4>
                <p className="text-xs text-gray-400">
                  {progressData.total_bytes > 0
                    ? `${formatBytes(progressData.downloaded_bytes)} of ${formatBytes(progressData.total_bytes)} downloaded`
                    : 'Stream starting...'}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="font-mono text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
                {progressData.progress || 0}%
              </span>
            </div>
          </div>

          {/* Glowing Animated Progress Bar */}
          <div className="w-full bg-black/60 rounded-full h-3.5 overflow-hidden p-0.5 border border-white/10 relative">
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.min(100, Math.max(0, progressData.progress || 0))}%` }}
            ></div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs text-gray-400">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-400" />
              <div>
                <span className="block text-[10px] text-gray-500 uppercase">Speed</span>
                <span className="font-semibold text-white">{progressData.speed || 'Calculating...'}</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-cyan-400" />
              <div>
                <span className="block text-[10px] text-gray-500 uppercase">ETA</span>
                <span className="font-semibold text-white">{progressData.eta || 'Calculating...'}</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2 col-span-2 sm:col-span-1">
              <Clock className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="block text-[10px] text-gray-500 uppercase">Status</span>
                <span className="font-semibold text-emerald-400 capitalize">{progressData.status}</span>
              </div>
            </div>
          </div>

          {progressData.status === 'completed' && (
            <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 shrink-0" />
                <span className="font-medium">File successfully saved to server library!</span>
              </div>
              {progressData.filename && (
                <a
                  href={`${API_BASE}/api/files/download/${encodeURIComponent(progressData.filename)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary py-2 px-4 text-xs flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" /> Save File to Device
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
