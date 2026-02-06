import { TimelineData, ReplayMetadata } from '../types/replay.types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface LoadResponse {
  replayId: string;
  metadata: ReplayMetadata;
}

export async function loadReplay(url: string): Promise<LoadResponse> {
  const res = await fetch(`${API_BASE}/replay/load`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function fetchReplayData(replayId: string): Promise<TimelineData> {
  const res = await fetch(`${API_BASE}/replay/${replayId}`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}
