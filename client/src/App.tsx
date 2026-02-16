import { useRef, useState } from 'react';
import { useReplayStore } from './state/replayStore';
import { PixiEngine } from './pixi/PixiEngine';
import { ReplayLoader } from './components/ReplayLoader/ReplayLoader';
import { MapCanvas } from './components/MapCanvas/MapCanvas';
import { Timeline } from './components/Timeline/Timeline';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Minimap } from './components/Minimap/Minimap';
import { LayerControls } from './components/Layers/LayerControls';
import { BuildOrderView } from './components/BuildOrder/BuildOrderView';

type ViewTab = 'buildorder' | 'map';

export default function App() {
  const { data, loading, error } = useReplayStore();
  const engineRef = useRef<PixiEngine | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('buildorder');

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
      <div className="h-screen flex flex-col bg-aoe-bg text-white">
        {/* Tab bar */}
        <div className="flex items-center px-4 bg-aoe-panel border-b border-aoe-border">
          <div className="flex gap-0">
            <button
              onClick={() => setActiveTab('buildorder')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'buildorder'
                  ? 'border-aoe-gold text-aoe-gold'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              Build Order
              {data?.buildOrder?.length ? (
                <span className="ml-1.5 text-xs opacity-60">({data.buildOrder.length})</span>
              ) : null}
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'map'
                  ? 'border-aoe-gold text-aoe-gold'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              Map View
            </button>
          </div>

          <button
            onClick={() => useReplayStore.getState().reset()}
            className="ml-auto px-3 py-1.5 text-xs rounded-lg
                       bg-aoe-bg/50 border border-aoe-border text-gray-400
                       hover:text-white transition-colors"
          >
            New Replay
          </button>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex min-h-0">
          {activeTab === 'buildorder' ? (
            <BuildOrderView />
          ) : (
            <>
              <div className="flex-1 relative">
                <MapCanvas engineRef={engineRef} />
                <LayerControls />
                <Minimap engineRef={engineRef} />
              </div>
              <Sidebar />
            </>
          )}
        </div>

        {/* Timeline bar */}
        <Timeline />
      </div>
  );
}
