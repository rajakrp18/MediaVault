import React, { useState, useEffect } from 'react';
import { Globe, Shield, CheckCircle, AlertCircle, RefreshCw, X, Info, Cookie } from 'lucide-react';

const BROWSERS = [
  { id: 'chrome', label: 'Google Chrome', color: 'from-yellow-500 to-green-500', desc: 'Most compatible — recommended' },
  { id: 'edge', label: 'Microsoft Edge', color: 'from-blue-500 to-cyan-400', desc: 'Works great on Windows' },
  { id: 'firefox', label: 'Mozilla Firefox', color: 'from-orange-500 to-red-500', desc: 'Open source browser' },
  { id: 'brave', label: 'Brave Browser', color: 'from-orange-600 to-orange-400', desc: 'Privacy-focused Chromium' },
  { id: 'opera', label: 'Opera', color: 'from-red-600 to-pink-500', desc: 'Opera browser' },
  { id: 'chromium', label: 'Chromium', color: 'from-blue-400 to-indigo-500', desc: 'Open source Chrome base' },
];

export default function CookieSettings({ API_BASE, onClose }) {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);
  const [selectedBrowser, setSelectedBrowser] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/settings`)
      .then(r => r.json())
      .then(data => {
        setSettings(data);
        setSelectedBrowser(data.cookie_browser || null);
      })
      .catch(() => setSettings({ cookie_browser: null, cookies_file_exists: false }));
  }, [API_BASE]);

  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ browser: selectedBrowser }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveResult({ ok: true, msg: selectedBrowser
          ? `✅ Now using cookies from ${selectedBrowser}. Downloads will use your ${selectedBrowser} YouTube login.`
          : '✅ Cookie browser cleared. Will use cookies.txt file if available.' });
        setSettings(prev => ({ ...prev, cookie_browser: selectedBrowser }));
      } else {
        setSaveResult({ ok: false, msg: 'Failed to save settings.' });
      }
    } catch (e) {
      setSaveResult({ ok: false, msg: 'Could not reach backend to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
      <div className="glass-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 relative animate-fadeIn">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30">
              <Cookie className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white">Cookie Settings</h2>
              <p className="text-xs text-gray-400">Required to bypass YouTube bot detection</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            id="close-settings-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Why Cookies Banner */}
        <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-300 mb-1">Why are cookies needed?</p>
            <p className="text-amber-200/70">
              YouTube requires authentication to prevent bot access. MediaVault uses your browser's existing YouTube login — no password sharing.
              <strong className="text-amber-300"> Make sure you're logged into YouTube in the selected browser.</strong>
            </p>
          </div>
        </div>

        {/* Chrome locked DB tip */}
        <div className="mb-6 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200/80 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <span>
            <strong className="text-blue-300">⚠️ Browser cookie may fail</strong> if the browser is open (database locked by OS).
            If you get a "Could not copy cookie database" error, use the <strong className="text-blue-200">cookies.txt method</strong> below instead — it's more reliable.
          </span>
        </div>

        {/* Browser Selection */}
        <div className="mb-6">
          <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">
            Select Your Browser
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* None option */}
            <button
              type="button"
              id="cookie-browser-none"
              onClick={() => setSelectedBrowser(null)}
              className={`p-4 rounded-xl border text-left transition-all ${
                selectedBrowser === null
                  ? 'bg-gray-700/60 border-gray-500 text-white shadow-lg'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-600 flex items-center justify-center text-lg">🚫</div>
                <div>
                  <p className="font-semibold text-sm">None (use cookies.txt)</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {settings?.cookies_file_exists ? '✅ cookies.txt found' : '⚠️ No cookies.txt detected'}
                  </p>
                </div>
                {selectedBrowser === null && <CheckCircle className="w-4 h-4 text-emerald-400 ml-auto" />}
              </div>
            </button>

            {BROWSERS.map(b => (
              <button
                key={b.id}
                type="button"
                id={`cookie-browser-${b.id}`}
                onClick={() => setSelectedBrowser(b.id)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedBrowser === b.id
                    ? 'bg-violet-600/20 border-violet-500 text-white shadow-lg shadow-violet-500/10'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${b.color} flex items-center justify-center`}>
                    <Globe className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{b.label}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{b.desc}</p>
                  </div>
                  {selectedBrowser === b.id && <CheckCircle className="w-4 h-4 text-violet-400 ml-auto" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Save Result */}
        {saveResult && (
          <div className={`mb-4 p-3 rounded-xl text-sm flex items-start gap-2 ${
            saveResult.ok
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border border-red-500/30 text-red-300'
          }`}>
            {saveResult.ok ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            {saveResult.msg}
          </div>
        )}

        {/* Save Button */}
        <button
          type="button"
          id="save-cookie-settings-btn"
          disabled={saving}
          onClick={handleSave}
          className="btn-primary w-full py-3 flex items-center justify-center gap-2"
        >
          {saving ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</>
          ) : (
            <><Shield className="w-4 h-4" /> Save Cookie Settings</>
          )}
        </button>

        {/* Manual cookies.txt guide */}
        <div className="mt-6 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">Alternative: Manual cookies.txt</span>
          </div>
          <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
            <li>Install <strong className="text-gray-200">"Get cookies.txt LOCALLY"</strong> Chrome extension</li>
            <li>Log into <strong className="text-gray-200">youtube.com</strong> in Chrome</li>
            <li>Click the extension icon on youtube.com and export</li>
            <li>Save the downloaded file as <code className="text-violet-300 bg-violet-500/10 px-1 rounded">cookies.txt</code> inside <code className="text-violet-300 bg-violet-500/10 px-1 rounded">backend/</code></li>
            <li>Select <strong className="text-gray-200">"None (use cookies.txt)"</strong> above and save</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
