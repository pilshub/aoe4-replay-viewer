import fs from 'fs';
import path from 'path';
import { parseReplayBuffer, ParsedReplay } from './replay-parser';

const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || path.join(__dirname, '../../downloads');

// Ensure download directory exists
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

/**
 * Extract game ID from an aoe4world.com or aoe4replays.gg URL.
 */
function extractGameId(url: string): string | null {
  const match = url.match(/\/games\/(\d+)/) || url.match(/\/replays\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Extract player path from aoe4world URL for summary.json.
 */
function extractAoe4WorldParts(url: string): { playerPath: string; gameId: string; sig: string } | null {
  const parsed = new URL(url);
  const match = parsed.pathname.match(/\/players\/([^/]+)\/games\/(\d+)/);
  if (!match) return null;
  return {
    playerPath: match[1],
    gameId: match[2],
    sig: parsed.searchParams.get('sig') || '',
  };
}

/**
 * Download the replay .gz file from aoe4replays.gg.
 */
async function downloadReplay(gameId: string): Promise<Buffer> {
  const localPath = path.join(DOWNLOAD_DIR, `${gameId}.gz`);

  if (fs.existsSync(localPath)) {
    console.log(`[parser-proxy] Using cached replay: ${localPath}`);
    return fs.readFileSync(localPath);
  }

  const downloadUrl = `https://aoe4replays.gg/api/replays/${gameId}`;
  console.log(`[parser-proxy] Downloading replay from ${downloadUrl}...`);

  const response = await fetch(downloadUrl, {
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to download replay: HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(localPath, buffer);
  console.log(`[parser-proxy] Downloaded ${buffer.length} bytes`);
  return buffer;
}

/**
 * Fetch metadata (player names, civs, map, etc.) from aoe4world summary.json.
 */
async function fetchMetadata(url: string): Promise<any | null> {
  const parts = extractAoe4WorldParts(url);
  if (!parts) return null;

  const summaryUrl = `https://aoe4world.com/players/${parts.playerPath}/games/${parts.gameId}/summary.json${parts.sig ? `?sig=${parts.sig}` : ''}`;
  console.log(`[parser-proxy] Fetching metadata from summary.json...`);

  try {
    const response = await fetch(summaryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      console.log(`[parser-proxy] summary.json returned ${response.status}, using fallback metadata`);
      return null;
    }

    return await response.json();
  } catch (err: any) {
    console.log(`[parser-proxy] Failed to fetch metadata: ${err.message}`);
    return null;
  }
}

/**
 * Enrich parsed replay with metadata from aoe4world.
 */
function enrichWithMetadata(parsed: ParsedReplay, metadata: any): ParsedReplay {
  if (!metadata) return parsed;

  // Map name
  if (metadata.map_name) {
    parsed.gameSummary.mapName = metadata.map_name;
  }

  // Duration from metadata (more accurate)
  if (metadata.duration) {
    parsed.gameSummary.duration = metadata.duration;
    parsed.replaySummary.dataSTLS.gameLength = metadata.duration;
  }

  // Player info
  const metaPlayers = metadata.players || [];
  for (let i = 0; i < parsed.gameSummary.players.length && i < metaPlayers.length; i++) {
    const mp = metaPlayers[i];
    const pp = parsed.gameSummary.players[i];
    pp.playerName = mp.name || pp.playerName;
    pp.civ = mp.civilization || pp.civ;
    pp.outcome = mp.result || pp.outcome;
    pp.playerColor = i;
  }

  return parsed;
}

/**
 * Parse a replay from an aoe4world.com URL.
 */
export async function parseReplay(replayUrl: string): Promise<any> {
  const gameId = extractGameId(replayUrl);
  if (!gameId) {
    throw new Error(`Cannot extract game ID from URL: ${replayUrl}`);
  }

  console.log(`[parser-proxy] Game ID: ${gameId}`);

  // Download replay and fetch metadata in parallel
  const [replayBuffer, metadata] = await Promise.all([
    downloadReplay(gameId),
    fetchMetadata(replayUrl),
  ]);

  // Parse the replay binary
  const parsed = parseReplayBuffer(replayBuffer);

  // Enrich with metadata (player names, civs, map)
  const enriched = enrichWithMetadata(parsed, metadata);

  console.log(`[parser-proxy] Done: ${enriched.gameSummary.players.length} players, map=${enriched.gameSummary.mapName}`);
  return enriched;
}
