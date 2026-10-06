import { Router, type Request } from 'express';
import { z } from 'zod';
import * as service from '../services/chatService';
import { chatId, messageId, messageText, parse, userId } from '../validation';

export const chatRouter = Router();

const chatParams = z.object({ chatId });
const messageParams = z.object({ chatId, messageId });
const optionalUserQuery = z.object({ userId: userId.optional() });

// Message create between two user
chatRouter.post('/create', async (req, res) => {
  const body = parse(z.object({ userAId: userId, userBId: userId }), req.body);
  const result = await service.createOrGetDirectChat(body.userAId, body.userBId);
  res.status(result.created ? 201 : 200).json(result);
});

// get chat of specific use
chatRouter.get('/:chatId', async (req, res) => {
  const params = parse(chatParams, req.params);
  const query = parse(optionalUserQuery, req.query);
  res.json({ chat: await service.getChat(params.chatId, query.userId) });
});


// sent message from A-B
chatRouter.post('/:chatId/message/send', async (req, res) => {
  const params = parse(chatParams, req.params);
  const body = parse(z.object({ senderId: userId, text: messageText }), req.body);
  res.status(201).json({ message: await service.sendMessage(params.chatId, body.senderId, body.text) });
});

// get all mesaages from DB/Firestore
chatRouter.get('/:chatId/messages', async (req, res) => {
  const params = parse(chatParams, req.params);
  const query = parse(
    z.object({
      limit: z.coerce.number().int().min(1).max(100).default(50),
      before: z.coerce.number().int().positive().optional(),
      userId: userId.optional(),
    }),
    req.query,
  );
  res.json(await service.getMessages(params.chatId, query.limit, { userId: query.userId, beforeSeq: query.before }));
});

// read the message
chatRouter.post('/:chatId/message/:messageId/read', async (req, res) => {
  const params = parse(messageParams, req.params);
  const body = parse(z.object({ userId }), req.body);
  res.json({ message: await service.markMessageRead(params.chatId, params.messageId, body.userId) });
});

// lastseen the message
chatRouter.post('/:chatId/lastseen', async (req, res) => {
  const params = parse(chatParams, req.params);
  const body = parse(z.object({ userId, messageId }), req.body);
  res.json(await service.updateLastSeen(params.chatId, body.userId, body.messageId));
});

// Get last seen the message
chatRouter.get('/:chatId/lastseen', async (req, res) => {
  const params = parse(chatParams, req.params);
  const query = parse(optionalUserQuery, req.query);
  res.json({ lastSeen: await service.getLastSeen(params.chatId, query.userId) });
});
