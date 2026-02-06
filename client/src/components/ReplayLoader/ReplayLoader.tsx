import { useState } from 'react';
import { useReplayStore } from '../../state/replayStore';

export function ReplayLoader() {
  const [url, setUrl] = useState('');
  const { load, loading, error } = useReplayStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      load(url.trim());
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-aoe-gold mb-2">
          AoE4 Replay Viewer
        </h1>
        <p className="text-gray-400 text-sm">
          Paste a replay URL from aoe4world.com to visualize the match
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3 w-full max-w-2xl">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://aoe4world.com/players/123/games/456/replay"
          className="flex-1 px-4 py-3 bg-aoe-panel border border-aoe-border rounded-lg
                     text-white placeholder-gray-500 focus:outline-none focus:border-aoe-gold
                     transition-colors"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="px-6 py-3 bg-aoe-gold text-black font-semibold rounded-lg
                     hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Spinner /> Loading...
            </span>
          ) : (
            'Load Replay'
          )}
        </button>
      </form>

      {error && (
        <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-2 max-w-2xl">
          {error}
        </div>
      )}

      <div className="text-gray-600 text-xs mt-4">
        The replay file will be downloaded and parsed server-side. This may take a few seconds.
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
