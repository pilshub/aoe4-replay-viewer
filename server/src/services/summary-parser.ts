/**
 * AoE4 Replay Summary Parser
 * Extracts rich game statistics from the Relic Chunky section of .rec replay files.
 * Ported from the .NET parser at replays-parser-src/AoE4WorldReplaysParser/Models/DataSTPD.cs
 */

// ── Types ─────────────────────────────────────────────────────

export interface ResourceDict {
  food: number;
  gold: number;
  stone: number;
  wood: number;
}

export interface TimelineEntry {
  timestamp: number;
  resourcesCurrent: ResourceDict;
  resourcesPerMinute: ResourceDict;
  resourcesCumulative: ResourceDict;
  resourcesUnitValue: ResourceDict;
  scoreTotal: number;
  scoreEconomy: number;
  scoreMilitary: number;
  scoreSociety: number;
  scoreTechnology: number;
}

export interface PlayerSummary {
  playerId: number;
  playerName: string;
  civ: string;
  outcome: number;
  timestampEliminated: number;
  playerProfileId: number;
  // Production
  unitsProduced: number;
  unitsProducedInfantry: number;
  largestArmy: number;
  techResearched: number;
  // Combat
  unitsKilled: number;
  unitsKilledResourceValue: number;
  unitsLost: number;
  unitsLostResourceValue: number;
  buildingsRazed: number;
  buildingsLost: number;
  // Map control
  sacredSitesCaptured: number;
  sacredSitesLost: number;
  sacredSitesNeutralized: number;
  relicsCaptured: number;
  // Economy
  totalResourcesGathered: ResourceDict;
  totalResourcesSpent: ResourceDict;
  totalResourcesSpentOnUpgrades: ResourceDict;
  // Age timestamps (seconds, null if not reached)
  age2Timestamp: number | null;
  age3Timestamp: number | null;
  age4Timestamp: number | null;
  // Timelines
  timeline: TimelineEntry[];
}

export interface ReplaySummaryData {
  gameLength: number;
  players: PlayerSummary[];
}

// ── Binary Reader ─────────────────────────────────────────────

class BinaryReader {
  private buf: Buffer;
  private pos: number;

  constructor(buf: Buffer, offset: number = 0) {
    this.buf = buf;
    this.pos = offset;
  }

  get position(): number { return this.pos; }
  set position(v: number) { this.pos = v; }
  get remaining(): number { return this.buf.length - this.pos; }

  readInt32(): number {
    if (this.remaining < 4) throw new Error(`EOF at ${this.pos}`);
    const v = this.buf.readInt32LE(this.pos);
    this.pos += 4;
    return v;
  }

  readUInt32(): number {
    if (this.remaining < 4) throw new Error(`EOF at ${this.pos}`);
    const v = this.buf.readUInt32LE(this.pos);
    this.pos += 4;
    return v;
  }

  readFloat(): number {
    if (this.remaining < 4) throw new Error(`EOF at ${this.pos}`);
    const v = this.buf.readFloatLE(this.pos);
    this.pos += 4;
    return v;
  }

  readByte(): number {
    if (this.remaining < 1) throw new Error(`EOF at ${this.pos}`);
    return this.buf[this.pos++];
  }

  readBytes(n: number): Buffer {
    if (this.remaining < n) throw new Error(`EOF at ${this.pos}`);
    const b = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    return b;
  }

  readPrefixedString(): string {
    const len = this.readInt32();
    if (len < 0 || len > 1000) throw new Error(`Invalid string length ${len} at ${this.pos}`);
    const b = this.readBytes(len);
    return b.toString('utf8');
  }

  readPrefixedUnicodeString(): string {
    const len = this.readInt32();
    if (len < 0 || len > 1000) throw new Error(`Invalid unicode string length ${len} at ${this.pos}`);
    const b = this.readBytes(len * 2);
    return b.toString('utf16le');
  }

  peekInt32(): number {
    const v = this.buf.readInt32LE(this.pos);
    return v;
  }

  skip(n: number): void {
    this.pos += n;
  }
}

// ── Chunky Format Parser ──────────────────────────────────────

const CHUNKY_MAGIC = 'Relic Chunky\r\n';

interface ChunkHeader {
  type: string;     // 'FOLD' or 'DATA'
  name: string;     // 4-char identifier (STLI, STPD, etc.)
  version: number;
  dataSize: number;
  nameSize: number;
  dataStart: number;
}

