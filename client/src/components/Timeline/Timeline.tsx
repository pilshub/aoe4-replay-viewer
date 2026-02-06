import { useReplayStore } from '../../state/replayStore';

export function Timeline() {
  const { data, currentTime, playing, speed, setCurrentTime, togglePlay, setSpeed } = useReplayStore();

  if (!data) return null;

  const duration = data.metadata.duration;

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-aoe-panel border-t border-aoe-border px-4 py-3 flex items-center gap-4">
      {/* Play/Pause */}
      <button
        onClick={togglePlay}
        className="w-10 h-10 flex items-center justify-center rounded-lg
                   bg-aoe-gold/20 hover:bg-aoe-gold/30 text-aoe-gold transition-colors"
      >
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="3" y="2" width="4" height="12" rx="1" />
            <rect x="9" y="2" width="4" height="12" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2l10 6-10 6V2z" />
          </svg>
        )}
      </button>

      {/* Time display */}
      <span className="text-sm font-mono text-gray-300 w-24 text-center">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>

      {/* Timeline slider */}
      <input
        type="range"
        min={0}
        max={duration}
        step={0.1}
        value={currentTime}
        onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
        className="flex-1"
      />

      {/* Speed controls */}
      <div className="flex items-center gap-1">
        {[0.5, 1, 2, 4, 8].map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              speed === s
                ? 'bg-aoe-gold text-black font-bold'
                : 'bg-aoe-border text-gray-400 hover:text-white'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}
