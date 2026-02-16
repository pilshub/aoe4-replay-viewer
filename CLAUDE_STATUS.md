# Estado del Proyecto AoE4 Replay Viewer
## Fecha: 2026-02-06

## QUE ES ESTE PROYECTO
Visor web de replays de Age of Empires 4. El usuario pega una URL de aoe4world.com, el backend descarga y parsea el replay, y el frontend lo visualiza en un mapa interactivo con PixiJS (unidades, edificios, muertes, heatmaps).

## ARQUITECTURA
- **Client**: React 18 + PixiJS + Vite + Tailwind (puerto 3000)
- **Server**: Express + TypeScript (puerto 3002)
- **Parser**: .NET 8.0 ASP.NET Core (puerto 5069) - parsea archivos .rec

## BUGS CORREGIDOS (5 bugs criticos)

### Bug 1: Estructura de datos mal mapeada (transformer.service.ts)
- ANTES: `raw.players` → undefined (parser devuelve `{gameSummary: {players: [...]}}`)
- AHORA: `raw.gameSummary.players` → funciona

### Bug 2: Nombre de array incorrecto (transformer.service.ts)
- ANTES: buscaba `p.entities` → undefined
- AHORA: usa `p.units` + `p.startingUnits` → encuentra 407 entidades

### Bug 3: Duration no encontrada (transformer.service.ts)
- ANTES: `raw.duration` → undefined
- AHORA: usa `replaySummary.dataSTLS.gameLength` → 1059s correcto

### Bug 4: Category como string (entity-classifier.ts)
- Parser devuelve "Building"/"Unit" (strings), classifier esperaba numeros (19/46)
- AHORA: acepta ambos formatos

### Bug 5: Docker paths no compartidos (docker-compose.yml)
- Server descargaba replays a su filesystem, parser en otro contenedor no podia leerlos
- AHORA: volumen compartido `replay-downloads` entre ambos servicios

## ARCHIVOS MODIFICADOS
1. `server/src/services/transformer.service.ts` - Bugs 1, 2, 3
2. `server/src/utils/entity-classifier.ts` - Bug 4
3. `docker-compose.yml` - Bug 5 + volumen compartido
4. `server/src/services/parser-proxy.service.ts` - DOWNLOAD_DIR configurable
5. `client/nginx.conf` - Timeout proxy aumentado a 180s
6. `server/src/index.ts` - PORT env var para Render

## ARCHIVOS NUEVOS (para deploy cloud)
- `Dockerfile.backend` - Imagen combinada .NET parser + Node server
- `start-backend.sh` - Script arranque ambos servicios
- `render.yaml` - Config deploy Render
- `client/vercel.json` - Config deploy Vercel

## REPO GITHUB
https://github.com/pilshub/aoe4-replay-viewer

## VERIFICADO CON TEST
Transformer probado contra datos reales del parser:
- Players: 2 ✓
- Entities: 407 (353 con coordenadas) ✓
- Death events: 38 ✓
- Duration: 1059s ✓
(Antes de los fixes: 0 entidades, 0 eventos)

## QUE FALTA POR HACER

### Paso 1: Probar localmente con Docker
- Docker Desktop YA INSTALADO (winget install Docker.DockerDesktop)
- NECESITA REINICIAR PC para que Docker arranque
- Despues: abrir Docker Desktop, esperar icono verde
- Ejecutar: `cd C:\Users\fermi\aoe4-replay-viewer && docker compose up --build`
- Probar en http://localhost:3000 con un link de replay de aoe4world.com

### Paso 2: Deploy en la nube (cuando funcione local)
- Backend → Render.com (gratis, usa Dockerfile.backend)
- Frontend → Vercel.com o todo en Render
- Variable clave: VITE_API_URL debe apuntar a la URL del backend en Render

## SOFTWARE INSTALADO EN ESTE PC
- Node.js v24.13.0
- npm 11.6.2
- winget v1.12.460
- GitHub CLI (gh) autenticado como pilshub
- Docker Desktop v4.59.0 (recien instalado, PENDIENTE REINICIO)
- NO tiene .NET SDK
