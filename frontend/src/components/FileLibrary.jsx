import React, { useState, useEffect } from 'react';
import { FolderDown, Video, Music, Download, Trash2, Play, Pause, RefreshCw, HardDrive, FileText } from 'lucide-react';

export default function FileLibrary({ API_BASE }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all, video, audio
  const [search, setSearch] = useState('');
  const [activeMedia, setActiveMedia] = useState(null); // Currently playing file

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/files`);
      const data = await res.json();
      if (data.success) {
        setFiles(data.files);
      }
    } catch (err) {
      console.error('Error fetching downloads list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [API_BASE]);

  const handleDelete = async (filename) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/files/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setFiles(files.filter((f) => f.name !== filename));
        if (activeMedia?.name === filename) setActiveMedia(null);
      }
    } catch (err) {
      alert('Could not delete file');
    }
  };

  const filteredFiles = files.filter((f) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'video' && f.is_video) ||
      (filter === 'audio' && f.is_audio);
    const matchesSearch = f.name.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const formatDate = (ts) => {
    const d = new Date(ts * 1000);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-full space-y-6">
      <div className="glass-panel p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
              <FolderDown className="w-5 h-5 text-emerald-400" /> Saved Downloads Library
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Browse, preview, download, or manage media files saved on your server.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchFiles}
            disabled={loading}
            className="btn-secondary py-2 px-4 text-xs self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh List
          </button>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search saved files..."
            className="input-glass py-2 text-sm flex-1"
          />

          <div className="flex rounded-xl bg-white/5 border border-white/10 p-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold ${
                filter === 'all' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              All ({files.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('video')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold ${
                filter === 'video' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Videos ({files.filter((f) => f.is_video).length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('audio')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold ${
                filter === 'audio' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Audio ({files.filter((f) => f.is_audio).length})
            </button>
          </div>
        </div>

        {/* Media Preview Player */}
        {activeMedia && (
          <div className="mb-6 p-4 rounded-2xl bg-black/60 border border-indigo-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white truncate flex items-center gap-2">
                {activeMedia.is_video ? <Video className="w-4 h-4 text-indigo-400" /> : <Music className="w-4 h-4 text-pink-400" />}
                Playing: {activeMedia.name}
              </h4>
              <button
                type="button"
                onClick={() => setActiveMedia(null)}
                className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400 hover:text-white"
              >
                Close Player
              </button>
            </div>

            {activeMedia.is_video ? (
              <video
                src={`${API_BASE}/api/files/download/${encodeURIComponent(activeMedia.name)}`}
                controls
                autoPlay
                className="w-full max-h-[400px] rounded-xl bg-black border border-white/10"
              />
            ) : (
              <audio
                src={`${API_BASE}/api/files/download/${encodeURIComponent(activeMedia.name)}`}
                controls
                autoPlay
                className="w-full mt-2"
              />
            )}
          </div>
        )}

        {/* Files Grid / List */}
        {filteredFiles.length === 0 ? (
          <div className="py-12 text-center text-gray-500 space-y-2">
            <HardDrive className="w-12 h-12 mx-auto text-gray-600" />
            <p className="text-sm font-medium">No saved files found in your library.</p>
            <p className="text-xs text-gray-600">Downloads will appear here automatically when completed.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
            {filteredFiles.map((file) => (
              <div
                key={file.name}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl glass-card border border-white/5 hover:border-white/10 transition-all"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`p-3 rounded-xl shrink-0 ${
                    file.is_video ? 'bg-indigo-500/20 text-indigo-400' : file.is_audio ? 'bg-pink-500/20 text-pink-400' : 'bg-cyan-500/20 text-cyan-400'
                  }`}>
                    {file.is_video ? <Video className="w-5 h-5" /> : file.is_audio ? <Music className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-white truncate">{file.name}</h4>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                      <span className="font-semibold text-indigo-300">{file.size_mb} MB</span>
                      <span>•</span>
                      <span>{formatDate(file.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  {(file.is_video || file.is_audio) && (
                    <button
                      type="button"
                      onClick={() => setActiveMedia(file)}
                      className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" /> Play
                    </button>
                  )}

                  <a
                    href={`${API_BASE}/api/files/download/${encodeURIComponent(file.name)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Save
                  </a>

                  <button
                    type="button"
                    onClick={() => handleDelete(file.name)}
                    className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all"
                    title="Delete file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
