import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { createProvider, type ChatMessage } from '../ai/providers.js';
import { executeToolCall } from '../ai/tools.js';
import { SYSTEM_PROMPT } from '../ai/system-prompt.js';
import { decryptApiKey } from '../ai/encryption.js';
import { prisma } from '../db.js';
import { asyncHandler, NotFound } from '../lib/errors.js';
import { assertProjectAccess } from '../lib/auth-helpers.js';
import { MAX_TOOL_ROUNDS, MAX_FREE_TIER_TOOL_ROUNDS, MAX_CONTEXT_LINES } from '../config/constants.js';
import { provider as providerSchema } from '../config/schemas.js';

const router: IRouter = Router();

/** Free tier: cheapest model, limited quota */
const FREE_MODEL = 'claude-haiku-4-5-20251001';
const FREE_MONTHLY_LIMIT = parseInt(process.env.AI_MONTHLY_LIMIT ?? '50', 10); // requests per month

// ─── Helpers ─────────────────────────────────────────────────────────────────

function currentPeriodStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

async function getMonthlyUsage(userId: string): Promise<number> {
  const period = currentPeriodStart();
  const usage = await prisma.aiUsage.findUnique({
    where: { userId_periodStart: { userId, periodStart: period } },
  });
  return usage?.requestCount ?? 0;
}

/** Atomically check quota and increment. Returns true if allowed, false if over limit. */
async function tryConsumeFreeTierRequest(userId: string): Promise<boolean> {
  const period = currentPeriodStart();
  // Upsert + conditional increment in a single atomic operation
  const usage = await prisma.aiUsage.upsert({
    where: { userId_periodStart: { userId, periodStart: period } },
    create: { userId, periodStart: period, requestCount: 1 },
    update: { requestCount: { increment: 1 } },
  });
  // If after increment we exceed the limit, the request was the one that went over
  return usage.requestCount <= FREE_MONTHLY_LIMIT;
}

// ─── GET /status — free tier status for the authenticated user ───────────────

router.get('/status', requireAuth, async (req: AuthRequest, res) => {
  const serverKeyConfigured = !!process.env.ANTHROPIC_API_KEY;
  const used = await getMonthlyUsage(req.userId!);
  const period = currentPeriodStart();
  const periodEnd = new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth() + 1, 1));

  res.json({
    freeTierAvailable: serverKeyConfigured,
    freeModel: serverKeyConfigured ? FREE_MODEL : null,
    used,
    limit: FREE_MONTHLY_LIMIT,
    remaining: Math.max(0, FREE_MONTHLY_LIMIT - used),
    periodEnd: periodEnd.toISOString(),
  });
});

// ─── GET /history/:fileId — load chat history for a file ─────────────────────

router.get('/history/:fileId', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const { fileId } = req.params;
  const file = await prisma.sysMLFile.findUnique({
    where: { id: fileId },
    select: { id: true, projectId: true },
  });
  if (!file) throw NotFound('File');
  const access = await assertProjectAccess(file.projectId, req.userId!, req.userRole);
  if (!access.allowed) throw NotFound('File');
  const messages = await prisma.aiChatMessage.findMany({
    where: { userId: req.userId!, fileId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, role: true, text: true, edits: true, createdAt: true },
  });
  res.json({ data: messages });
}));

// ─── DELETE /history/:fileId — clear chat history for a file ─────────────────

router.delete('/history/:fileId', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const { fileId } = req.params;
  const file = await prisma.sysMLFile.findUnique({
    where: { id: fileId },
    select: { id: true, projectId: true },
  });
  if (!file) throw NotFound('File');
  const access = await assertProjectAccess(file.projectId, req.userId!, req.userRole);
  if (!access.allowed) throw NotFound('File');
  await prisma.aiChatMessage.deleteMany({ where: { userId: req.userId!, fileId } });
  res.json({ data: { success: true } });
}));

// ─── POST /chat — streaming AI chat (hybrid: free tier or user's own key) ────

const chatSchema = z.object({
  provider: providerSchema,
  model: z.string().optional(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })),
  context: z.object({
    projectId: z.string().optional(),
    fileId: z.string().optional(),
    fileContent: z.string().optional(),
    fileName: z.string().optional(),
  }).optional(),
});

