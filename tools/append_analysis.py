"""Append ID mappings and architecture summary to parser_analysis.txt"""
import struct, os

base_dir = 'C:/Users/fermi/aoe4-replay-viewer/tools/aoe4analyzer/extracted/ch.iddqd.aoe4.parser'
output_file = 'C:/Users/fermi/aoe4-replay-viewer/tools/parser_analysis.txt'

def get_static_int_fields(filepath):
    with open(filepath, 'rb') as f:
        data = f.read()
    pos = 8
    cp_count = struct.unpack_from('>H', data, pos)[0]; pos += 2
    cp = [None]
    i = 1
    while i < cp_count:
        tag = data[pos]; pos += 1
        if tag == 1:
            ln = struct.unpack_from('>H', data, pos)[0]; pos += 2
            s = data[pos:pos+ln].decode('utf-8', errors='replace'); pos += ln
            cp.append(('UTF8', s))
        elif tag == 3:
            val = struct.unpack_from('>i', data, pos)[0]; pos += 4
            cp.append(('Integer', val))
        elif tag == 4: pos += 4; cp.append(None)
        elif tag == 5: pos += 8; cp.append(None); i += 1; cp.append(None)
        elif tag == 6: pos += 8; cp.append(None); i += 1; cp.append(None)
        elif tag == 7: pos += 2; cp.append(('Class',))
        elif tag == 8: pos += 2; cp.append(('String',))
        elif tag in (9,10,11): pos += 4; cp.append(('Ref',))
        elif tag == 12: pos += 4; cp.append(('NAT',))
        elif tag == 15: pos += 3; cp.append(None)
        elif tag == 16: pos += 2; cp.append(None)
        elif tag in (17,18): pos += 4; cp.append(None)
        elif tag in (19,20): pos += 2; cp.append(None)
        else: break
        i += 1
    pos += 6
    iface_count = struct.unpack_from('>H', data, pos)[0]; pos += 2
    pos += iface_count * 2
    fields_count = struct.unpack_from('>H', data, pos)[0]; pos += 2
    results = {}
    for _ in range(fields_count):
        facc = struct.unpack_from('>H', data, pos)[0]; pos += 2
        fname_idx = struct.unpack_from('>H', data, pos)[0]; pos += 2
        fdesc_idx = struct.unpack_from('>H', data, pos)[0]; pos += 2
        fname = cp[fname_idx][1] if cp[fname_idx] and cp[fname_idx][0] == 'UTF8' else '?'
        fdesc = cp[fdesc_idx][1] if cp[fdesc_idx] and cp[fdesc_idx][0] == 'UTF8' else '?'
        fattrs_count = struct.unpack_from('>H', data, pos)[0]; pos += 2
        for _ in range(fattrs_count):
            aname_idx = struct.unpack_from('>H', data, pos)[0]; pos += 2
            alen = struct.unpack_from('>I', data, pos)[0]; pos += 4
            aname = cp[aname_idx][1] if cp[aname_idx] and cp[aname_idx][0] == 'UTF8' else '?'
            if aname == 'ConstantValue' and fdesc == 'I':
                cv_idx = struct.unpack_from('>H', data, pos)[0]
                if cv_idx < len(cp) and cp[cv_idx] and cp[cv_idx][0] == 'Integer':
                    results[fname] = cp[cv_idx][1]
            pos += alen
    return results

