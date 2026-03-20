import { z } from 'zod';

export const email = z.string().email().transform(e => e.toLowerCase().trim());
export const password = z.string().min(8);
export const fileName = z.string().min(1).max(255);
export const fileContent = z.string().min(1);
export const provider = z.enum(['anthropic', 'openai', 'gemini']);