function findChunkyOffset(data: Buffer): number {
  // Search for "Relic Chunky\r\n" which marks the summary section
  const magic = Buffer.from(CHUNKY_MAGIC, 'ascii');
  for (let i = data.length - 100000; i < data.length - magic.length; i++) {
    if (i < 0) continue;
    let match = true;
    for (let j = 0; j < magic.length; j++) {
      if (data[i + j] !== magic[j]) { match = false; break; }
    }
    if (match) return i;
  }
  // Fallback: search from start
  for (let i = 0; i < data.length - magic.length; i++) {
    let match = true;
    for (let j = 0; j < magic.length; j++) {
      if (data[i + j] !== magic[j]) { match = false; break; }
    }
    if (match) return i;
  }
  return -1;
}

function readChunkHeader(reader: BinaryReader): ChunkHeader | null {
  if (reader.remaining < 20) return null;

  const typeBytes = reader.readBytes(4);
  const type = typeBytes.toString('ascii');
  if (type !== 'FOLD' && type !== 'DATA') return null;

  const nameBytes = reader.readBytes(4);
  const name = nameBytes.toString('ascii');
  const version = reader.readInt32();
  const dataSize = reader.readInt32();
  const nameSize = reader.readInt32();

  // Skip the chunk name string if present
  if (nameSize > 0 && nameSize < 1000) {
    reader.skip(nameSize);
  }

  return {
    type,
    name,
    version,
    dataSize,
    nameSize,
    dataStart: reader.position,
  };
}

// ── ResourceDict Reader ───────────────────────────────────────

function readResourceDict(reader: BinaryReader): ResourceDict {
  const keyPairCount = reader.readInt32();
  if (keyPairCount !== 8 && keyPairCount !== 9) {
    throw new Error(`Invalid ResourceDict keyPairCount: ${keyPairCount} at ${reader.position}`);
  }

  const dict: Record<string, number> = {};
  for (let i = 0; i < keyPairCount; i++) {
    const key = reader.readPrefixedString();
    const value = reader.readFloat();
    dict[key] = value;
  }

  return {
    food: dict.food ?? 0,
    gold: dict.gold ?? 0,
    stone: dict.stone ?? 0,
    wood: dict.wood ?? 0,
  };
}

// ── STPD Parser ───────────────────────────────────────────────

