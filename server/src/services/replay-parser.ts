import zlib from 'zlib';
import { getAoe4Lookup, getPbgidSets, lookupPbgid, isAgeUpEvent, ResourceCosts } from '../data/aoe4-data';

// ── Command types (from Java aoe4replayanalyzer ParserProvider) ─
// Full mapping: 3=BuildUnit, 5=CancelUnit, 12=SetRallyPoint, 14=DeleteBuilding,
// 16=Upgrade, 20=Ungarrison, 56=CancelConstruct, 62=Move, 63=StopMove,
// 65=SupportConstruction (NO coords!), 67=AttackGround, 71=AttackMove,
// 72=UseAbility, 73=Garrison, 96=Deploy, 109=StandGround, 116=Patrol, 123=Construct
const CMD_BUILD_UNIT    = 3;   // BuildUnitCommand - produce a unit (no coords, has pbgid)
const CMD_RALLY_POINT   = 12;  // SetRallyPointCommand - building rally point (coords + building IDs)
const CMD_UPGRADE       = 16;  // UpgradeCommand - research technology (no coords, has pbgid)
const CMD_MOVE          = 62;  // MoveCommand - unit movement (coords + unit IDs)
const CMD_ATTACK_GROUND = 67;  // AttackGroundCommand - siege/artillery target (coords)
const CMD_ATTACK_MOVE   = 71;  // AttackMoveCommand - attack-move (coords + unit IDs)
const CMD_USE_ABILITY   = 72;  // UseAbilityCommand - ability usage (coords)
const CMD_DEPLOY        = 96;  // DeployCommand - unit deployment (coords)
const CMD_PATROL        = 116; // PatrolCommand - patrol route (coords + unit IDs)
const CMD_CONSTRUCT     = 123; // ConstructCommand - building placement (coords + building type!)

const TICKS_PER_SECOND = 8;

// ── Output types ───────────────────────────────────────────────

export interface ReplayCommand {
  tick: number;
  time: number;       // seconds
  cmdType: number;
  playerId: number;
  x: number;
  y: number;          // elevation
  z: number;
  unitCount: number;  // estimated number of units in the command
}

export interface ParsedReplay {
  gameSummary: {
    duration: number;
    mapName: string;
    players: ParsedPlayer[];
  };
  replaySummary: {
    dataSTLS: { gameLength: number };
  };
  buildOrderEvents: BuildOrderEvent[];
  commands: ReplayCommand[];
}

export interface ParsedPlayer {
  playerId: number;
  playerName: string;
  playerColor: number;
  civ: string;
  outcome: string;
  units: ParsedEntity[];
  startingUnits: ParsedEntity[];
}

export interface ParsedEntity {
  id: number;
  entityType: string;
  category: string;
  spawnTimestamp: number;
  spawnX: number;
  spawnY: number;
  deathTimestamp: number | null;
  deathX: number | null;
  deathY: number | null;
  killerPlayerId: number | null;
  unitCount: number;
}

export interface BuildOrderEvent {
  tick: number;
  time: number;          // seconds
  playerId: number;
  eventType: 'construct' | 'build_unit' | 'upgrade';
  pbgid: number;
  name: string;
  icon: string;
  displayClass: string;
  x?: number;            // only for construct
  z?: number;
  // Enriched fields
  costs: ResourceCosts | null;
  age: number;           // 1-4
  classes: string[];
  baseId: string;
  isAgeUp: boolean;
  targetAge: number;     // 0 if not age-up, 2/3/4 if age-up
}

interface RawBuildCommand {
  tick: number;
  time: number;
  cmdType: number;
  playerId: number;
  cmdSize: number;
  rawBytes: Buffer;       // raw command bytes for pbgid scanning
  x?: number;             // only for construct
  z?: number;
}

// ── Parser ─────────────────────────────────────────────────────

/**
 * Find the offset where the replay command stream begins.
 * The stream follows the FOLDINFO section containing PLAS data.
 */
