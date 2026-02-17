import { useState } from 'react';
import { useReplayStore } from '../../state/replayStore';

const LANGUAGES = [
  { code: 'en', label: '\u{1F1EC}\u{1F1E7} English' },
  { code: 'es', label: '\u{1F1EA}\u{1F1F8} Espa\u00F1ol' },
  { code: 'fr', label: '\u{1F1EB}\u{1F1F7} Fran\u00E7ais' },
  { code: 'de', label: '\u{1F1E9}\u{1F1EA} Deutsch' },
  { code: 'pt', label: '\u{1F1E7}\u{1F1F7} Portugu\u00EAs' },
  { code: 'it', label: '\u{1F1EE}\u{1F1F9} Italiano' },
  { code: 'zh', label: '\u{1F1E8}\u{1F1F3} \u4E2D\u6587' },
  { code: 'ja', label: '\u{1F1EF}\u{1F1F5} \u65E5\u672C\u8A9E' },
  { code: 'ko', label: '\u{1F1F0}\u{1F1F7} \uD55C\uAD6D\uC5B4' },
  { code: 'ru', label: '\u{1F1F7}\u{1F1FA} \u0420\u0443\u0441\u0441\u043A\u0438\u0439' },
  { code: 'tr', label: '\u{1F1F9}\u{1F1F7} T\u00FCrk\u00E7e' },
  { code: 'pl', label: '\u{1F1F5}\u{1F1F1} Polski' },
];

export function ReplayLoader() {
  const [url, setUrl] = useState('');
  const { load, loading, error, language, setLanguage } = useReplayStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      load(url.trim());
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="font-cinzel text-4xl font-bold text-aoe-gold tracking-[0.1em] mb-3">
          AGE OF EMPIRES IV
        </h1>
        <div className="ornament-line w-64 mx-auto mb-3" />
        <p className="font-cinzel text-sm tracking-[0.2em] text-aoe-text-secondary uppercase">
          Match Analysis
        </p>
      </div>

      <p className="text-aoe-text-dim text-sm font-crimson max-w-md text-center">
        Paste a replay URL from aoe4world.com to analyze the match strategy, economy, and combat.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full max-w-2xl">
        <div className="flex gap-3">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://aoe4world.com/players/123/games/456"
            className="flex-1 px-4 py-3 bg-aoe-panel border border-aoe-border rounded-lg
                       font-crimson text-aoe-text placeholder-aoe-text-dim/50
                       focus:outline-none focus:border-aoe-gold-dark
                       transition-colors"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="px-6 py-3 font-cinzel text-sm tracking-wider font-semibold rounded-lg
                       border-2 border-aoe-gold text-aoe-bg
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all"
            style={{
              background: 'linear-gradient(180deg, #e4c76b 0%, #c9a84c 50%, #8a6d2b 100%)',
            }}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner /> ANALYZING...
              </span>
            ) : (
              'ANALYZE'
            )}
          </button>
        </div>

        {/* Language selector */}
        <div className="flex items-center justify-center gap-3">
          <span className="text-aoe-text-dim text-xs font-cinzel tracking-wider">ANALYSIS LANGUAGE:</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="px-3 py-1.5 bg-aoe-panel border border-aoe-border rounded
                       font-crimson text-sm text-aoe-text
                       focus:outline-none focus:border-aoe-gold-dark
                       cursor-pointer"
            disabled={loading}
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>
      </form>

      {error && (
        <div className="text-red-400 text-sm font-crimson bg-red-900/10 border border-red-800/30 rounded-lg px-4 py-2 max-w-2xl">
          {error}
        </div>
      )}

      <div className="text-aoe-text-dim text-xs font-crimson italic mt-2">
        The replay will be downloaded and analyzed server-side. This may take up to 30 seconds.
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
