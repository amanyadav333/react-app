export type ChatType = 'direct' | 'group';
// Role identify but one-one/group
export type MemberRole = 'admin' | 'member';

export interface User {
  id: string;
  name: string;
  createdAt: string;
}

export interface ChatMember {
  userId: string;
  role: MemberRole;
}

export interface Chat {
  chatId: string;
  type: ChatType;
  name: string | null;
  createdBy: string;
  createdAt: string;
  lastMessageAt: string | null;
  memberIds: string[];
}

export interface ChatDetails extends Omit<Chat, 'memberIds'> {
  members: ChatMember[];
}

export interface Message {
  messageId: string;
  chatId: string;
  senderId: string;
  text: string | null;
  seq: number;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  readBy: Record<string, string>;
}

export interface LastSeen {
  userId: string;
  messageId: string;
  seq: number;
  seenAt: string;
}