function findStreamOffset(data: Buffer): number {
  // Look for the PLAS marker which precedes the command stream
  const plasMarker = Buffer.from('PLAS');
  let plasIdx = -1;
  for (let i = 0; i < Math.min(data.length, 4000); i++) {
    if (data[i] === 0x50 && data[i + 1] === 0x4C && data[i + 2] === 0x41 && data[i + 3] === 0x53) {
      plasIdx = i;
    }
  }

  if (plasIdx < 0) {
    // Fallback: scan for first valid game tick record after offset 500
    for (let i = 500; i < Math.min(data.length, 5000) - 8; i++) {
      const recordType = data.readUInt32LE(i);
      if (recordType === 0) {
        const tickSize = data.readUInt32LE(i + 4);
        if (tickSize >= 5 && tickSize < 10000) {
          const gameTick = data.readUInt32LE(i + 8 + 1);
          if (gameTick < 200) {
            return i;
          }
        }
      }
    }
    throw new Error('Cannot find replay stream start');
  }

  // After PLAS, skip its data chunk, then scan for the next valid record
  // PLAS chunk header: 24 bytes header + variable data
  // Scan after PLAS for the first game tick record (type=0)
  // Validate by checking gameTick value is small (start of game)
  for (let i = plasIdx + 24; i < Math.min(data.length, 5000) - 8; i++) {
    const recordType = data.readUInt32LE(i);
    if (recordType === 0) {
      const tickSize = data.readUInt32LE(i + 4);
      if (tickSize >= 5 && tickSize < 50000) {
        // Validate: gameTick should be small at the start of the stream
        const gameTick = data.readUInt32LE(i + 8 + 1);
        if (gameTick < 200) {
          return i;
        }
      }
    }
  }

  throw new Error('Cannot find replay stream after PLAS');
}

/**
 * Extract PLAS player IDs from the replay header.
 */
function extractPlayerIds(data: Buffer): number[] {
  // Find the GRIF (game info) section which contains player slot data
  // Look for player IDs: scan for the pattern where PLAS IDs appear
  // In the game setup, player IDs 1000+ are real players
  const ids: number[] = [];

  // Scan the header area for the PLAS chunk
  const plasStr = 'PLAS';
  for (let i = 0; i < Math.min(data.length, 3000); i++) {
    if (data.toString('ascii', i, i + 4) === plasStr) {
      // PLAS chunk found - read its header to get data size
      // Relic Chunky DATA chunk: 4 bytes type + 4 bytes name + 4 bytes version + 4 bytes dataSize + 4 bytes nameSize + ...
      // The structure after PLAS marker varies, scan for valid player IDs
      for (let j = i + 4; j < Math.min(i + 200, data.length - 4); j++) {
        const val = data.readUInt32LE(j);
        if (val >= 1000 && val <= 1100) {
          if (!ids.includes(val)) {
            ids.push(val);
          }
        }
      }
      break;
    }
  }

  return ids.length > 0 ? ids : [1000, 1002]; // fallback
}

/**
 * Parse commands from the replay stream, extracting positions.
 */