with open(output_file, 'a', encoding='utf-8') as out:
    out.write('\n\n')
    out.write('=' * 80 + '\n')
    out.write('APPENDIX A: COMMAND TYPE ID -> NAME MAPPINGS\n')
    out.write('=' * 80 + '\n\n')
    out.write('These are the integer command type IDs used in the replay binary format.\n')
    out.write('The ParserProvider.getParser(int) method maps these IDs to specific parsers.\n\n')

    ct = get_static_int_fields(os.path.join(base_dir, 'ch/iddqd/aoe4/parser/commandCommandType.class'))
    for name, val in sorted(ct.items(), key=lambda x: x[1]):
        out.write(f'  {val:>6} (0x{val & 0xFF:02X}) = {name}\n')

    out.write('\n\n')
    out.write('=' * 80 + '\n')
    out.write('APPENDIX B: ACTION TYPE ID MAPPINGS\n')
    out.write('=' * 80 + '\n\n')

    at = get_static_int_fields(os.path.join(base_dir, 'ch/iddqd/aoe4/parser/typeActionType.class'))
    for name, val in sorted(at.items(), key=lambda x: x[1]):
        out.write(f'  {val:>8} (0x{val & 0xFFFF:04X}) = {name}\n')

    out.write('\n\n')
    out.write('=' * 80 + '\n')
    bt = get_static_int_fields(os.path.join(base_dir, 'ch/iddqd/aoe4/parser/typeBuildingType.class'))
    out.write(f'APPENDIX C: BUILDING TYPE ID MAPPINGS (all {len(bt)} entries)\n')
    out.write('=' * 80 + '\n\n')

    for name, val in sorted(bt.items(), key=lambda x: x[1]):
        out.write(f'  {val:>8} (0x{val & 0xFFFF:04X}) = {name}\n')

    out.write('\n\n')
    out.write('=' * 80 + '\n')
    out.write('APPENDIX D: UNIT TYPE ID MAPPINGS\n')
    out.write('=' * 80 + '\n\n')

    ut = get_static_int_fields(os.path.join(base_dir, 'ch/iddqd/aoe4/parser/typeUnitType.class'))
    for name, val in sorted(ut.items(), key=lambda x: x[1]):
        out.write(f'  {val:>8} (0x{val & 0xFFFF:04X}) = {name}\n')

    out.write('\n\n')
    out.write('=' * 80 + '\n')
    upt = get_static_int_fields(os.path.join(base_dir, 'ch/iddqd/aoe4/parser/typeUpgradeType.class'))
    out.write(f'APPENDIX E: UPGRADE TYPE ID MAPPINGS (all {len(upt)} entries)\n')
    out.write('=' * 80 + '\n\n')

    for name, val in sorted(upt.items(), key=lambda x: x[1]):
        out.write(f'  {val:>8} (0x{val & 0xFFFF:04X}) = {name}\n')

    # Architecture summary
    out.write('\n\n')
    out.write('=' * 80 + '\n')
    out.write('APPENDIX F: PARSER ARCHITECTURE SUMMARY\n')
    out.write('=' * 80 + '\n\n')

    summary = """
REPLAY FILE FORMAT SUMMARY
===========================

1. FILE HEADER
   - Starts with "AOE4_RE" magic identifier
   - Contains file version, date, chunk version, tick count
   - Map information (name, size, biome, seed, minimap)
   - Player list (name, team, position, civilization, variant, steamId, color)
   - Game settings (key-value pairs)
   - All multi-byte integers are LITTLE-ENDIAN (hence LEDataInputStream)

2. MESSAGE STREAM
   Messages are parsed by MessageParser. Two types:
   - CmdMessage: Contains game commands (the main data)
   - TextMessage: Chat messages between players

3. COMMAND STRUCTURE
   Each command packet has:
   - CommandList: playerId (int), actionType (int), totalLength (int), commands[]
   - Command: length (short), type (byte), SubCommand data
   - The type byte determines which SubCommand parser to use (see CommandType mapping)

4. COMMAND PARSING (ParserProvider)
   ParserProvider.getParser(int commandType) returns the appropriate CommandParser:

   Type  0x03 (3)   -> BuildUnitCommandParser
   Type  0x05 (5)   -> CancelUnitCommandParser
   Type  0x0C (12)  -> SetRallyPointCommandParser
   Type  0x0E (14)  -> ActionCommandParser (DELETE_BUILDING action)
   Type  0x10 (16)  -> UpgradeCommandParser
   Type  0x14 (20)  -> UngarrisonCommandParser
   Type  0x38 (56)  -> CancelConstructCommandParser
   Type  0x3E (62)  -> MoveCommandParser
   Type  0x3F (63)  -> StopMoveCommandParser
   Type  0x41 (65)  -> SupportConstructionCommandParser
   Type  0x43 (67)  -> AttackGroundCommandParser
   Type  0x47 (71)  -> AttackMoveCommandParser
   Type  0x48 (72)  -> UseAbilityCommandParser
   Type  0x49 (73)  -> GarrisonCommandParser
   Type  0x60 (96)  -> DeployCommandParser
   Type  0x69 (105) -> SendCommandParser
   Type  0x6D (109) -> StandGroundCommandParser
   Type  0x72 (114) -> DisableAbilityCommandParser
   Type  0x74 (116) -> PatrolCommandParser
   Type  0x7B (123) -> ConstructCommandParser
   Other types      -> UnknownCommandParser or IgnoredCommandParser

5. SUBCOMMAND DATA STRUCTURES
   Each SubCommand has base fields:
   - tick (int): Game tick number
   - playerCmdNum (int): Player command sequence number
   - playerId (int): Player who issued the command
   - type (int): Sub-type for disambiguation
   - name (String): Human-readable command name

   Common parsed components:
   - Units: List of Unit objects (id=int) - parseUnit(), parseUnit2(), etc.
   - Buildings: List of Building objects (id=int) - parseBuilding2(), etc.
   - Coordinates: Coordinates2D (x=float, y=float) - parseCoordinates()
   - Resources: Resource objects (id=int) - parseResource()
   - Type codes: Integer IDs mapped to BuildingGeneratedTypeEnum, UnitGeneratedTypeEnum, etc.

6. ENTITY ID SYSTEM
   Entities are identified by integer IDs in the command stream.
   The EntityDirectory class tracks entity assignments:
   - Builds a mapping of entityId -> EntityType (VILLAGER, SCOUT, SHEEP, etc.)
   - Uses command history to infer which entity IDs belong to which types
   - Tracks per-player entity assignments
   - EntityEntry: {tick, entityId, playerId, entityType}

7. GENERATED TYPE ENUMS (Large mappings from game data)
   - BuildingGeneratedTypeEnum: 1045 entries (e.g., building_defense_keep_eng -> int value)
   - UnitGeneratedTypeEnum: 1861 entries (e.g., unit_archer_2_eng -> int value)
   - UpgradeGeneratedTypeEnum: 1199 entries (e.g., upgrade_abbey_king_castle_1 -> int value)
   - AbilityGeneratedTypeEnum: 1209 entries (e.g., age_up_castle -> int value)

   These map game data file IDs to human-readable names.

8. DATA READING UTILITIES
   LEDataInputStream extends DataInputStream for little-endian reading:
   - readIntLE(): Read 4-byte little-endian integer
   - readShortLE(): Read 2-byte little-endian short
   - readFloatLE(): Read 4-byte little-endian float
   - readUnsignedShortLe(): Read 2-byte unsigned short
   - read3ByteInt() / read3ByteIntLe(): Read 3-byte integer
   - readString(length), readCString(): Read fixed/null-terminated ASCII strings
   - readUnicodeString(length), readUnicodeCString(): Read Unicode strings
   - readStringWithLength(), readUnicodeStringWithLength(): Length-prefixed strings
   - skipInts(count): Skip N integers

9. PARSER FLOW
   ReplayParser.parse(inputStream):
     1. Read magic "AOE4_RE" header
     2. HeaderParser.parse() -> Header object
        a. Read file version, date, chunk info
        b. SettingParser.parseSettings() -> game settings
        c. PlayerParser.parsePlayers() -> player list
        d. MapParser.parseMap() -> map info (generated or crafted)
     3. Loop: MessageParser.parse() -> Message objects
        - For CmdMessage: extract command lists
        - For TextMessage: store chat messages
     4. For each CmdMessage, parse CommandList:
        a. Read playerId, actionType, totalLength
        b. For each Command in list:
           - Read length (short), type (byte)
           - ParserProvider.getParser(type) -> CommandParser
           - CommandParser.parse() -> SubCommand
     5. Build GameLog, ApmGraph, EntityDirectory from commands
     6. Apply CommandFilter for filtered view
"""
    out.write(summary)

print('Appendices and summary added to parser_analysis.txt')
