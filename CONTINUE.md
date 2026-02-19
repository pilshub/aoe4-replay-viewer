# AoE4 Replay Viewer — Continuacion
## Ultima actualizacion: 2026-02-19 (sesion 2)

## Estado actual
Proyecto funcional con sistema de tokens rich para narrativa IA. El backend parsea replays binarios, extrae build orders, analiza estrategias, genera narrativa con GPT-4o, e inyecta 5 tipos de tokens (icon, civ, age, time, header) en post-procesado. El frontend parsea y renderiza los tokens como iconos inline, banderas de civilizacion, badges de edad coloreados, timestamps dorados, y headers estilizados.

## Lo que se acaba de hacer (19 Feb 2026 — sesion 2)

### Sistema de tokens rich (backend: ai-narrator.ts)
- 5 funciones de inyeccion: `convertHeaders()`, `injectAgeTokens()`, `injectCivTokens()`, `injectIcons()`, `injectTimeTokens()`
- Orden de inyeccion: headers → ages → civs → icons → timestamps (patron mas largo primero)
- `isInsideToken()` evita doble-inyeccion
- `injectIcons()` y `injectCivTokens()` reemplazan TODAS las ocurrencias, no solo la primera
- 60+ mapeos Spanish→English en `SPANISH_UNIT_NAMES` para soporte multi-idioma
- Variantes de civs en español: `SPANISH_CIV_VARIANTS` (18 civs con variantes)
- System prompt reforzado: nombres de unidades SIEMPRE en ingles
- Fix: "Trebuchet" → "Counterweight Trebuchet" (alias añadido)

### Renderizado frontend (NarrativeSection.tsx)
- Parser de 5 tipos de tokens con regex unificado
- Iconos de unidades: 28px con gold drop-shadow, `verticalAlign: '-7px'`
- Banderas de civ: 32px primera mencion (con nombre bold), 24px siguientes (solo bandera)
- `seenCivs` se resetea en cada header para que cada seccion tenga primera mencion con nombre
- Age badges: inline-block coloreados (I gris, II verde, III azul, IV dorado) con `verticalAlign: '-3px'`
- Headers de seccion: si es edad → badge coloreado grande + linea dorada. Si es Verdict → espadas decorativas
- Timestamps: gold bold tabular-nums (hereda tamaño del texto)
- Deteccion de cantidades: texto antes de icon que termina en `\d+x?\s*` → gold bold
- Saltos de parrafo: `\n\n` → `<span class="block h-5">`, `\n` → `<br>`
- Texto base 17px, line-height 2.15, font-crimson
- Padding contenedor p-8 pb-10

### Otros fixes
- Fix civFlag vacio tras inferir civ del build order (transformer.service.ts)
- Cache incluye idioma en la key para que diferentes idiomas generen narrativas frescas

## Estado del formato narrativa (EN PROGRESO)
El sistema de tokens funciona correctamente (verificado: 0 nombres sin iconificar). La alineacion de iconos se corrigio usando `vertical-align` directo en lugar de `inline-flex`. Quedan mejoras visuales menores por pulir:
- Los parrafos dentro de secciones largas (Feudal Age) pueden ser densos
- Los iconos de unidades podrian ser ligeramente mas grandes
- El layout general podria beneficiarse de mas pulido visual

## Proximos pasos (por prioridad)
1. **Seguir puliendo formato narrativa** — mas espacio, iconos mas grandes, mejor readability
2. **Frontend: mostrar summary data** — Crear componente que muestre kills/deaths/resources cuando summaryData esta disponible
3. **Frontend: score timeline chart** — Grafica Recharts con scoreTotal/Economy/Military por jugador
4. **Deploy Railway actualizado** — Push a master + configurar env vars
5. **Frontend: optimizacion movil** — Responsive layout, touch-friendly controls

## Como arrancar
```bash
# Terminal 1 - Servidor (puerto 3002) — NECESITA OPENAI_API_KEY
cd C:\Users\fermi\aoe4-replay-viewer\server
OPENAI_API_KEY="sk-proj-..." npx tsx src/index.ts

# Terminal 2 - Cliente (Vite, default puerto 3005, proxy a 3002)
cd C:\Users\fermi\aoe4-replay-viewer\client
npx vite --port 3001
# O simplemente: npx vite (usa puerto 3005 del vite.config.ts)

# Limpiar cache si cambias el narrador/prompt
rm C:\Users\fermi\aoe4-replay-viewer\server\cache\*.json

# URL de prueba
https://aoe4world.com/players/17272880/games/218807749
```

NOTA: La OPENAI_API_KEY esta en CLAUDE.md global (proyecto InfoSevillaFC). NO hay .env file.

## Archivos modificados en sesion 2
- `server/src/services/ai-narrator.ts` — 5 funciones de inyeccion de tokens, 60+ mapeos Spanish, system prompt reforzado
- `server/src/services/transformer.service.ts` — Fix civFlag tras inferir civ del build order
- `client/src/components/Dashboard/NarrativeSection.tsx` — Reescrito completo: 5 tipos de tokens, vertical-align, parrafos

## Instruccion para Claude
Lee CLAUDE_STATUS.md para el contexto completo del proyecto. La seccion "SISTEMA DE TOKENS RICH" es la mas relevante para entender el formato de narrativa.
