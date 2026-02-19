# AoE4 Replay Viewer — Continuacion
## Ultima actualizacion: 2026-02-19

## Estado actual
Proyecto funcional con 5 mejoras recien implementadas (ver CLAUDE_STATUS.md).
El backend parsea replays binarios, extrae build orders, analiza estrategias, genera narrativa IA con GPT-4o, y ahora tambien extrae datos ricos (kills, deaths, recursos, scores) de la seccion STPD cuando esta disponible.

## Lo que se acaba de hacer (19 Feb 2026)
1. Modelo IA: gpt-4o-mini → gpt-4o
2. Eliminada estrategia "All-in"
3. Prompt IA enriquecido con player scores, army snapshots, economy, combat stats
4. Nuevo `summary-parser.ts` — parser STPD completo (18/18 test files OK)
5. Pipeline integrado: summary-parser → transformer → ai-narrator

## Proximos pasos (por prioridad)
1. **Frontend: mostrar summary data** — Crear componente que muestre kills/deaths/resources cuando summaryData esta disponible
2. **Frontend: score timeline chart** — Grafica Recharts con scoreTotal/Economy/Military por jugador a lo largo del tiempo
3. **Frontend: optimizacion movil** — Responsive layout, touch-friendly controls
4. **Deploy Railway** — Configurar y desplegar (railway.toml ya existe)

## Como arrancar
```bash
# Servidor (puerto 3002)
cd C:\Users\fermi\aoe4-replay-viewer\server && npx tsx src/index.ts

# Cliente (puerto 3000)
cd C:\Users\fermi\aoe4-replay-viewer\client && npx vite --port 3000
```

## Archivos clave modificados recientemente
- `server/src/services/summary-parser.ts` — NUEVO: parser STPD
- `server/src/services/ai-narrator.ts` — GPT-4o + prompt enriquecido + summaryData
- `server/src/services/replay-parser.ts` — Integra summary-parser
- `server/src/services/transformer.service.ts` — Pasa summaryData al pipeline
- `server/src/data/aoe4-meta.ts` — Eliminado All-in

## Instruccion para Claude
Lee CLAUDE_STATUS.md para el contexto completo del proyecto.
