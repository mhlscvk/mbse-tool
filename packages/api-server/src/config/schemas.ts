import { z } from 'zod';
import { MAX_FILE_BYTES } from './constants.js';

export const email = z.string().email().transform(e => e.toLowerCase().trim());
export const password = z.string().min(8);
export const fileName = z.string().min(1).max(255);
export const fileContent = z.string().min(1).max(MAX_FILE_BYTES);
export const provider = z.enum(['anthropic', 'openai', 'gemini']);