function parseSTPD(reader: BinaryReader, version: number): PlayerSummary {
  // Follows DataSTPD.Deserialize() exactly

  const playerId = reader.readInt32();
  const playerName = reader.readPrefixedUnicodeString();
  const outcome = reader.readInt32();
  reader.readInt32(); // unknown3
  const timestampEliminated = reader.readInt32();
  if (version >= 2033) reader.readInt32(); // unknown4
  reader.readInt32(); // unknown5a
  reader.readInt32(); // unknown5b
  const unitsProduced = reader.readInt32();
  reader.readInt32(); // unknown5d
  const unitsProducedInfantry = reader.readInt32();
  reader.readInt32(); // unitsProducedInfantryResources
  for (let i = 0; i < 6; i++) reader.readInt32(); // unknown5g-5l
  const largestArmy = reader.readInt32();
  for (let i = 0; i < 9; i++) reader.readInt32(); // unknown5n-5v (9 fields)
  reader.readInt32(); // unknown6
  reader.readInt32(); // unknown7
  readResourceDict(reader); // unknownItems1
  const buildingsLost = reader.readInt32();
  reader.readInt32(); // unknown9a
  const unitsLost = reader.readInt32();
  const unitsLostResourceValue = reader.readInt32();
  for (let i = 0; i < 6; i++) reader.readInt32(); // unknown9d-9i
  const techResearched = reader.readInt32();
  reader.readInt32(); // unknown9k
  readResourceDict(reader); // unknownItems2a
  const totalResourcesSpentOnUpgrades = readResourceDict(reader);
  readResourceDict(reader); // unknownItems2c
  readResourceDict(reader); // unknownItems2d
  const unitsKilled = reader.readInt32();
  const unitsKilledResourceValue = reader.readInt32();
  reader.readInt32(); // unknown10c
  reader.readInt32(); // unknown10d
  const buildingsRazed = reader.readInt32();
  for (let i = 0; i < 6; i++) reader.readInt32(); // unknown10f-10k
  const totalResourcesGathered = readResourceDict(reader);
  const totalResourcesSpent = readResourceDict(reader);
  readResourceDict(reader); // unknownItems3b
  readResourceDict(reader); // unknownItems3c
  readResourceDict(reader); // unknownItems3d
  readResourceDict(reader); // unknownItems3e
  for (let i = 0; i < 6; i++) reader.readInt32(); // unknown11a
  const sacredSitesCaptured = reader.readInt32();
  const sacredSitesLost = reader.readInt32();
  const sacredSitesNeutralized = reader.readInt32();
  for (let i = 0; i < 9; i++) reader.readInt32(); // unknown11e
  readResourceDict(reader); // unknownItems4
  for (let i = 0; i < 4; i++) reader.readInt32(); // unknown12
  reader.readByte(); // unknown13
  const civ = reader.readPrefixedString();
  reader.readInt32(); // unknown14a
  reader.readInt32(); // unknown14b
  const playerProfileId = reader.readInt32();
  reader.readInt32(); // unknown14d

  // Resource timeline
  const resourceTimelineCount = reader.readInt32();
  const resourceTimeline: Array<{
    timestamp: number;
    current: ResourceDict;
    perMinute: ResourceDict;
    units: ResourceDict;
    cumulative: ResourceDict;
  }> = [];

  for (let i = 0; i < resourceTimelineCount && i < 10000; i++) {
    const timestamp = reader.readInt32();
    const current = readResourceDict(reader);
    let perMinute = readResourceDict(reader);
    let units = readResourceDict(reader);
    let cumulative: ResourceDict = { food: 0, gold: 0, stone: 0, wood: 0 };

    // Detect post-patch 12.0.1974 format (extra ResourceDict inserted)
    if (reader.remaining >= 4 && reader.peekInt32() >= 9) {
      const extra = readResourceDict(reader);
      cumulative = perMinute;
      perMinute = units;
      units = extra;
    }
    reader.readInt32(); // unknown1

    resourceTimeline.push({ timestamp, current, perMinute, units, cumulative });
  }

  // Score timeline
  const scoreTimelineCount = reader.readInt32();
  const scoreTimeline: Array<{
    timestamp: number;
    economy: number;
    military: number;
    society: number;
    technology: number;
    total: number;
  }> = [];

  for (let i = 0; i < scoreTimelineCount && i < 10000; i++) {
    const timestamp = reader.readInt32();
    const economy = reader.readFloat();
    const military = reader.readFloat();
    const society = reader.readFloat();
    const technology = reader.readFloat();
    const total = reader.readFloat();
    scoreTimeline.push({ timestamp, economy, military, society, technology, total });
  }

  // Skip remaining fields (unknown15-30, we don't need them)
  // We have everything we need for the analysis

  // Merge resource and score timelines
  const timeline: TimelineEntry[] = [];
  const maxLen = Math.max(resourceTimeline.length, scoreTimeline.length);
  for (let i = 0; i < maxLen; i++) {
    const res = resourceTimeline[i];
    // Score timeline might have a -1 offset from resource timeline
    const score = scoreTimeline[i] ?? scoreTimeline[i - 1];
    timeline.push({
      timestamp: res?.timestamp ?? score?.timestamp ?? i * 20,
      resourcesCurrent: res?.current ?? { food: 0, gold: 0, stone: 0, wood: 0 },
      resourcesPerMinute: res?.perMinute ?? { food: 0, gold: 0, stone: 0, wood: 0 },
      resourcesCumulative: res?.cumulative ?? { food: 0, gold: 0, stone: 0, wood: 0 },
      resourcesUnitValue: res?.units ?? { food: 0, gold: 0, stone: 0, wood: 0 },
      scoreTotal: score?.total ?? 0,
      scoreEconomy: score?.economy ?? 0,
      scoreMilitary: score?.military ?? 0,
      scoreSociety: score?.society ?? 0,
      scoreTechnology: score?.technology ?? 0,
    });
  }

  // Read age timestamps from later in STPD
  // These are at the very end of the structure, hard to reach by sequential reading
  // since we skip unknown15+. We'll extract them from the existing timeline scores instead.
  // age2 = first timestamp where scoreSociety jumps (age-up gives 120 society score)
  // age3 = second jump in scoreSociety (to 480)
  let age2Timestamp: number | null = null;
  let age3Timestamp: number | null = null;
  let age4Timestamp: number | null = null;

  let prevSociety = 0;
  for (const t of timeline) {
    if (t.scoreSociety > prevSociety) {
      const jump = t.scoreSociety - prevSociety;
      if (jump >= 100 && !age2Timestamp) {
        age2Timestamp = t.timestamp;
      } else if (jump >= 100 && age2Timestamp && !age3Timestamp) {
        age3Timestamp = t.timestamp;
      } else if (jump >= 100 && age3Timestamp && !age4Timestamp) {
        age4Timestamp = t.timestamp;
      }
      prevSociety = t.scoreSociety;
    }
  }

  return {
    playerId,
    playerName,
    civ,
    outcome,
    timestampEliminated,
    playerProfileId,
    unitsProduced,
    unitsProducedInfantry,
    largestArmy,
    techResearched,
    unitsKilled,
    unitsKilledResourceValue,
    unitsLost,
    unitsLostResourceValue,
    buildingsRazed,
    buildingsLost,
    sacredSitesCaptured: sacredSitesCaptured,
    sacredSitesLost: sacredSitesLost,
    sacredSitesNeutralized: sacredSitesNeutralized,
    relicsCaptured: 0, // deep in unknown fields, use timeline to infer
    totalResourcesGathered,
    totalResourcesSpent,
    totalResourcesSpentOnUpgrades,
    age2Timestamp,
    age3Timestamp,
    age4Timestamp,
    timeline,
  };
}

