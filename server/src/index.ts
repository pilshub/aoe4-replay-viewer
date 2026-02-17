import express from 'express';
import cors from 'cors';
import path from 'path';
import { replayRoutes } from './routes/replay.routes';

const app = express();
const PORT = parseInt(process.env.PORT || process.env.SERVER_PORT || '3002', 10);

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'aoe4-replay-server' });
});

app.use('/api/replay', replayRoutes);

// ── Serve frontend static files (production) ──────────────
const clientDir = path.resolve(__dirname, '../client');
app.use(express.static(clientDir));
// SPA fallback: any non-API route → index.html
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);
});
