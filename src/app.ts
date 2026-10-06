import express from 'express';
import { chatRouter } from './routes/chatRoutes';
import { userRouter } from './routes/userRoutes';

export function createApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/chat', chatRouter);
  app.use('/user', userRouter);

  return app;
}
