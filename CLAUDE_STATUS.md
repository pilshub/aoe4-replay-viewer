# Estado del Proyecto AoE4 Replay Viewer
## Ultima actualizacion: 2026-02-19

## QUE ES ESTE PROYECTO
Visor web de replays de Age of Empires 4. El usuario pega una URL de aoe4world.com, el backend descarga y parsea el replay binario (.rec), extrae build orders, analiza estrategias, genera un analisis narrativo con IA (GPT-4o), y el frontend lo visualiza en un dashboard interactivo con mapa PixiJS, graficas Recharts y panel de analisis.

## ARQUITECTURA
- **Client**: React 18 + PixiJS 8 + Zustand + Recharts + Tailwind (puerto 3000)
- **Server**: Express + TypeScript (puerto 3002)
- **AI**: OpenAI GPT-4o (~2.8 cents/analisis con datos enriquecidos)
- **Deploy**: Railway (railway.toml presente, no activamente desplegado)

## PIPELINE DE DATOS
```
URL aoe4world → descarga replay .rec.gz + metadata JSON
                      ↓
              replay-parser.ts (parser binario nativo TypeScript)
              Extrae: comandos, build orders, posiciones, pbgids
                      ↓
              summary-parser.ts (parser STPD de game summary)
              Extrae: kills, deaths, recursos, scores, timeline
                      ↓
              transformer.service.ts (normalizacion + enriquecimiento)
              Mapea pbgids → nombres/iconos, normaliza coordenadas
                      ↓
              strategy-analyzer.ts (clasificacion de estrategia)
              5 estrategias: Feudal Rush, Fast Castle, Boom, Tower Rush, Standard
                      ↓
              match-analyzer.ts (analisis profundo algoritmico)
              Scores 0-100 (Macro, Economy, Military, Tech), army snapshots, combats
                      ↓
              ai-narrator.ts (GPT-4o narrativa)
              Genera analisis narrativo en español/ingles con iconos inline
                      ↓
              Frontend: mapa PixiJS + build order + graficas + analisis IA
```

## FUENTES DE DATOS (3 fuentes)
1. **aoe4replays.gg**: Replay binario (.rec) — comando stream con posiciones, build orders
2. **aoe4world.com**: Metadata JSON — nombres jugadores, civs, ELO, resultado
3. **Game client summary files** (.rec contiene seccion STPD): Stats completas — kills, deaths, recursos, scores, timeline cada 20s
   - IMPORTANTE: Solo los replays con seccion Relic Chunky contienen STPD
   - Los replays descargados de aoe4replays.gg NO siempre incluyen STPD
   - Los archivos de summary del game client local SIEMPRE lo tienen

## DATOS QUE EXTRAE EL SUMMARY PARSER (summary-parser.ts)
Por jugador:
- **Combate**: unitsKilled, unitsKilledResourceValue, unitsLost, unitsLostResourceValue
- **Edificios**: buildingsRazed, buildingsLost
- **Produccion**: unitsProduced, unitsProducedInfantry, largestArmy, techResearched
- **Recursos**: totalResourcesGathered (F/G/S/W), totalResourcesSpent, totalResourcesSpentOnUpgrades
- **Map control**: sacredSitesCaptured/Lost/Neutralized, relicsCaptured
- **Ages**: age2Timestamp, age3Timestamp, age4Timestamp (en segundos)
- **Timeline** (cada ~20s): resourcesCurrent, resourcesPerMinute, resourcesCumulative, scoreTotal/Economy/Military/Society/Technology

## ESTRATEGIAS DETECTADAS
1. Feudal Rush (aggressive early)
2. Fast Castle (skip feudal military)
3. Economic Boom (Double TC o Trade)
4. Tower Rush (early towers)
5. Standard (balanced)
Nota: "All-in" eliminada por decision del usuario (no tiene sentido en AoE4).

## AI NARRATOR — INSTRUCCIONES GPT-4o
Modelo: gpt-4o (antes gpt-4o-mini)
Coste: ~2.8 cents/analisis (con datos enriquecidos de summary)

El prompt incluye:
- Build order completo por jugador
- Player scores (0-100): Macro, Economy, Military, Tech
- Army composition snapshots al 25%, 50%, 75%, 100% del match
- Economy summary (villager production, TC timing, market usage)
- Key moments detectados algoritmicamente
- **Si hay summary data**: Combat stats reales (K/D, eficiencia, recursos), total resources gathered, score timeline

Reglas del narrador:
- Maximo 6 parrafos, 300-500 palabras
- Tono analitico de caster profesional
- Solo afirmar hechos respaldados por datos
- NO inventar batallas, timings o unidades que no aparecen en los datos
- Usar iconos inline con formato [icon:nombre]
- Referencia a datos de combate cuando disponibles

