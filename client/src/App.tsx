import { useRef } from 'react';
import { useReplayStore } from './state/replayStore';
import { PixiEngine } from './pixi/PixiEngine';
import { ReplayLoader } from './components/ReplayLoader/ReplayLoader';
import { MapCanvas } from './components/MapCanvas/MapCanvas';
import { Timeline } from './components/Timeline/Timeline';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Minimap } from './components/Minimap/Minimap';
import { LayerControls } from './components/Layers/LayerControls';

export default function App() {
  const { data, loading } = useReplayStore();
  const engineRef = useRef<PixiEngine | null>(null);

  // Show loader if no data loaded yet
  if (!data && !loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-aoe-bg">
        <ReplayLoader />
      </div>
    );
  }

  // Show loading screen
  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-aoe-bg gap-4">
        <div className="w-8 h-8 border-2 border-aoe-gold border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400">Parsing replay file...</p>
        <p className="text-gray-600 text-xs">This may take up to 30 seconds for large replays</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-aoe-bg">
      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* Map canvas */}
        <div className="flex-1 relative">
          <MapCanvas engineRef={engineRef} />
          <LayerControls />
          <Minimap engineRef={engineRef} />

          {/* Back button */}
          <button
            onClick={() => useReplayStore.getState().reset()}
            className="absolute top-4 right-4 px-3 py-1.5 text-xs rounded-lg
                       bg-aoe-panel/80 border border-aoe-border text-gray-400
                       hover:text-white transition-colors"
          >
            New Replay
          </button>
        </div>

        {/* Sidebar */}
        <Sidebar />
      </div>

      {/* Timeline bar */}
      <Timeline />
    </div>
  );
}
