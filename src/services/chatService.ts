import { pool, withTransaction } from '../db/postgres';
import { badRequest, forbidden, notFound } from '../errors';
import * as chats from '../repositories/chatRepository';
import * as messages from '../repositories/messageRepository';
import * as users from '../repositories/userRepository';
import type { Chat, ChatDetails, LastSeen, MemberRole, Message, User } from '../types';


// check the role of user in chat 
async function requireMember(chatId: string, userId: string): Promise<{ type: Chat['type']; role: MemberRole }> {
  const access = await chats.getChatAccess(chatId, userId);
  if (!access) throw notFound('Chat not found');
  if (!access.role) throw forbidden('User is not a member of this chat');
  return { type: access.type, role: access.role };
}

async function requireReadAccess(chatId: string, userId: string | undefined): Promise<void> {
  if (userId) {
    await requireMember(chatId, userId);
    return;
  }
  if (!(await chats.getChatAccess(chatId, null))) throw notFound('Chat not found');
}

// check the user exist or not 
async function requireUsersExist(ids: readonly string[]): Promise<void> {
  const missing = await users.findMissingUserIds(ids);
  if (missing.length > 0) throw notFound(`User(s) not found: ${missing.join(', ')}`);
}


// create user in dp 
export const createUser = (name: string): Promise<User> => users.createUser(name);

// get user in db by id
export async function getUser(userId: string): Promise<User> {
  const user = await users.findUserById(userId);
  if (!user) throw notFound('User not found');
  return user;
}

// get chat by user id 
export async function listUserChats(userId: string): Promise<Chat[]> {
  await getUser(userId);
  return chats.listChatsForUser(userId);
}

// create chat between two user
export async function createOrGetDirectChat(
  userAId: string,
  userBId: string,
): Promise<{ chatId: string; created: boolean }> {
  if (userAId === userBId) throw badRequest('userAId and userBId must be different users');
  await requireUsersExist([userAId, userBId]);
  return withTransaction((client) => chats.upsertDirectChat(client, userAId, userBId));
}

// get chat list
export async function getChat(chatId: string, userId?: string): Promise<ChatDetails> {
  await requireReadAccess(chatId, userId);
  return (await chats.getChatDetails(chatId))!;
}

// sent message and save from db
export async function sendMessage(chatId: string, senderId: string, text: string): Promise<Message> {
  await requireMember(chatId, senderId);
  const message = await messages.createMessage(chatId, senderId, text);
  chats.touchLastMessageAt(chatId, new Date(message.createdAt)).catch((err: unknown) => {
    console.error(`Failed to update last_message_at for chat ${chatId}`, err);
  });
  return message;
}

// get message by chat id
export async function getMessages(
  chatId: string,
  limit: number,
  options: { userId?: string | undefined; beforeSeq?: number | undefined } = {},
): Promise<{ messages: Message[]; nextBefore: number | null }> {
  await requireReadAccess(chatId, options.userId);
  const list = await messages.listMessages(chatId, limit, options.beforeSeq);
  const oldest = list[0];
  return { messages: list, nextBefore: list.length === limit && oldest ? oldest.seq : null };
}

// mark message by read in firestore
export async function markMessageRead(chatId: string, messageId: string, userId: string): Promise<Message> {
  await requireMember(chatId, userId);
  return messages.markRead(chatId, messageId, userId);
}

// update chat last seen
export async function updateLastSeen(
  chatId: string,
  userId: string,
  messageId: string,
): Promise<{ lastSeen: LastSeen; updated: boolean }> {
  await requireMember(chatId, userId);
  return messages.updateLastSeen(chatId, userId, messageId);
}


// get last seen in FS
export async function getLastSeen(chatId: string, userId?: string): Promise<LastSeen[]> {
  await requireReadAccess(chatId, userId);
  return messages.listLastSeen(chatId);
}

