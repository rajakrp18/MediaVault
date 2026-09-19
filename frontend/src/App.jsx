import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import SingleDownloader from './components/SingleDownloader';
import PlaylistExtractor from './components/PlaylistExtractor';
import BulkDownloader from './components/BulkDownloader';
import FileLibrary from './components/FileLibrary';
import CookieSettings from './components/CookieSettings';

import { Video, ListVideo, Layers, FolderDown, ShieldCheck, Zap, Globe, Settings } from 'lucide-react';

// Auto-detect backend: always port 8008 on the same host as the frontend
const API_BASE = `${window.location.protocol}//${window.location.hostname}:8008`;

export default function App() {
  const [activeTab, setActiveTab] = useState('single');
  const [libraryRefreshTrigger, setLibraryRefreshTrigger] = useState(0);
  const [theme, setTheme] = useState('noir'); // noir, navy, sage, neon
  const [showSettings, setShowSettings] = useState(false);
  const [cookieBrowser, setCookieBrowser] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Load current cookie setting on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/settings`)
      .then(r => r.json())
      .then(data => setCookieBrowser(data.cookie_browser || null))
      .catch(() => {});
  }, []);

  const handleDownloadSuccess = () => {
    setLibraryRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between pb-12 transition-colors duration-300">
      <div>
        {/* Header with Theme Switcher */}
        <Header currentTheme={theme} onThemeChange={setTheme} />

        {/* Main Application Container */}
        <main className="w-full max-w-6xl mx-auto px-4 space-y-6">
          {/* Top Navigation Tabs + Settings Button */}
          <div className="glass-panel p-2 flex flex-wrap gap-2 justify-between items-center">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                id="tab-single"
                onClick={() => setActiveTab('single')}
                className={`nav-tab ${activeTab === 'single' ? 'active' : ''}`}
              >
                <Video className="w-4 h-4" />
                <span>Single Media</span>
              </button>

              <button
                type="button"
                id="tab-playlist"
                onClick={() => setActiveTab('playlist')}
                className={`nav-tab ${activeTab === 'playlist' ? 'active' : ''}`}
              >
                <ListVideo className="w-4 h-4" />
                <span>Playlist</span>
              </button>

              <button
                type="button"
                id="tab-bulk"
                onClick={() => setActiveTab('bulk')}
                className={`nav-tab ${activeTab === 'bulk' ? 'active' : ''}`}
              >
                <Layers className="w-4 h-4" />
                <span>Bulk Links</span>
              </button>

              <button
                type="button"
                id="tab-library"
                onClick={() => setActiveTab('library')}
                className={`nav-tab ${activeTab === 'library' ? 'active' : ''}`}
              >
                <FolderDown className="w-4 h-4" />
                <span>Library</span>
              </button>
            </div>

            {/* Settings Button */}
            <button
              type="button"
              id="open-settings-btn"
              onClick={() => setShowSettings(true)}
              title="Cookie Settings (required for YouTube)"
              className={`nav-tab flex items-center gap-2 ${cookieBrowser ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' : 'text-amber-400 border-amber-500/40 bg-amber-500/10'}`}
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">{cookieBrowser ? `🍪 ${cookieBrowser}` : '⚙️ Setup Cookies'}</span>
              <span className="sm:hidden">⚙️</span>
            </button>
          </div>

          {/* Cookie Warning Banner (if no cookies configured) */}
          {!cookieBrowser && (
            <div
              className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-sm cursor-pointer hover:bg-amber-500/15 transition-colors"
              onClick={() => setShowSettings(true)}
            >
              <div className="flex items-center gap-2 text-amber-300">
                <span className="text-base">⚠️</span>
                <span><strong>YouTube downloads may fail</strong> — Click here to configure browser cookies so yt-dlp can authenticate with YouTube.</span>
              </div>
              <button type="button" className="text-xs font-bold text-amber-400 border border-amber-500/40 px-3 py-1 rounded-lg hover:bg-amber-500/20 shrink-0 whitespace-nowrap">
                Fix Now →
              </button>
            </div>
          )}

          {/* Active Tab Content View */}
          <div className="transition-all duration-300">
            {activeTab === 'single' && (
              <SingleDownloader API_BASE={API_BASE} onDownloadSuccess={handleDownloadSuccess} />
            )}
            {activeTab === 'playlist' && (
              <PlaylistExtractor API_BASE={API_BASE} onDownloadSuccess={handleDownloadSuccess} />
            )}
            {activeTab === 'bulk' && (
              <BulkDownloader API_BASE={API_BASE} onDownloadSuccess={handleDownloadSuccess} />
            )}
            {activeTab === 'library' && (
              <FileLibrary key={libraryRefreshTrigger} API_BASE={API_BASE} />
            )}
          </div>
        </main>
      </div>

      {/* Footer & Features highlight */}
      <footer className="w-full max-w-6xl mx-auto px-4 mt-16 pt-8 border-t border-white/10 text-center text-xs text-gray-400">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-left">
          <div className="glass-panel p-4 flex items-start gap-3">
            <Zap className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-gray-200">High Speed Extraction</h4>
              <p className="text-xs text-gray-400 mt-0.5">Direct multi-threaded download stream powered by yt-dlp & ffmpeg.</p>
            </div>
          </div>

          <div className="glass-panel p-4 flex items-start gap-3">
            <Globe className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-gray-200">1000+ Sites & Links</h4>
              <p className="text-xs text-gray-400 mt-0.5">Supports YouTube, Vimeo, Twitter/X, SoundCloud, TikTok & direct media files.</p>
            </div>
          </div>

          <div className="glass-panel p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-gray-200">Zero Ads & Open Source</h4>
              <p className="text-xs text-gray-400 mt-0.5">Clean local processing without popups, trackers, or rate limits.</p>
            </div>
          </div>
        </div>

        <p>© 2026 MediaVault Universal Downloader • Powered by FastAPI & React</p>
      </footer>

      {/* Cookie Settings Modal */}
      {showSettings && (
        <CookieSettings
          API_BASE={API_BASE}
          onClose={() => {
            setShowSettings(false);
            // Refresh cookie status
            fetch(`${API_BASE}/api/settings`)
              .then(r => r.json())
              .then(data => setCookieBrowser(data.cookie_browser || null))
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
}
