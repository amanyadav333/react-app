import { pool, type Queryable } from '../db/postgres';
import type { User } from '../types';

// use interface to map with postgress sql
interface UserRow {
  id: string;
  name: string;
  created_at: Date;
}

const toUser = (row: UserRow): User => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at.toISOString(),
});

export async function createUser(name: string): Promise<User> {
  const { rows } = await pool.query<UserRow>(
    'INSERT INTO users (name) VALUES ($1) RETURNING id, name, created_at',
    [name],
  );
  return toUser(rows[0]!);
}

export async function findUserById(id: string): Promise<User | null> {
  const { rows } = await pool.query<UserRow>('SELECT id, name, created_at FROM users WHERE id = $1', [id]);
  return rows[0] ? toUser(rows[0]) : null;
}

export async function findMissingUserIds(ids: readonly string[], db: Queryable = pool): Promise<string[]> {
  const { rows } = await db.query<{ id: string }>('SELECT id FROM users WHERE id = ANY($1::uuid[])', [ids]);
  const existing = new Set(rows.map((r) => r.id));
  return ids.filter((id) => !existing.has(id));
}
