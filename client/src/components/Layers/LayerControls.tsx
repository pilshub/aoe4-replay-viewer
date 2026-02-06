import { useReplayStore } from '../../state/replayStore';

export function LayerControls() {
  const { layers, toggleLayer, data } = useReplayStore();

  if (!data) return null;

  const layerConfig = [
    { key: 'buildings' as const, label: 'Buildings', icon: '[]' },
    { key: 'units' as const, label: 'Units', icon: 'o' },
    { key: 'effects' as const, label: 'Effects', icon: '*' },
    { key: 'heatmap' as const, label: 'Heatmap', icon: '#' },
  ];

  return (
    <div className="absolute top-4 left-4 flex flex-col gap-1">
      {layerConfig.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => toggleLayer(key)}
          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
            layers[key]
              ? 'bg-aoe-gold/20 border-aoe-gold/50 text-aoe-gold'
              : 'bg-aoe-panel/80 border-aoe-border text-gray-500 hover:text-gray-300'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
