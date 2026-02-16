# AoE4 Build Order Extractor - Continuación

## Estado actual del proyecto

### Lo que ya funciona
- **Parser nativo TypeScript** (`server/src/services/replay-parser.ts`): Parsea replays binarios de AoE4 extrayendo comandos con posiciones (Move, AttackMove, Construct, RallyPoint, etc.)
- **Visualización en mapa** (PIXI.js): Muestra edificios (diamantes), movimientos de ejército (círculos), combate (marcadores X)
- **Servidor** en puerto 3002, **cliente** en puerto 3000
- **Movimiento encadenado**: Cada entidad muere cuando llega el siguiente comando (solo 2-3 marcadores visibles por jugador en vez de docenas)
- **Tipos de edificio confirmados**: bytes 31-34 del ConstructCommand = pbgid que mapea a nombres reales via data.aoe4world.com (ej: 7712467 = Mill Ayyubid, 2985508 = House of Wisdom Ayyubid)

### Lo que estamos construyendo ahora: BUILD ORDER EXTRACTOR
Objetivo: meter una URL de partida y sacar el build order completo por jugador con iconos, timestamps y nombres reales (como aoe4guides.com).

## Plan detallado (aprobado)

Ver: `.claude/plans/dapper-orbiting-waffle.md`

### Paso 1: pbgid → name/icon mappings ← EN PROGRESO
**Archivos descargados** (ya en `server/src/data/`):
- `buildings-raw.json` (1.2MB) — de data.aoe4world.com/buildings/all.json
- `units-raw.json` (2.8MB) — de data.aoe4world.com/units/all.json
- `technologies-raw.json` (2.7MB) — de data.aoe4world.com/technologies/all.json

**Problema encontrado**: La estructura JSON NO es un array simple. Es `{ __note__, __version__, data: [...] }` o similar. Necesitamos inspeccionar la estructura exacta y extraer los arrays.

**Lo que falta hacer**:
1. Inspeccionar la estructura real de cada JSON (puede ser `data[0], data[1]...` o un objeto indexado)
2. Extraer: `pbgid`, `name`, `icon` (URL), `type` (building/unit/technology), `classes` (para unidades: infantry, cavalry, ranged, etc.)
3. Generar `server/src/data/aoe4-data.ts` con un Map<number, {name, icon, type, classes?}>
4. Los iconos son URLs como: `https://data.aoe4world.com/images/units/longbowman-2.png`

### Paso 2: Parsear BuildUnit y Upgrade del replay binary
**Archivo**: `server/src/services/replay-parser.ts`

Actualmente solo capturamos comandos con posiciones. Necesitamos añadir:

- **BuildUnit (tipo 3)**: producción de unidades. No tiene coordenadas. Contiene pbgid del tipo de unidad. Offset del pbgid desconocido — usar heurística: escanear todos los int32 en los bytes del comando y matchear contra pbgids conocidos de unidades.
- **Upgrade (tipo 16)**: investigación de tecnologías. No tiene coordenadas. Contiene pbgid de la tecnología. Mismo enfoque heurístico.
- **Construct (tipo 123)**: ya parseado con coordenadas. Añadir extracción del pbgid en offset 31-34.

Nueva interfaz a crear:
```typescript
interface BuildOrderEvent {
  tick: number;
  time: number;          // seconds
  playerId: number;
  eventType: 'build_unit' | 'construct' | 'upgrade';
  pbgid: number;
  name: string;
  icon: string;
  x?: number;            // solo construct
  z?: number;
}
```

Modificar `parseCommandStream` para retornar `buildOrderEvents` además de `commands`.

### Paso 3: Pipeline API
- `server/src/services/transformer.service.ts`: añadir `buildOrder: BuildOrderEntry[]` a `TimelineData`
- `client/src/types/replay.types.ts`: mirror del tipo
- No necesita nuevo endpoint, va en la respuesta existente de `/api/replay/:id`

### Paso 4: UI del Build Order
**Nuevo archivo**: `client/src/components/BuildOrder/BuildOrder.tsx`

Diseño: dos columnas lado a lado (Jugador 1 | Jugador 2):
- Timestamp (mm:ss)
- Icono (24x24px desde CDN de aoe4world)
- Nombre
- Color por tipo: azul=edificio, verde=unidad, amarillo=tech
- Click en fila → timeline salta a ese momento
- Filtros: All | Buildings | Units | Technologies

### Paso 5: Integración en layout
- Tabs: "Map View" | "Build Order"
- Actualizar `replayStore.ts` con `buildOrder` en el estado

## Archivos clave del proyecto

| Archivo | Qué es |
|---------|--------|
| `server/src/services/replay-parser.ts` | Parser binario del replay |
| `server/src/services/transformer.service.ts` | Transforma datos parseados |
| `server/src/services/parser-proxy.service.ts` | Descarga replays + metadata |
| `server/src/data/` | JSONs descargados de aoe4world (buildings, units, techs) |
| `client/src/pixi/layers/UnitsLayer.ts` | Renderizado de unidades |
| `client/src/pixi/layers/BuildingsLayer.ts` | Renderizado de edificios |
| `client/src/components/Sidebar/Sidebar.tsx` | Panel lateral |
| `client/src/types/replay.types.ts` | Tipos compartidos |
| `client/src/state/replayStore.ts` | Estado Zustand |
| `tools/parser_analysis.txt` | Análisis completo del Java aoe4replayanalyzer |

## Tasks pendientes (IDs del sistema de tareas)
- Task #9: Create pbgid lookup data ← IN PROGRESS
- Task #10: Parse BuildUnit/Upgrade commands (blocked by #9)
- Task #11: Add buildOrder to transformer/API (blocked by #9, #10)
- Task #12: Build Order UI component (blocked by #11)

## Cómo arrancar el proyecto
```bash
# Terminal 1 - Servidor
cd C:\Users\fermi\aoe4-replay-viewer\server
npx tsx src/index.ts
# Escucha en puerto 3002

# Terminal 2 - Cliente
cd C:\Users\fermi\aoe4-replay-viewer\client
npx vite --port 3000
# Escucha en puerto 3000

# Limpiar cache si hay cambios en el parser
rm C:\Users\fermi\aoe4-replay-viewer\server\cache\*.json

# URL de prueba
https://aoe4world.com/players/17272880/games/218807749
# Replay cacheado en server/downloads/218807749.gz
```

## Referencia: Replay parseado actual (218807749)
- 2 jugadores (IDs PLAS: 1000, 1002)
- Duración: 21:56 (10530 ticks)
- Comandos con posición: 4401 (Move=3627, AttackMove=293, RallyPoint=200, Construct=87, AttackGround=8, UseAbility=3)
- Entidades generadas: 2716 (con chaining)
- Un jugador usa Ayyubids (confirmado por pbgids de edificios)

## Instrucción para Claude
Cuando continúes, di: "Continúa con el build order extractor. Lee CONTINUE.md para el contexto."
