import { FieldPath, FieldValue, Timestamp, type DocumentSnapshot } from 'firebase-admin/firestore';
import { firestore } from '../db/firestore';
import { badRequest, forbidden, notFound } from '../errors';
import type { LastSeen, Message } from '../types';

interface MessageDoc {
  senderId: string;
  text: string | null;
  seq: number;
  createdAt: Timestamp;
  editedAt: Timestamp | null;
  deleted: boolean;
  readBy: Record<string, Timestamp>;
}

interface LastSeenDoc {
  messageId: string;
  seq: number;
  seenAt: Timestamp;
}

const chatDoc = (chatId: string) => firestore.collection('chats').doc(chatId);
const messagesCol = (chatId: string) => chatDoc(chatId).collection('messages');
const lastSeenCol = (chatId: string) => chatDoc(chatId).collection('lastSeen');

const iso = (ts: Timestamp): string => ts.toDate().toISOString();

function toMessage(chatId: string, snap: DocumentSnapshot): Message {
  const d = snap.data() as MessageDoc;
  return {
    messageId: snap.id,
    chatId,
    senderId: d.senderId,
    text: d.deleted ? null : d.text,
    seq: d.seq,
    createdAt: iso(d.createdAt),
    editedAt: d.editedAt ? iso(d.editedAt) : null,
    deleted: d.deleted,
    readBy: Object.fromEntries(Object.entries(d.readBy ?? {}).map(([userId, ts]) => [userId, iso(ts)])),
  };
}

function toLastSeen(snap: DocumentSnapshot): LastSeen {
  const d = snap.data() as LastSeenDoc;
  return { userId: snap.id, messageId: d.messageId, seq: d.seq, seenAt: iso(d.seenAt) };
}

export async function createMessage(chatId: string, senderId: string, text: string): Promise<Message> {
  const ref = await firestore.runTransaction(async (tx) => {
    const chatSnap = await tx.get(chatDoc(chatId));
    const seq = ((chatSnap.get('lastSeq') as number | undefined) ?? 0) + 1;
    const msgRef = messagesCol(chatId).doc();
    tx.set(chatDoc(chatId), { lastSeq: seq, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(msgRef, {
      senderId,
      text,
      seq,
      createdAt: FieldValue.serverTimestamp(),
      editedAt: null,
      deleted: false,
      readBy: {},
    });
    return msgRef;
  });
  return toMessage(chatId, await ref.get());
}

export async function getMessage(chatId: string, messageId: string): Promise<Message | null> {
  const snap = await messagesCol(chatId).doc(messageId).get();
  return snap.exists ? toMessage(chatId, snap) : null;
}

export async function listMessages(chatId: string, limit: number, beforeSeq?: number): Promise<Message[]> {
  let query = messagesCol(chatId).orderBy('seq', 'desc');
  if (beforeSeq !== undefined) query = query.where('seq', '<', beforeSeq);
  const snap = await query.limit(limit).get();
  return snap.docs.map((doc) => toMessage(chatId, doc)).reverse();
}

export async function markRead(chatId: string, messageId: string, userId: string): Promise<Message> {
  const ref = messagesCol(chatId).doc(messageId);
  await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound('Message not found');
    const d = snap.data() as MessageDoc;
    if (d.senderId === userId || d.readBy?.[userId]) return;
    tx.update(ref, new FieldPath('readBy', userId), FieldValue.serverTimestamp());
  });
  return toMessage(chatId, await ref.get());
}

export async function updateLastSeen(
  chatId: string,
  userId: string,
  messageId: string,
): Promise<{ lastSeen: LastSeen; updated: boolean }> {
  const msgRef = messagesCol(chatId).doc(messageId);
  const seenRef = lastSeenCol(chatId).doc(userId);
  const updated = await firestore.runTransaction(async (tx) => {
    const [msgSnap, seenSnap] = await Promise.all([tx.get(msgRef), tx.get(seenRef)]);
    if (!msgSnap.exists) throw notFound('Message not found');
    const seq = (msgSnap.data() as MessageDoc).seq;
    const current = seenSnap.exists ? (seenSnap.data() as LastSeenDoc) : null;
    if (current && current.seq >= seq) return false;
    tx.set(seenRef, { messageId, seq, seenAt: FieldValue.serverTimestamp() });
    return true;
  });
  return { lastSeen: toLastSeen(await seenRef.get()), updated };
}

export async function listLastSeen(chatId: string): Promise<LastSeen[]> {
  const snap = await lastSeenCol(chatId).get();
  return snap.docs.map(toLastSeen);
}