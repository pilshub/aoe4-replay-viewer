import { useReplayStore } from './state/replayStore';
import { ReplayLoader } from './components/ReplayLoader/ReplayLoader';
import { DashboardView } from './components/Dashboard/DashboardView';

export default function App() {
  const { data, loading } = useReplayStore();

  // Show loader if no data loaded yet
  if (!data && !loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-aoe-bg relative">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.08]"
          style={{ backgroundImage: "url('/assets/bg_main.webp')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-aoe-bg/30 via-aoe-bg/70 to-aoe-bg/95" />
        <div className="relative z-10">
          <ReplayLoader />
        </div>
      </div>
    );
  }

  // Show loading screen
  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-aoe-bg gap-4 relative">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.08]"
          style={{ backgroundImage: "url('/assets/bg_main.webp')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-aoe-bg/30 via-aoe-bg/70 to-aoe-bg/95" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-aoe-gold border-t-transparent rounded-full animate-spin" />
          <p className="font-cinzel text-aoe-gold tracking-wider">Analyzing Match...</p>
          <p className="text-aoe-text-dim text-sm">This may take up to 30 seconds</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-aoe-bg text-aoe-text relative">
      {/* Subtle background */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-[0.05] pointer-events-none"
        style={{ backgroundImage: "url('/assets/bg_main.webp')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-aoe-bg/30 via-aoe-bg/80 to-aoe-bg pointer-events-none" />

      {/* Top bar */}
      <div className="relative z-10 flex items-center px-6 py-3 bg-aoe-panel/80 border-b border-aoe-border backdrop-blur-sm">
        <span className="font-cinzel text-aoe-gold tracking-[0.15em] text-sm font-semibold">
          AGE OF EMPIRES IV
        </span>
        <span className="mx-3 text-aoe-gold-dark">&#10022;</span>
        <span className="font-cinzel text-aoe-text-secondary tracking-wider text-xs">
          MATCH ANALYSIS
        </span>
        <button
          onClick={() => useReplayStore.getState().reset()}
          className="ml-auto px-4 py-1.5 text-xs font-cinzel tracking-wider rounded
                     border border-aoe-border text-aoe-text-secondary
                     hover:border-aoe-gold-dark hover:text-aoe-gold transition-colors"
        >
          NEW REPLAY
        </button>
      </div>

      {/* Dashboard */}
      <DashboardView />
    </div>
  );
}
