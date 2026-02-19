# Estado del Proyecto AoE4 Replay Viewer
## Ultima actualizacion: 2026-02-19 (sesion 2)

## QUE ES ESTE PROYECTO
Visor web de replays de Age of Empires 4. El usuario pega una URL de aoe4world.com, el backend descarga y parsea el replay binario (.rec), extrae build orders, analiza estrategias, genera un analisis narrativo con IA (GPT-4o), y el frontend lo visualiza en un dashboard interactivo con mapa PixiJS, graficas Recharts y panel de analisis con formato rico (iconos inline, banderas de civilizacion, badges de edad, timestamps coloreados).

## ARQUITECTURA
- **Client**: React 18 + PixiJS 8 + Zustand + Recharts + Tailwind (puerto configurable, default 3005 en vite.config.ts)
- **Server**: Express + TypeScript (puerto 3002)
- **AI**: OpenAI GPT-4o (~2.8 cents/analisis con datos enriquecidos)
- **Deploy**: Railway (railway.toml presente, URL: https://backend-production-bfe5.up.railway.app — version antigua)

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
              Mapea pbgids → nombres/iconos, normaliza coordenadas, infiere civs
                      ↓
              strategy-analyzer.ts (clasificacion de estrategia)
              5 estrategias: Feudal Rush, Fast Castle, Boom, Tower Rush, Standard
                      ↓
              match-analyzer.ts (analisis profundo algoritmico)
              Scores 0-100 (Macro, Economy, Military, Tech), army snapshots, combats
                      ↓
              ai-narrator.ts (GPT-4o narrativa + post-procesado de tokens)
              Genera analisis narrativo → inyecta 5 tipos de tokens rich
                      ↓
              NarrativeSection.tsx (renderizado frontend)
              Parsea tokens → renderiza iconos, banderas, badges, timestamps, headers
```

## SISTEMA DE TOKENS RICH (5 tipos)

El narrador GPT-4o genera texto plano. El post-procesado en ai-narrator.ts inyecta tokens con formato `{{tipo:datos}}`. El frontend los parsea y renderiza visualmente.

| Token | Formato Backend | Renderizado Frontend |
|-------|----------------|---------------------|
| Unit/building/tech | `{{icon:URL\|Name}}` | `<img>` 28px con tooltip, gold drop-shadow |
| Civilization | `{{civ:URL\|Name}}` | 1ra mencion: bandera 32px + nombre bold. Siguientes: bandera 24px sola |
| Age | `{{age:N\|Name}}` | Badge inline coloreado con numeral romano (I gris, II verde, III azul, IV dorado) |
| Timestamp | `{{time:MM:SS}}` | Texto gold bold tabular-nums |
| Header | `{{header:text}}` | Cinzel uppercase gold con linea divisoria. Ages → badge coloreado. Verdict → con espadas |

### Orden de inyeccion (importa para evitar conflictos)
1. `convertHeaders()` — `###` markdown → `{{header:}}`
2. `injectAgeTokens()` — nombres de edad → `{{age:N|Name}}` (patron mas largo primero: "Edad de los Castillos" antes que "Edad Feudal")
3. `injectCivTokens()` — nombres de civ → `{{civ:URL|Name}}` (todas las ocurrencias)
4. `injectIcons()` — nombres de unidades/edificios/techs → `{{icon:URL|Name}}` (todas las ocurrencias)
5. `injectTimeTokens()` — timestamps `M:SS` → `{{time:M:SS}}`

### Funcion de seguridad: `isInsideToken(text, position)`
Antes de inyectar cualquier token, verifica que la posicion NO esta dentro de un token existente. Previene doble-inyeccion.

### Deteccion de cantidades (frontend)
Cuando un token `text` termina en `\d+x?\s*` y el siguiente token es `icon`, el numero se renderiza como gold bold: "109x [icono]"

### Saltos de parrafo (frontend)
Los `\n\n` en tokens `text` se renderizan como espaciado vertical (`h-5`). Los `\n` simples se renderizan como `<br>`.

### Alineacion vertical de iconos (frontend)
Todos los elementos inline usan `vertical-align` directo en el `<img>`:
- Iconos de unidades: `verticalAlign: '-7px'`
- Banderas de civ: `verticalAlign: '-9px'`
- Badges de edad: `verticalAlign: '-3px'`
Esto evita el problema de `inline-flex align-baseline` que causaba desalineacion.

## SOPORTE MULTI-IDIOMA PARA ICONOS

### Problema
GPT genera narrativa en el idioma solicitado. Si escribe "Lanceros" en vez de "Spearman", el sistema de iconos no los detecta.

### Solucion (3 capas)
1. **System prompt agresivo**: "CRITICAL: ALL unit, building, and technology names MUST stay in English exactly as they appear in the game data. NEVER translate them."
2. **Mapeo Spanish→English**: 60+ traducciones en `SPANISH_UNIT_NAMES` (Lancero→Spearman, Catafracto→Cataphract, etc.)
3. **Variantes de civs en español**: `SPANISH_CIV_VARIANTS` mapea "los franceses"→French, "los bizantinos"→Byzantines, etc.

### Resultado verificado
- **Ingles**: ~26 iconos, ~18 civs, ~8 ages, ~11 times = ~67 tokens totales
- **Español**: ~20 iconos, ~14 civs, ~6 ages, ~7 times = ~51 tokens totales
- **0 nombres de unidad sin iconificar** en ambos idiomas (verificado con regex)
- La diferencia de tokens se debe a que GPT escribe contenido diferente, NO a fallos de mapeo

### Mapeo Spanish→English (SPANISH_UNIT_NAMES)
Incluye: Aldeano, Lancero, Arquero, Ballestero, Hombre de Armas, Caballero, Caballero Real, Jinete, Explorador, Ariete, Mangonela, Trabuco, Bombardero, Arquero a caballo, Lancero/Arquero de Camello, Catafracto, Jenizaro, Sipahi, Granadero, Samurai, Elefante de Guerra, Camello, Infante, Mosquetero, Piquero, Espringalda, Culverin, Zhuge Nu, Nido de Abejas, Mangudai, Arbaletrier, Guerrero Donso/Musofadi, Monje, Prelado, Imam, Ghulam, Galera + edificios (Centro Urbano, Cuartel, Establos, Campo de Tiro, Herreria, Mercado, Molino, Torre, Castillo, Muralla, Monasterio, Universidad, Puerta, Taller de Asedio, Muelle) + plurales de todo.

Nota: "Trebuchet" no existe en el icon map — el nombre correcto es "Counterweight Trebuchet". Se añadio alias.

## AGE PATTERNS (para inyeccion de tokens age)
Español: Edad de los Castillos (3), Edad Imperial (4), Edad Feudal (2), Edad Oscura (1)
Ingles: Imperial Age (4), Castle Age (3), Feudal Age (2), Dark Age (1)
Ordenados de mas largo a mas corto para evitar matches parciales.

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
Max tokens: 1200, temperature: 0.5

El prompt incluye:
- Build order completo por jugador
- Player scores (0-100): Macro, Economy, Military, Tech
- Army composition snapshots al 25%, 50%, 75%, 100% del match
- Economy summary (villager production, TC timing, market usage)
- Key moments detectados algoritmicamente
- **Si hay summary data**: Combat stats reales (K/D, eficiencia, recursos), total resources gathered, score timeline

Reglas del narrador (system prompt):
- 400-500 palabras
- Tono analitico de caster profesional, preciso, tecnico, data-driven
- Solo afirmar hechos respaldados por datos
- NO inventar batallas, timings o unidades que no aparecen en los datos
- Usar headers `###` para cada seccion (Dark Age, Feudal Age, Castle Age, Imperial Age, Verdict)
- Dark Age: 1-2 frases MAX
- Focalizarse en la edad donde se decide el juego
- CRITICAL: Nombres de unidades/edificios/techs SIEMPRE en ingles (para iconos)
- Referencia a datos de combate cuando disponibles
- Verdict con (a) por que gano el ganador + (b) 2-3 recomendaciones numeradas
- Parrafos cortos (2-3 frases), linea en blanco entre parrafos
- Referir civs ONCE por nombre completo, luego forma corta

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
| `server/src/services/summary-parser.ts` | Parser STPD (kills, resources, scores, timeline) |
| `server/src/services/transformer.service.ts` | Pipeline transformacion: normaliza + enriquece datos + infiere civs |
| `server/src/services/ai-narrator.ts` | GPT-4o narrativa + 5 funciones de inyeccion de tokens rich |
| `server/src/services/strategy-analyzer.ts` | Clasificacion de estrategia (score-based) |
| `server/src/services/match-analyzer.ts` | Analisis profundo algoritmico (scores, army, economy) |
| `server/src/services/parser-proxy.service.ts` | Descarga replays + metadata de aoe4world |
| `server/src/services/cache.service.ts` | Cache en disco (JSON files en server/cache/) |
| `server/src/routes/replay.routes.ts` | POST /api/replay/load + GET /api/replay/:id |
| `server/src/data/aoe4-meta.ts` | Knowledge base de estrategias y meta |
| `server/src/data/aoe4-data.ts` | Mapeo pbgid → nombre/icono (955+ entidades). Funcion `getGlobalIconMap()` |
| `server/src/utils/entity-classifier.ts` | Clasifica entidades en building/unit/other |
| `server/src/utils/coordinate-normalizer.ts` | Normaliza coordenadas del mapa |

### Client
| Archivo | Que hace |
|---------|----------|
| `client/src/components/Dashboard/NarrativeSection.tsx` | **Renderizado rich** de narrativa IA (5 tipos de tokens) |
| `client/src/pixi/` | Capas PixiJS (unidades, edificios, muertes, heatmap) |
| `client/src/components/` | Componentes React (Sidebar, BuildOrder, Analysis, etc.) |
| `client/src/state/replayStore.ts` | Estado Zustand |
| `client/src/types/replay.types.ts` | Tipos compartidos |
| `client/src/api/replayApi.ts` | API client (usa VITE_API_URL o '/api' relativo) |
| `client/vite.config.ts` | Proxy /api → localhost:3002, puerto default 3005 |

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
# Terminal 1 - Servidor (NECESITA OPENAI_API_KEY)
cd C:\Users\fermi\aoe4-replay-viewer\server
OPENAI_API_KEY="sk-proj-..." npx tsx src/index.ts
# Escucha en puerto 3002

# Terminal 2 - Cliente (Vite dev server con proxy a 3002)
cd C:\Users\fermi\aoe4-replay-viewer\client
npx vite
# Escucha en puerto 3005 (configurable con --port)
# Proxy: /api/* → http://localhost:3002

# Limpiar cache si hay cambios en el narrador/prompt
rm C:\Users\fermi\aoe4-replay-viewer\server\cache\*.json

# URL de prueba
https://aoe4world.com/players/17272880/games/218807749
```

NOTA: La OPENAI_API_KEY NO esta en un .env file. Hay que pasarla como variable de entorno al arrancar el server. La key esta en el CLAUDE.md global (proyecto InfoSevillaFC).

## RAILWAY
- Proyecto: `aoe4-replay-backend`
- URL: https://backend-production-bfe5.up.railway.app
- Estado: desplegado pero con VERSION ANTIGUA (pre-tokens rich)
- Para actualizar: push a master + configurar OPENAI_API_KEY en Railway env vars

## PENDIENTE / MEJORAS FUTURAS
- [ ] **Mejorar formato narrativa** — Los parrafos dentro de secciones siguen siendo densos, los iconos podrian ser mas grandes, el layout general necesita mas pulido visual
- [ ] Frontend: mostrar datos de summary (kills, deaths, resources) cuando summaryData esta disponible
- [ ] Frontend: grafica de score timeline (Recharts) usando datos STPD
- [ ] Frontend: optimizacion movil (responsive, touch controls)
- [ ] Soporte para summary files locales (upload directo)
- [ ] Deploy actualizado en Railway con tokens rich
- [ ] Centrado en 1v1 (decision del usuario)

## HISTORIAL DE CAMBIOS

### Sesion 2 (19 Feb 2026 — tarde)
6. **Sistema de tokens rich**: 5 tipos de tokens (icon, civ, age, time, header) inyectados en post-procesado
7. **Inyeccion de iconos ALL occurrences**: Antes solo reemplazaba primera ocurrencia, ahora todas
8. **Inyeccion de civ flags ALL occurrences**: Primera mencion = bandera+nombre, siguientes = bandera sola
9. **60+ mapeos Spanish→English**: Para que iconos funcionen cuando GPT escribe en español
10. **System prompt reforzado**: "CRITICAL: ALL unit names MUST stay in English" — resultado: 0 nombres sin iconificar
11. **NarrativeSection.tsx reescrito**: Parser de 5 tokens, renderizado rich, saltos de parrafo, alineacion con vertical-align
12. **Fix civFlag vacio**: Cuando civs se infieren del build order, civFlag no se actualizaba. Corregido en transformer.service.ts
13. **Fix "Trebuchet"**: No existe en icon map, el nombre real es "Counterweight Trebuchet". Añadido alias.
14. **Headers de seccion**: Age headers con badge coloreado + linea dorada. Verdict con espadas decorativas.
15. **Deteccion de cantidades**: "109 [icon]" → "109x [icon]" con numero gold bold
16. **Parrafos en narrativa**: `\n\n` → espaciado vertical, `\n` → line break

### Sesion 1 (19 Feb 2026 — mañana)
1. **GPT-4o**: Modelo de IA cambiado de gpt-4o-mini a gpt-4o
2. **Eliminado All-in**: Estrategia "All-in" removida del analyzer
3. **Prompt enriquecido**: Player scores, army snapshots, economy summary, combat stats
4. **Summary parser**: Parser TypeScript para seccion STPD. Validado 18/18 archivos.
5. **Pipeline integrado**: summary-parser → transformer → ai-narrator
