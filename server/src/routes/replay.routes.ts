import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { validateReplayUrl } from '../utils/url-validator';
import { parseReplay } from '../services/parser-proxy.service';
import { transformReplayData } from '../services/transformer.service';
import { getCached, setCache, urlToCacheKey } from '../services/cache.service';

export const replayRoutes = Router();

// In-memory map: replayId → cacheKey (so we can serve by friendly ID)
const replayIndex = new Map<string, string>();

/**
 * POST /api/replay/load
 * Body: { url: string }
 * Returns: { replayId, metadata }
 */
replayRoutes.post('/load', async (req: Request, res: Response) => {
  try {
    const rawUrl = req.body.url;
    const language = req.body.language || 'en';
    if (!rawUrl) {
      res.status(400).json({ error: 'Missing "url" in request body' });
      return;
    }

    // Strip whitespace that can sneak in from copy-paste
    const url = rawUrl.replace(/\s+/g, '');

    const validation = validateReplayUrl(url);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    // Check cache (include language in key so different languages get fresh narratives)
    const cacheKey = urlToCacheKey(`${url}:${language}`);
    let data = getCached(cacheKey);

    if (!data) {
      console.log(`[replay] Cache miss for ${url} (lang=${language}), calling parser...`);
      const rawData = await parseReplay(url);
      data = await transformReplayData(rawData, language);
      setCache(cacheKey, data);
      console.log(`[replay] Parsed and cached: ${data.entities.length} entities, ${data.events.length} events`);
    } else {
      console.log(`[replay] Cache hit for ${url} (lang=${language})`);
    }

    // Create a friendly replay ID
    const replayId = uuidv4().slice(0, 8);
    replayIndex.set(replayId, cacheKey);

    res.json({
      replayId,
      metadata: data.metadata,
    });
  } catch (err: any) {
    console.error('[replay] Error loading replay:', err.message);
    res.status(500).json({ error: `Failed to load replay: ${err.message}` });
  }
});

/**
 * GET /api/replay/:id
 * Returns: full TimelineData
 */
replayRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const cacheKey = replayIndex.get(id);

    if (!cacheKey) {
      res.status(404).json({ error: 'Replay not found. Load it first via POST /api/replay/load' });
      return;
    }

    const data = getCached(cacheKey);
    if (!data) {
      res.status(410).json({ error: 'Replay data expired. Please reload.' });
      return;
    }

    res.json(data);
  } catch (err: any) {
    console.error('[replay] Error fetching replay:', err.message);
    res.status(500).json({ error: err.message });
  }
});
