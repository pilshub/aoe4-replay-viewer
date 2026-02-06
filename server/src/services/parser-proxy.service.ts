import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const PARSER_URL = process.env.PARSER_URL || 'http://localhost:5069';
const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || path.join(__dirname, '../../downloads');

// Ensure download directory exists
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

export interface ParserResponse {
  players: ParserPlayer[];
  duration?: number;
  mapName?: string;
}

export interface ParserPlayer {
  playerId: number;
  playerName: string;
  playerColor: number;
  civ: string;
  outcome: string;
  entities: ParserEntity[];
  resourceTimelines?: any;
  scoreTimelines?: any;
  ageTimestamps?: any;
}

export interface ParserEntity {
  Id: number;
  EntityType: string;
  Category?: number;
  SpawnX: number;
  SpawnY: number;
  SpawnTimestamp: number;
  DeathX?: number;
  DeathY?: number;
  DeathTimestamp?: number;
  KillerX?: number;
  KillerY?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Download the replay file ourselves, then pass the local path to the parser.
 * This avoids rate limiting issues since we control the download with proper headers.
 */
async function downloadAndParse(replayUrl: string): Promise<any> {
  const hash = crypto.createHash('md5').update(replayUrl).digest('hex');
  const localPath = path.join(DOWNLOAD_DIR, `${hash}.gz`);

  // Download the file ourselves with a browser-like User-Agent
  if (!fs.existsSync(localPath)) {
    console.log(`[parser-proxy] Downloading replay from ${replayUrl}...`);

    const maxRetries = 3;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = attempt * 20_000;
        console.log(`[parser-proxy] Download rate limited, waiting ${delay / 1000}s (attempt ${attempt + 1})...`);
        await sleep(delay);
      }

      const dlResponse = await fetch(replayUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
        },
        signal: AbortSignal.timeout(60_000),
      });

      if (dlResponse.status === 429 && attempt < maxRetries) {
        continue;
      }

      if (!dlResponse.ok) {
        throw new Error(`Failed to download replay: HTTP ${dlResponse.status}`);
      }

      const buffer = Buffer.from(await dlResponse.arrayBuffer());
      fs.writeFileSync(localPath, buffer);
      console.log(`[parser-proxy] Downloaded ${buffer.length} bytes to ${localPath}`);
      break;
    }
  } else {
    console.log(`[parser-proxy] Using cached download: ${localPath}`);
  }

  // Pass local file to parser's newfile endpoint
  const endpoint = `${PARSER_URL}/Summary/newfile?path=${encodeURIComponent(localPath)}`;
  console.log(`[parser-proxy] Parsing local file via ${endpoint}`);

  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    // If parse fails, delete the cached file so it can be retried
    fs.unlinkSync(localPath);
    throw new Error(`Parser returned ${response.status}: ${text}`);
  }

  return response.json();
}

/**
 * Try the direct parser endpoint first; fall back to download-and-parse on rate limit.
 */
export async function parseReplay(replayUrl: string): Promise<any> {
  const endpoint = `${PARSER_URL}/Summary/new?url=${encodeURIComponent(replayUrl)}`;
  console.log(`[parser-proxy] GET ${endpoint}`);

  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(120_000),
  });

  if (response.ok) {
    return response.json();
  }

  const text = await response.text().catch(() => '');
  const isRateLimit = response.status === 429 || text.includes('429');

  if (isRateLimit) {
    console.log(`[parser-proxy] Rate limited on direct call, switching to download-and-parse...`);
    return downloadAndParse(replayUrl);
  }

  throw new Error(`Parser returned ${response.status}: ${text}`);
}