function parseCommandStream(data: Buffer, streamOffset: number): {
  commands: ReplayCommand[];
  rawBuildCmds: RawBuildCommand[];
  totalTicks: number;
} {
  const commands: ReplayCommand[] = [];
  const rawBuildCmds: RawBuildCommand[] = [];
  let off = streamOffset;
  let totalTicks = 0;

  while (off < data.length - 8) {
    const recordType = data.readUInt32LE(off);

    if (recordType === 0) {
      // Game tick record
      const tickSize = data.readUInt32LE(off + 4);
      const payloadStart = off + 8;
      const payloadEnd = payloadStart + tickSize;

      if (payloadEnd > data.length || tickSize < 13) {
        off += 8 + Math.max(tickSize, 0);
        totalTicks++;
        continue;
      }

      const gameTick = data.readUInt32LE(payloadStart + 1);
      const blockCount = data.readUInt32LE(payloadStart + 9);

      if (blockCount > 0 && blockCount < 100) {
        let blockOff = payloadStart + 13;

        for (let bi = 0; bi < blockCount; bi++) {
          if (blockOff + 12 > payloadEnd) break;
          const blkSize = data.readUInt32LE(blockOff + 8);
          let cmdStart = blockOff + 12;
          const cmdEndLimit = Math.min(cmdStart + blkSize, payloadEnd);

          while (cmdStart + 22 < cmdEndLimit) {
            const cmdSize = data.readInt16LE(cmdStart);
            if (cmdSize <= 2 || cmdSize > 5000) break;

            const cmdType = data[cmdStart + 2];
            const rawPlayerId = data.readUInt32LE(cmdStart + 18);
            const playerId = rawPlayerId >= 0x10000 ? rawPlayerId >> 16 : rawPlayerId;

            // Estimate unit count from command size.
            // Move commands: 1-unit move ≈ 43 bytes, each extra unit adds ~4 bytes.
            // Construct commands: always 1 building.
            const unitCount = (cmdType === CMD_MOVE || cmdType === CMD_PATROL ||
                               cmdType === CMD_ATTACK_MOVE)
              ? Math.max(1, Math.round((cmdSize - 39) / 4))
              : 1;

            // Capture raw bytes for build order commands (BuildUnit, Upgrade, Construct)
            if (cmdType === CMD_BUILD_UNIT || cmdType === CMD_UPGRADE || cmdType === CMD_CONSTRUCT) {
              const safeEnd = Math.min(cmdStart + cmdSize, data.length);
              const rawBytes = Buffer.alloc(safeEnd - cmdStart);
              data.copy(rawBytes, 0, cmdStart, safeEnd);

              const rawCmd: RawBuildCommand = {
                tick: gameTick,
                time: gameTick / TICKS_PER_SECOND,
                cmdType,
                playerId,
                cmdSize,
                rawBytes,
              };

              // Extract coords for Construct commands
              if (cmdType === CMD_CONSTRUCT && cmdSize >= 48 && cmdStart + 47 <= data.length) {
                const fx = data.readFloatLE(cmdStart + 35);
                const fz = data.readFloatLE(cmdStart + 43);
                if (Number.isFinite(fx) && Number.isFinite(fz) &&
                    Math.abs(fx) < 500 && Math.abs(fz) < 500) {
                  rawCmd.x = fx;
                  rawCmd.z = fz;
                }
              }

              rawBuildCmds.push(rawCmd);
            }

            // Find position data within the command.
            let foundPos = false;

            if (cmdType === CMD_CONSTRUCT && cmdSize >= 48) {
              // ConstructCommand: coordinates at fixed offset 35 (verified from hex analysis)
              if (cmdStart + 47 <= data.length) {
                const fx = data.readFloatLE(cmdStart + 35);
                const fy = data.readFloatLE(cmdStart + 39);
                const fz = data.readFloatLE(cmdStart + 43);

                if (Number.isFinite(fx) && Number.isFinite(fz) &&
                    Math.abs(fx) < 500 && Math.abs(fz) < 500) {
                  commands.push({
                    tick: gameTick,
                    time: gameTick / TICKS_PER_SECOND,
                    cmdType,
                    playerId,
                    x: fx, y: fy, z: fz,
                    unitCount: 1,
                  });
                  foundPos = true;
                }
              }
            }

            if (!foundPos) {
              // Default: scan for attribute marker byte=2 followed by 3 floats
              for (let j = 22; j < Math.min(cmdSize - 12, 300); j++) {
                if (cmdStart + j + 13 <= data.length && data[cmdStart + j] === 2) {
                  const fx = data.readFloatLE(cmdStart + j + 1);
                  const fy = data.readFloatLE(cmdStart + j + 5);
                  const fz = data.readFloatLE(cmdStart + j + 9);

                  if (fx > -500 && fx < 500 && fz > -500 && fz < 500 && Math.abs(fy) < 100) {
                    commands.push({
                      tick: gameTick,
                      time: gameTick / TICKS_PER_SECOND,
                      cmdType,
                      playerId,
                      x: fx, y: fy, z: fz,
                      unitCount,
                    });
                  }
                  break;
                }
              }
            }

            cmdStart += cmdSize;
          }
          blockOff = cmdEndLimit;
        }
      }

      totalTicks++;
      off += 8 + tickSize;
    } else if (recordType === 1) {
      // Chat message
      const msgSize = data.readUInt32LE(off + 4);
      off += 8 + msgSize;
    } else {
      break;
    }
  }

  return { commands, rawBuildCmds, totalTicks };
}

/**
 * Extract build order events from raw commands by scanning for known pbgids.
 * For Construct: pbgid at bytes 31-34 (verified).
 * For BuildUnit/Upgrade: heuristic scan - read all int32 values and match against known pbgids.
 */
