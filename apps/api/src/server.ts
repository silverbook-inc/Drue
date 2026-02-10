import express from 'express';
import cors from 'cors';
import { env } from './env.js';
import healthRouter from './routes/health.js';
import meRouter from './routes/me.js';

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ service: 'drue-api', status: 'running' });
});

app.use('/health', healthRouter);
app.use('/me', meRouter);

app.listen(env.port, () => {
  console.log(`Drue API listening on http://localhost:${env.port}`);
});
