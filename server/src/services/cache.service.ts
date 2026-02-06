import fs from 'fs';
import path from 'path';

const CACHE_DIR = process.env.CACHE_DIR || path.join(__dirname, '../../cache');
const CACHE_TTL = parseInt(process.env.CACHE_TTL_MS || '3600000', 10); // 1 hour

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function cacheFilePath(id: string): string {
  return path.join(CACHE_DIR, `${id}.json`);
}

export function getCached(id: string): any | null {
  const filePath = cacheFilePath(id);
  if (!fs.existsSync(filePath)) return null;

  const stat = fs.statSync(filePath);
  const age = Date.now() - stat.mtimeMs;
  if (age > CACHE_TTL) {
    fs.unlinkSync(filePath);
    return null;
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

export function setCache(id: string, data: any): void {
  const filePath = cacheFilePath(id);
  fs.writeFileSync(filePath, JSON.stringify(data));
}

/**
 * Generate a cache key from the replay URL.
 */
export function urlToCacheKey(url: string): string {
  // Simple hash: take last segment or create deterministic key
  const crypto = require('crypto');
  return crypto.createHash('md5').update(url).digest('hex');
}