function extractBuildOrderEvents(rawCmds: RawBuildCommand[], playerIds: number[]): BuildOrderEvent[] {
  const { buildings, units, technologies } = getPbgidSets();
  const events: BuildOrderEvent[] = [];

  function pushEvent(cmd: RawBuildCommand, eventType: BuildOrderEvent['eventType'], pbgid: number) {
    const entry = lookupPbgid(pbgid);
    if (!entry) return;
    const ageUp = isAgeUpEvent(entry);
    events.push({
      tick: cmd.tick,
      time: cmd.time,
      playerId: cmd.playerId,
      eventType,
      pbgid,
      name: entry.name,
      icon: entry.icon,
      displayClass: entry.displayClass,
      x: cmd.x,
      z: cmd.z,
      costs: entry.costs,
      age: entry.age,
      classes: entry.classes,
      baseId: entry.baseId,
      isAgeUp: ageUp.isAgeUp,
      targetAge: ageUp.targetAge,
    });
  }

  for (const cmd of rawCmds) {
    if (!playerIds.includes(cmd.playerId)) continue;

    let matchedPbgid: number | undefined;

    if (cmd.cmdType === CMD_CONSTRUCT) {
      if (cmd.rawBytes.length >= 35) {
        const candidate = cmd.rawBytes.readUInt32LE(31);
        if (buildings.has(candidate)) {
          matchedPbgid = candidate;
        } else {
          for (let off = 27; off <= Math.min(38, cmd.rawBytes.length - 4); off++) {
            const val = cmd.rawBytes.readUInt32LE(off);
            if (buildings.has(val)) { matchedPbgid = val; break; }
          }
        }
      }
      if (matchedPbgid) pushEvent(cmd, 'construct', matchedPbgid);

    } else if (cmd.cmdType === CMD_BUILD_UNIT) {
      for (let off = 3; off <= cmd.rawBytes.length - 4; off++) {
        const val = cmd.rawBytes.readUInt32LE(off);
        if (units.has(val)) { matchedPbgid = val; break; }
      }
      if (matchedPbgid) pushEvent(cmd, 'build_unit', matchedPbgid);

    } else if (cmd.cmdType === CMD_UPGRADE) {
      for (let off = 3; off <= cmd.rawBytes.length - 4; off++) {
        const val = cmd.rawBytes.readUInt32LE(off);
        if (technologies.has(val)) { matchedPbgid = val; break; }
      }
      if (matchedPbgid) pushEvent(cmd, 'upgrade', matchedPbgid);
    }
  }

  events.sort((a, b) => a.time - b.time);

  const ageUps = events.filter(e => e.isAgeUp);
  console.log(`[replay-parser] Build order events: ${events.length} (construct=${events.filter(e => e.eventType === 'construct').length}, build_unit=${events.filter(e => e.eventType === 'build_unit').length}, upgrade=${events.filter(e => e.eventType === 'upgrade').length})`);
  if (ageUps.length > 0) {
    console.log(`[replay-parser] Age-ups detected: ${ageUps.map(a => `Age ${a.targetAge} at ${Math.floor(a.time / 60)}:${String(Math.floor(a.time % 60)).padStart(2, '0')} (${a.name})`).join(', ')}`);
  }

  return events;
}

/**
 * Convert raw commands into entities for the transformer.
 *
 * Based on analysis of the Java aoe4replayanalyzer:
 * - ConstructCommand (123) = actual building placement with real coordinates
 * - SetRallyPointCommand (12) = rally points from buildings (building proxy positions)
 * - SupportConstructionCommand (65) = villagers helping build (NO coordinates)
 * - MoveCommand (62), PatrolCommand (116) = unit movement with coordinates
 * - AttackMoveCommand (71), AttackGroundCommand (67) = combat with coordinates
 */
