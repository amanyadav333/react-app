import type { PoolClient } from 'pg';
import { pool, type Queryable } from '../db/postgres';
import type { Chat, ChatDetails, ChatMember, ChatType, MemberRole } from '../types';

interface ChatRow {
  id: string;
  type: ChatType;
  name: string | null;
  created_by: string;
  created_at: Date;
  last_message_at: Date | null;
}

const baseChat = (row: ChatRow): Omit<Chat, 'memberIds'> => ({
  chatId: row.id,
  type: row.type,
  name: row.name,
  createdBy: row.created_by,
  createdAt: row.created_at.toISOString(),
  lastMessageAt: row.last_message_at?.toISOString() ?? null,
});

export const directKey = (a: string, b: string): string => (a < b ? `${a}:${b}` : `${b}:${a}`);

export async function upsertDirectChat(
  client: PoolClient,
  userAId: string,
  userBId: string,
): Promise<{ chatId: string; created: boolean }> {
  const key = directKey(userAId, userBId);
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO chats (type, direct_key, created_by) VALUES ('direct', $1, $2)
     ON CONFLICT (direct_key) DO NOTHING
     RETURNING id`,
    [key, userAId],
  );
  if (inserted.rows[0]) {
    await addMembers(client, inserted.rows[0].id, [userAId, userBId], 'member');
    return { chatId: inserted.rows[0].id, created: true };
  }
  const existing = await client.query<{ id: string }>('SELECT id FROM chats WHERE direct_key = $1', [key]);
  return { chatId: existing.rows[0]!.id, created: false };
}

export async function addMembers(
  db: Queryable,
  chatId: string,
  userIds: readonly string[],
  role: MemberRole,
): Promise<void> {
  if (userIds.length === 0) return;
  await db.query(
    `INSERT INTO chat_members (chat_id, user_id, role)
     SELECT $1, unnest($2::uuid[]), $3::member_role
     ON CONFLICT (chat_id, user_id) DO NOTHING`,
    [chatId, userIds, role],
  );
}

export async function removeMember(chatId: string, userId: string): Promise<boolean> {
  const { rowCount } = await pool.query('DELETE FROM chat_members WHERE chat_id = $1 AND user_id = $2', [
    chatId,
    userId,
  ]);
  return (rowCount ?? 0) > 0;
}

export async function getChatAccess(
  chatId: string,
  userId: string | null,
): Promise<{ type: ChatType; role: MemberRole | null } | null> {
  const { rows } = await pool.query<{ type: ChatType; role: MemberRole | null }>(
    `SELECT c.type, m.role
       FROM chats c
       LEFT JOIN chat_members m ON m.chat_id = c.id AND m.user_id = $2
      WHERE c.id = $1`,
    [chatId, userId],
  );
  return rows[0] ?? null;
}

export async function getChatDetails(chatId: string): Promise<ChatDetails | null> {
  const chat = await pool.query<ChatRow>(
    'SELECT id, type, name, created_by, created_at, last_message_at FROM chats WHERE id = $1',
    [chatId],
  );
  if (!chat.rows[0]) return null;
  const members = await pool.query<{ user_id: string; role: MemberRole }>(
    'SELECT user_id, role FROM chat_members WHERE chat_id = $1 ORDER BY joined_at, user_id',
    [chatId],
  );
  return {
    ...baseChat(chat.rows[0]),
    members: members.rows.map((m): ChatMember => ({ userId: m.user_id, role: m.role })),
  };
}

export async function listChatsForUser(userId: string): Promise<Chat[]> {
  const { rows } = await pool.query<ChatRow & { member_ids: string[] }>(
    `SELECT c.id, c.type, c.name, c.created_by, c.created_at, c.last_message_at,
            array_agg(m.user_id ORDER BY m.joined_at, m.user_id) AS member_ids
       FROM chats c
       JOIN chat_members me ON me.chat_id = c.id AND me.user_id = $1
       JOIN chat_members m  ON m.chat_id = c.id
      GROUP BY c.id
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`,
    [userId],
  );
  return rows.map((row) => ({ ...baseChat(row), memberIds: row.member_ids }));
}

export async function touchLastMessageAt(chatId: string, at: Date): Promise<void> {
  await pool.query(
    'UPDATE chats SET last_message_at = GREATEST(COALESCE(last_message_at, $2), $2) WHERE id = $1',
    [chatId, at],
  );
}
