import { z } from 'zod';

export const userId = z.uuid();
export const chatId = z.uuid();
export const messageId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, 'Invalid message id');
export const messageText = z.string().trim().min(1, 'text must not be empty').max(4000);

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  return schema.parse(data ?? {});
}