function commandsToEntities(
  commands: ReplayCommand[],
  playerIds: number[],
  duration: number
): Map<number, ParsedEntity[]> {
  const entitiesPerPlayer = new Map<number, ParsedEntity[]>();
  for (const pid of playerIds) {
    entitiesPerPlayer.set(pid, []);
  }

  let nextId = 1;

  // Group commands by player
  const byPlayer = new Map<number, ReplayCommand[]>();
  for (const cmd of commands) {
    if (!playerIds.includes(cmd.playerId)) continue;
    if (!byPlayer.has(cmd.playerId)) byPlayer.set(cmd.playerId, []);
    byPlayer.get(cmd.playerId)!.push(cmd);
  }

  for (const [playerId, playerCmds] of byPlayer) {
    const entities = entitiesPerPlayer.get(playerId) ?? [];

    // --- Buildings from ConstructCommand (type 123) ---
    // This is the ACTUAL building placement command with real coordinates.
    // The Java analyzer confirms ConstructCommand implements CoordinateCommand.
    const constructCmds = playerCmds.filter(c => c.cmdType === CMD_CONSTRUCT);
    for (const cmd of constructCmds) {
      entities.push({
        id: nextId++,
        entityType: 'building_construct',
        category: 'Building',
        spawnTimestamp: cmd.time,
        spawnX: cmd.x,
        spawnY: cmd.z,
        deathTimestamp: null,
        deathX: null,
        deathY: null,
        killerPlayerId: null,
        unitCount: 1,
      });
    }

    // --- Buildings from rally point commands (type 12) ---
    // SetRallyPointCommand has building IDs + coordinates.
    // Rally points indicate where a building is sending units, but the position
    // is the rally target, not the building itself. However, early rally points
    // (before much movement) often cluster near buildings.
    // We deduplicate: skip rally points that are very close to a construct command.
    const rallyPointCmds = playerCmds.filter(c => c.cmdType === CMD_RALLY_POINT);
    for (const cmd of rallyPointCmds) {
      // Skip if very close to an existing construct building (within ~10 units)
      const tooClose = constructCmds.some(b =>
        Math.abs(b.x - cmd.x) < 10 && Math.abs(b.z - cmd.z) < 10
      );
      if (!tooClose) {
        entities.push({
          id: nextId++,
          entityType: 'building_rally',
          category: 'Building',
          spawnTimestamp: cmd.time,
          spawnX: cmd.x,
          spawnY: cmd.z,
          deathTimestamp: null,
          deathX: null,
          deathY: null,
          killerPlayerId: null,
          unitCount: 1,
        });
      }
    }

    // --- Unit movement (Move=62, Patrol=116) ---
    // Chain sequential commands: each entity lives until the next command arrives,
    // interpolating from current position to next position.
    // This means only 1-2 entities per player are visible at any time (instead of dozens).
    const moveCmds = playerCmds
      .filter(c => c.cmdType === CMD_MOVE || c.cmdType === CMD_PATROL)
      .sort((a, b) => a.time - b.time);

    // Filter out near-duplicate positions (micro-adjustments < 3 map units apart)
    const filteredMoves: ReplayCommand[] = [];
    for (const cmd of moveCmds) {
      const prev = filteredMoves[filteredMoves.length - 1];
      if (prev && Math.abs(cmd.x - prev.x) < 3 && Math.abs(cmd.z - prev.z) < 3 &&
          cmd.time - prev.time < 2) {
        // Skip near-duplicate, but keep the larger unitCount
        if (cmd.unitCount > prev.unitCount) prev.unitCount = cmd.unitCount;
        continue;
      }
      filteredMoves.push({ ...cmd });
    }

    for (let i = 0; i < filteredMoves.length; i++) {
      const cmd = filteredMoves[i];
      const next = filteredMoves[i + 1];

      // Entity lives until the next command (+ 1s overlap for smooth transition)
      // If no next command, fade out after 5 seconds
      const endTime = next
        ? Math.min(next.time + 1, cmd.time + 30)
        : Math.min(cmd.time + 5, duration);

      // Interpolate toward next command position (or stay in place)
      const deathX = next ? next.x : cmd.x;
      const deathZ = next ? next.z : cmd.z;

      entities.push({
        id: nextId++,
        entityType: 'unit_activity',
        category: 'Unit',
        spawnTimestamp: cmd.time,
        spawnX: cmd.x,
        spawnY: cmd.z,
        deathTimestamp: endTime,
        deathX,
        deathY: deathZ,
        killerPlayerId: null,
        unitCount: cmd.unitCount,
      });
    }

    // --- Combat activity (AttackMove=71, AttackGround=67) ---
    // Chain combat commands similarly to move commands.
    const combatCmds = playerCmds
      .filter(c => c.cmdType === CMD_ATTACK_MOVE || c.cmdType === CMD_ATTACK_GROUND)
      .sort((a, b) => a.time - b.time);

    for (let i = 0; i < combatCmds.length; i++) {
      const cmd = combatCmds[i];
      const next = combatCmds[i + 1];
      const endTime = next
        ? Math.min(next.time + 1, cmd.time + 20)
        : Math.min(cmd.time + 8, duration);

      entities.push({
        id: nextId++,
        entityType: 'unit_combat',
        category: 'Unit',
        spawnTimestamp: cmd.time,
        spawnX: cmd.x,
        spawnY: cmd.z,
        deathTimestamp: endTime,
        deathX: next ? next.x : cmd.x,
        deathY: next ? next.z : cmd.z,
        killerPlayerId: playerId === playerIds[0] ? playerIds[1] : playerIds[0],
        unitCount: cmd.unitCount,
      });
    }

    // --- Ability usage (UseAbility=72, Deploy=96) ---
    // These have coordinates showing where abilities/deployments happen.
    const abilityCmds = playerCmds.filter(
      c => c.cmdType === CMD_USE_ABILITY || c.cmdType === CMD_DEPLOY
    );
    for (const cmd of abilityCmds) {
      entities.push({
        id: nextId++,
        entityType: 'unit_ability',
        category: 'Unit',
        spawnTimestamp: cmd.time,
        spawnX: cmd.x,
        spawnY: cmd.z,
        deathTimestamp: cmd.time + 10,
        deathX: cmd.x,
        deathY: cmd.z,
        killerPlayerId: null,
        unitCount: cmd.unitCount,
      });
    }

    entitiesPerPlayer.set(playerId, entities);
  }

  return entitiesPerPlayer;
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Parse a gzip-compressed replay buffer into structured data.
 */
export function parseReplayBuffer(gzipBuffer: Buffer): ParsedReplay {
  // Decompress
  const data = zlib.gunzipSync(gzipBuffer);
  console.log(`[replay-parser] Decompressed: ${data.length} bytes`);

  // Verify header
  const header = data.toString('ascii', 4, 12);
  if (!header.startsWith('AOE4_RE')) {
    throw new Error(`Not an AoE4 replay file (header: ${header})`);
  }

  // Extract player IDs from header
  const playerIds = extractPlayerIds(data);
  console.log(`[replay-parser] Player IDs: ${playerIds.join(', ')}`);

  // Find command stream
  const streamOffset = findStreamOffset(data);
  console.log(`[replay-parser] Stream offset: ${streamOffset}`);

  // Initialize aoe4 data lookup (lazy load)
  getAoe4Lookup();

  // Parse commands
  const { commands, rawBuildCmds, totalTicks } = parseCommandStream(data, streamOffset);
  const duration = Math.floor(totalTicks / TICKS_PER_SECOND);
  console.log(`[replay-parser] Ticks: ${totalTicks}, Duration: ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`);
  console.log(`[replay-parser] Commands with positions: ${commands.length}`);

  // Diagnostic: command type distribution
  const cmdTypeCounts = new Map<number, number>();
  for (const cmd of commands) {
    cmdTypeCounts.set(cmd.cmdType, (cmdTypeCounts.get(cmd.cmdType) ?? 0) + 1);
  }
  const CMD_NAMES: Record<number, string> = {
    3: 'BuildUnit', 12: 'RallyPoint', 14: 'DeleteBuilding', 16: 'Upgrade',
    56: 'CancelConstruct', 62: 'Move', 63: 'StopMove', 65: 'SupportConstruct',
    67: 'AttackGround', 71: 'AttackMove', 72: 'UseAbility', 73: 'Garrison',
    96: 'Deploy', 109: 'StandGround', 116: 'Patrol', 123: 'Construct',
  };
  const distribution = [...cmdTypeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `${CMD_NAMES[type] ?? `Unknown(${type})`}=${count}`)
    .join(', ');
  console.log(`[replay-parser] Command types: ${distribution}`);

  // Extract build order events
  const buildOrderEvents = extractBuildOrderEvents(rawBuildCmds, playerIds);

  // Convert commands to entities
  const entitiesPerPlayer = commandsToEntities(commands, playerIds, duration);

  // Build output matching transformer's expected format
  const players: ParsedPlayer[] = playerIds.map((pid, idx) => {
    const entities = entitiesPerPlayer.get(pid) ?? [];
    return {
      playerId: idx,
      playerName: `Player ${idx + 1}`,
      playerColor: idx,
      civ: 'Unknown',
      outcome: 'unknown',
      units: entities,
      startingUnits: [],
    };
  });

  const totalEntities = players.reduce((s, p) => s + p.units.length, 0);
  console.log(`[replay-parser] Generated ${totalEntities} entities for ${players.length} players`);

  return {
    gameSummary: {
      duration,
      mapName: 'Unknown',
      players,
    },
    replaySummary: {
      dataSTLS: { gameLength: duration },
    },
    buildOrderEvents,
    commands,
  };
}