## FORMATO BINARIO — Relic Chunky / STPD
El parser de summary (summary-parser.ts) es un port completo del parser .NET en:
`replays-parser-src/AoE4WorldReplaysParser/Models/DataSTPD.cs`

Formato:
- Busca marcador "Relic Chunky\r\n" en el buffer
- Salta header (24 bytes)
- Recorre arbol de chunks FOLD/DATA
- Parsea nodos DATA con nombre "STPD" (versiones 2029, 2030, 2033)
- Campos secuenciales: int32 (LE), floats, PrefixedString (int32 len + UTF8), PrefixedUnicodeString (int32 len + UTF16)
- ResourceDict: int32 keyPairCount (8 o 9) + pares (string key, float value). Keys: action, command, food, gold, merc_byz?, militia_hre, popcap, stone, wood

Bug encontrado y corregido:
- unknown5n-5v son 9 campos (n,o,p,q,r,s,t,u,v), no 8. El off-by-one causaba que el parser leyera 4 bytes desalineado al llegar al primer ResourceDict.

Validado contra 18 archivos de ejemplo (5.x a 15.x), 100% exito.

## ARCHIVOS CLAVE

### Server
| Archivo | Que hace |
|---------|----------|
| `server/src/services/replay-parser.ts` | Parser binario del replay (comandos, build order, posiciones) |
| `server/src/services/summary-parser.ts` | **NUEVO** Parser STPD (kills, resources, scores, timeline) |
| `server/src/services/transformer.service.ts` | Pipeline transformacion: normaliza + enriquece datos |
| `server/src/services/ai-narrator.ts` | Generacion de narrativa con GPT-4o |
| `server/src/services/strategy-analyzer.ts` | Clasificacion de estrategia (score-based) |
| `server/src/services/match-analyzer.ts` | Analisis profundo algoritmico (scores, army, economy) |
| `server/src/services/parser-proxy.service.ts` | Descarga replays + metadata de aoe4world |
| `server/src/data/aoe4-meta.ts` | Knowledge base de estrategias y meta |
| `server/src/data/aoe4-data.ts` | Mapeo pbgid → nombre/icono (955+ entidades) |
| `server/src/utils/entity-classifier.ts` | Clasifica entidades en building/unit/other |
| `server/src/utils/coordinate-normalizer.ts` | Normaliza coordenadas del mapa |

### Client
| Archivo | Que hace |
|---------|----------|
| `client/src/pixi/` | Capas PixiJS (unidades, edificios, muertes, heatmap) |
| `client/src/components/` | Componentes React (Sidebar, BuildOrder, Analysis, etc.) |
| `client/src/state/replayStore.ts` | Estado Zustand |
| `client/src/types/replay.types.ts` | Tipos compartidos |

### Datos
| Archivo | Que es |
|---------|--------|
| `server/src/data/buildings-raw.json` | Edificios de data.aoe4world.com (1.2MB) |
| `server/src/data/units-raw.json` | Unidades de data.aoe4world.com (2.8MB) |
| `server/src/data/technologies-raw.json` | Tecnologias de data.aoe4world.com (2.7MB) |
| `replays-parser-src/examples/` | 18 archivos de ejemplo (summary + full) para testing |

## REPO GITHUB
https://github.com/pilshub/aoe4-replay-viewer (branch: master)

## COMO ARRANCAR
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
```

## PENDIENTE / MEJORAS FUTURAS
- [ ] Frontend: mostrar datos de summary (kills, deaths, resources) cuando disponibles
- [ ] Frontend: grafica de score timeline (Recharts) usando datos STPD
- [ ] Frontend: optimizacion movil (responsive, touch controls)
- [ ] Soporte para summary files locales (upload directo)
- [ ] Deploy activo en Railway (railway.toml existe, falta configurar)
- [ ] Centrado en 1v1 (decision del usuario)

## HISTORIAL DE CAMBIOS (19 Feb 2026)
1. **GPT-4o**: Modelo de IA cambiado de gpt-4o-mini a gpt-4o (~16x mejor calidad, ~2.8 cents/analisis)
2. **Eliminado All-in**: Estrategia "All-in" removida del analyzer (no aplica a AoE4)
3. **Prompt enriquecido**: Prompt de IA ahora incluye player scores, army snapshots, economy summary, combat stats
4. **Summary parser**: Nuevo parser TypeScript para seccion STPD del replay (port del .NET parser). Extrae kills, deaths, recursos, scores, timeline. Validado 18/18 archivos.
5. **Pipeline integrado**: summary-parser conectado a replay-parser → transformer → ai-narrator
