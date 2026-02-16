import { create } from 'zustand';
import { TimelineData, ReplayMetadata } from '../types/replay.types';
import { loadReplay, fetchReplayData } from '../api/replayApi';

interface ReplayState {
  // Data
  replayId: string | null;
  metadata: ReplayMetadata | null;
  data: TimelineData | null;

  // Playback
  currentTime: number;
  playing: boolean;
  speed: number;

  // UI
  loading: boolean;
  error: string | null;
  layers: {
    buildings: boolean;
    units: boolean;
    effects: boolean;
    heatmap: boolean;
  };

  // Actions
  load: (url: string) => Promise<void>;
  setCurrentTime: (time: number) => void;
  togglePlay: () => void;
  setSpeed: (speed: number) => void;
  toggleLayer: (layer: keyof ReplayState['layers']) => void;
  reset: () => void;
}

export const useReplayStore = create<ReplayState>((set, get) => ({
  replayId: null,
  metadata: null,
  data: null,
  currentTime: 0,
  playing: false,
  speed: 1,
  loading: false,
  error: null,
  layers: {
    buildings: true,
    units: true,
    effects: true,
    heatmap: false,
  },

  load: async (url: string) => {
    set({ loading: true, error: null, playing: false, currentTime: 0 });
    try {
      const { replayId, metadata } = await loadReplay(url);
      const data = await fetchReplayData(replayId);
      set({ replayId, metadata, data, loading: false, playing: true, currentTime: 30 });
    } catch (err: any) {
      set({ loading: false, error: err.message });
    }
  },

  setCurrentTime: (time: number) => {
    set({ currentTime: time });
  },

  togglePlay: () => {
    set(s => ({ playing: !s.playing }));
  },

  setSpeed: (speed: number) => {
    set({ speed });
  },

  toggleLayer: (layer) => {
    set(s => ({
      layers: { ...s.layers, [layer]: !s.layers[layer] },
    }));
  },

  reset: () => {
    set({
      replayId: null,
      metadata: null,
      data: null,
      currentTime: 0,
      playing: false,
      speed: 1,
      loading: false,
      error: null,
    });
  },
}));
