import React from 'react';
import { DownloadCloud, Palette, Sparkles, CheckCircle2 } from 'lucide-react';

export default function Header({ currentTheme, onThemeChange }) {
  return (
    <header className="w-full max-w-6xl mx-auto pt-6 px-4 mb-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 glass-panel">
        {/* Logo & Branding */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-white/10 border border-white/15 shadow-lg">
            <DownloadCloud className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight gradient-text">MediaVault</h1>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/10 text-gray-200 border border-white/15">
                v1.0 Pro
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Universal Video, Audio, Playlist & Link Downloader
            </p>
          </div>
        </div>

        {/* Theme Switcher & Status Badges */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Aesthetic Theme Switcher */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
            <Palette className="w-4 h-4 text-gray-400" />
            <select
              value={currentTheme}
              onChange={(e) => onThemeChange(e.target.value)}
              className="bg-transparent text-xs font-semibold text-gray-200 outline-none cursor-pointer"
            >
              <option value="noir" className="bg-gray-900 text-white">🖤 Black & Silver (Noir)</option>
              <option value="navy" className="bg-gray-900 text-white">🌊 Navy & Soft Blue</option>
              <option value="sage" className="bg-gray-100 text-gray-900">🌿 Sage & Cream</option>
              <option value="neon" className="bg-gray-900 text-white">⚡ Neon Cyber</option>
            </select>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            yt-dlp Engine Ready
          </div>
        </div>
      </div>
    </header>
  );
}