router.post('/chat', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;

  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', message: parsed.error.issues[0]?.message ?? 'Invalid request' });
    return;
  }

  const { provider: providerName, model, messages: inputMessages, context } = parsed.data;

  // Determine which key and model to use
  let apiKey: string;
  let actualModel: string | undefined;
  let isFreeTier = false;

  // 1. Try user's stored key for the requested provider
  const storedKey = await prisma.aiProviderKey.findUnique({
    where: { userId_provider: { userId, provider: providerName } },
  });

  if (storedKey) {
    try {
      apiKey = decryptApiKey(storedKey.encryptedKey, storedKey.iv, storedKey.authTag);
      actualModel = model ?? storedKey.model;
    } catch {
      res.status(500).json({ error: 'Failed to decrypt API key — please re-save your key in Settings' });
      return;
    }
  } else if (process.env.ANTHROPIC_API_KEY && providerName === 'anthropic') {
    // 2. Fall back to free tier (server's Anthropic key, Haiku, quota enforced)
    const allowed = await tryConsumeFreeTierRequest(userId);
    if (!allowed) {
      const period = currentPeriodStart();
      const periodEnd = new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth() + 1, 1));
      res.status(429).json({
        error: 'Free tier limit reached',
        message: `You have used all ${FREE_MONTHLY_LIMIT} free messages this month. Add your own API key in Settings for unlimited access. Resets ${periodEnd.toISOString().slice(0, 10)}.`,
      });
      return;
    }
    apiKey = process.env.ANTHROPIC_API_KEY;
    actualModel = FREE_MODEL;
    isFreeTier = true;
  } else {
    res.status(400).json({
      error: 'No API key',
      message: 'Add your AI provider API key in Settings to use the chat.',
    });
    return;
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (res as any).flush === 'function') (res as any).flush();
  };

  // Persist chat history helper
  const fileId = context?.fileId;
  const userInstruction = inputMessages[inputMessages.length - 1]?.content ?? '';
  let fullAssistantText = '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const collectedToolCalls: any[] = [];
  let historySaved = false;

  const saveHistory = async () => {
    if (!fileId || historySaved) return;
    historySaved = true;
    try {
      await prisma.$transaction([
        prisma.aiChatMessage.create({
          data: { userId, fileId, role: 'user', text: userInstruction },
        }),
        prisma.aiChatMessage.create({
          data: {
            userId, fileId, role: 'assistant',
            text: fullAssistantText,
            edits: collectedToolCalls.length > 0 ? collectedToolCalls : undefined,
          },
        }),
      ]);
    } catch (e) {
      console.error('[AI] Failed to persist chat history:', e);
    }
  };

  try {
    const aiProvider = createProvider(isFreeTier ? 'anthropic' : providerName, apiKey, actualModel);

    // Build system prompt with file context (truncate large files to save tokens)
    let system = SYSTEM_PROMPT;
    if (context?.fileContent != null) {
      const allLines = context.fileContent.split('\n');
      const truncated = allLines.length > MAX_CONTEXT_LINES;
      const displayLines = truncated ? allLines.slice(0, MAX_CONTEXT_LINES) : allLines;
      const numbered = displayLines
        .map((line, i) => `${String(i + 1).padStart(4, ' ')} | ${line}`)
        .join('\n');
      system += `\n\nCurrent file: ${context.fileName ?? 'untitled'} (${allLines.length} lines${truncated ? `, showing first ${MAX_CONTEXT_LINES}` : ''})\n\`\`\`\n${numbered}\n\`\`\``;
      if (truncated) system += `\n(File truncated — use read_file tool to see full content)`;
      if (context.fileId) system += `\nFile ID: ${context.fileId}`;
      if (context.projectId) system += `\nProject ID: ${context.projectId}`;
    }

    const conversation: ChatMessage[] = inputMessages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Tool call loop (free tier gets fewer rounds to limit token consumption)
    const maxRounds = isFreeTier ? MAX_FREE_TIER_TOOL_ROUNDS : MAX_TOOL_ROUNDS;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (let round = 0; round < maxRounds; round++) {
      let assistantText = '';

      for await (const event of aiProvider.streamChat(system, conversation)) {
        if (event.type === 'text_delta') {
          assistantText += event.text;
          fullAssistantText += event.text;
          send('text', { chunk: event.text });
        } else if (event.type === 'tool_calls') {
          // Push assistant message with both text and tool_use info so the
          // next API call can match tool_result IDs to tool_use IDs
          conversation.push({ role: 'assistant', content: assistantText, toolCalls: event.calls });

          for (const call of event.calls) {
            send('tool_call', { id: call.id, name: call.name, args: call.args });
            const result = await executeToolCall(userId, call.name, call.args);
            send('tool_result', { id: call.id, name: call.name, result: result.result, isError: result.isError });
            collectedToolCalls.push({ name: call.name, args: call.args, result: result.result, isError: result.isError });
            conversation.push({
              role: 'tool_result',
              content: result.result,
              toolCallId: call.id,
              toolName: call.name,
            });
          }
        } else if (event.type === 'done') {
          if (event.usage) {
            totalInputTokens += event.usage.inputTokens;
            totalOutputTokens += event.usage.outputTokens;
            send('usage', { inputTokens: totalInputTokens, outputTokens: totalOutputTokens });
          }

          if (event.stopReason === 'tool_use' || event.stopReason === 'tool_calls') {
            continue;
          }

          await saveHistory();
          send('done', { isFreeTier, usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens } });
          res.end();
          return;
        }
      }

      if (conversation[conversation.length - 1]?.role !== 'tool_result') {
        await saveHistory();
        send('done', { isFreeTier, usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens } });
        res.end();
        return;
      }
    }

    send('text', { chunk: '\n\n(Maximum tool call rounds reached)' });
    await saveHistory();
    send('done', { isFreeTier, usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens } });
  } catch (err) {
    let msg = 'AI request failed';
    if (err instanceof Error) {
      msg = err.message;
      const e = err as Error & { status?: number };
      if (e.status === 401) msg = isFreeTier ? 'Server AI configuration error' : 'Invalid API key — check your credentials in Settings';
      else if (e.status === 429) msg = 'Rate limit exceeded — try again shortly';
      else if (e.status === 529) msg = 'AI provider is temporarily overloaded — try again in a minute';
    }
    console.error('[AI Chat]', msg);
    send('error', { message: msg });
  } finally {
    res.end();
  }
});

export default router;
