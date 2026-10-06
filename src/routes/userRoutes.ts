import { Router } from 'express';
import { z } from 'zod';
import * as service from '../services/chatService';
import { parse, userId } from '../validation';

export const userRouter = Router();


// create user
userRouter.post('/create', async (req, res) => {
  const { name } = parse(z.object({ name: z.string().trim().min(1).max(100) }), req.body);
  res.status(201).json({ user: await service.createUser(name) });
});

// get user id
userRouter.get('/:userId', async (req, res) => {
  const params = parse(z.object({ userId }), req.params);
  res.json({ user: await service.getUser(params.userId) });
});

// get user id by chat
userRouter.get('/:userId/chats', async (req, res) => {
  const params = parse(z.object({ userId }), req.params);
  res.json({ chats: await service.listUserChats(params.userId) });
});