// ── Public API ────────────────────────────────────────────────

/**
 * Extract rich summary data from a decompressed AoE4 replay buffer.
 * Searches for the Relic Chunky section and parses STPD chunks for each player.
 */
export function parseReplaySummary(decompressedData: Buffer): ReplaySummaryData | null {
  const chunkyOffset = findChunkyOffset(decompressedData);
  if (chunkyOffset < 0) {
    console.log('[summary-parser] Relic Chunky section not found');
    return null;
  }

  console.log(`[summary-parser] Found Relic Chunky at offset ${chunkyOffset}`);

  const players: PlayerSummary[] = [];
  let gameLength = 0;

  // Skip Relic Chunky file header (magic + version info ≈ 24 bytes)
  const reader = new BinaryReader(decompressedData, chunkyOffset + 24);

  // Walk the chunk tree looking for STPD data nodes
  const maxOffset = decompressedData.length;
  let depth = 0;

  function walkChunks(endOffset: number): void {
    while (reader.position < endOffset - 20 && reader.remaining > 20) {
      const headerPos = reader.position;
      const header = readChunkHeader(reader);
      if (!header) {
        // Can't read valid header, try next byte
        reader.position = headerPos + 1;
        continue;
      }

      const chunkEnd = header.dataStart + header.dataSize;
      if (chunkEnd > maxOffset || header.dataSize < 0 || header.dataSize > 10_000_000) {
        reader.position = headerPos + 1;
        continue;
      }

      if (header.type === 'FOLD') {
        // Recurse into folder
        depth++;
        if (depth < 10) walkChunks(chunkEnd);
        depth--;
        reader.position = chunkEnd;
      } else if (header.type === 'DATA') {
        if (header.name === 'STLS') {
          // Game metadata - extract gameLength
          try {
            const stlsReader = new BinaryReader(decompressedData, header.dataStart);
            // STLS starts with gameLength (int32 in ticks, then converted)
            // Actually the first field in DataSTLS is different. Let's just record
            // that we found it and get gameLength from timeline later.
          } catch { /* skip */ }
        } else if (header.name === 'STPD') {
          try {
            const stpdReader = new BinaryReader(decompressedData, header.dataStart);
            const player = parseSTPD(stpdReader, header.version);
            players.push(player);
            console.log(`[summary-parser] Parsed player: ${player.playerName} (${player.civ}) - Killed:${player.unitsKilled} Lost:${player.unitsLost}`);
          } catch (err: any) {
            console.log(`[summary-parser] Failed to parse STPD at ${header.dataStart}: ${err.message}`);
          }
        }
        // Skip to end of data chunk
        reader.position = chunkEnd;
      }
    }
  }

  try {
    walkChunks(maxOffset);
  } catch (err: any) {
    console.log(`[summary-parser] Walk error: ${err.message}`);
  }

  if (players.length === 0) {
    console.log('[summary-parser] No player data found');
    return null;
  }

  // Determine game length from the last timeline entry
  for (const p of players) {
    if (p.timeline.length > 0) {
      const lastTs = p.timeline[p.timeline.length - 1].timestamp;
      if (lastTs > gameLength) gameLength = lastTs;
    }
  }

  console.log(`[summary-parser] Extracted ${players.length} players, gameLength=${gameLength}s`);
  return { gameLength, players };
}
