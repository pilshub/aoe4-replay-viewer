import express from 'express';
import cors from 'cors';
import { replayRoutes } from './routes/replay.routes';

const app = express();
const PORT = parseInt(process.env.PORT || process.env.SERVER_PORT || '3002', 10);

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'aoe4-replay-server' });
});

app.use('/api/replay', replayRoutes);

app.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);
});
