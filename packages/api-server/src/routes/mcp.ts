import { Router, type IRouter, type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from '../mcp/server.js';
import { prisma } from '../db.js';

const router: IRouter = Router();

// ─── Session store ────────────────────────────────────────────────────────────
// Maps MCP session IDs to their transport + server instances.
// Each authenticated user gets their own session.

interface McpSession {
  transport: StreamableHTTPServerTransport;
  server: ReturnType<typeof createMcpServer>;
  userId: string;
  createdAt: number;
}

const sessions = new Map<string, McpSession>();

// Clean up stale sessions every 30 minutes (sessions older than 24h)
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      session.server.close().catch((err) => { console.error('[MCP] close error:', err); });
      sessions.delete(id);
    }
  }
}, 30 * 60 * 1000);

// ─── Auth helper ──────────────────────────────────────────────────────────────
// Supports both JWT (Bearer <jwt>) and MCP tokens (Bearer mcp_...).
// Returns userId or null.

async function extractUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);

  // MCP access token (long-lived, stored in DB)
  if (token.startsWith('mcp_')) {
    const record = await prisma.mcpToken.findUnique({ where: { token } });
    if (!record || record.revoked) return null;
    if (record.expiresAt && record.expiresAt < new Date()) return null;

    // Update lastUsed (fire-and-forget)
    prisma.mcpToken.update({
      where: { id: record.id },
      data: { lastUsed: new Date() },
    }).catch((err) => { console.error('[MCP] lastUsed update failed:', err); });

    return record.userId;
  }

  // JWT (short-lived session token)
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as { userId: string };
    return payload.userId;
  } catch {
    return null;
  }
}

// ─── POST /mcp — handle MCP JSON-RPC requests ────────────────────────────────

router.post('/', async (req: Request, res: Response) => {
  const userId = await extractUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized', message: 'Valid Bearer token required' });
    return;
  }

  // Check for existing session
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    // Verify the session belongs to this user
    if (session.userId !== userId) {
      res.status(403).json({ error: 'Forbidden', message: 'Session belongs to a different user' });
      return;
    }
    await session.transport.handleRequest(req, res);
    return;
  }

  // Enforce session limits
  const MAX_SESSIONS_PER_USER = 5;
  const MAX_TOTAL_SESSIONS = 500;

  if (sessions.size >= MAX_TOTAL_SESSIONS) {
    res.status(503).json({ error: 'Server busy', message: 'Too many active MCP sessions' });
    return;
  }

  const userSessionCount = [...sessions.values()].filter(s => s.userId === userId).length;
  if (userSessionCount >= MAX_SESSIONS_PER_USER) {
    // Evict oldest session for this user
    const oldest = [...sessions.entries()]
      .filter(([, s]) => s.userId === userId)
      .sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
    if (oldest) {
      oldest[1].server.close().catch((err) => { console.error('[MCP] close error:', err); });
      sessions.delete(oldest[0]);
    }
  }

  // New session — create transport + server
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  const server = createMcpServer(userId);

  // Connect server to transport — must complete before handling requests
  try {
    await server.connect(transport);
  } catch (err) {
    console.error('[MCP] Server connect error:', err);
    res.status(500).json({ error: 'MCP server initialization failed' });
    return;
  }

  // Pre-reserve a slot to prevent race conditions: store session before async handling.
  // Use a placeholder session ID until the transport assigns one.
  const placeholderId = `pending_${randomUUID()}`;
  sessions.set(placeholderId, { transport, server, userId, createdAt: Date.now() });

  await transport.handleRequest(req, res);

  // Replace placeholder with real session ID
  sessions.delete(placeholderId);
  if (transport.sessionId) {
    sessions.set(transport.sessionId, {
      transport,
      server,
      userId,
      createdAt: Date.now(),
    });
    console.log(`[MCP] New session ${transport.sessionId} for user ${userId}`);
  } else {
    // No session ID → server not needed, clean up
    server.close().catch((err) => { console.error('[MCP] close error:', err); });
  }
});

// ─── GET /mcp — SSE endpoint for server-to-client notifications ───────────────

router.get('/', async (req: Request, res: Response) => {
  const userId = await extractUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized', message: 'Valid Bearer token required' });
    return;
  }

  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !sessions.has(sessionId)) {
    res.status(404).json({ error: 'Session not found', message: 'Send an initialize request first (POST)' });
    return;
  }

  const session = sessions.get(sessionId)!;
  if (session.userId !== userId) {
    res.status(403).json({ error: 'Forbidden', message: 'Session belongs to a different user' });
    return;
  }

  await session.transport.handleRequest(req, res);
});

// ─── DELETE /mcp — terminate a session ────────────────────────────────────────

router.delete('/', async (req: Request, res: Response) => {
  const userId = await extractUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized', message: 'Valid Bearer token required' });
    return;
  }

  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !sessions.has(sessionId)) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const session = sessions.get(sessionId)!;
  if (session.userId !== userId) {
    res.status(403).json({ error: 'Forbidden', message: 'Session belongs to a different user' });
    return;
  }

  await session.transport.handleRequest(req, res);
  session.server.close().catch((err) => { console.error('[MCP] close error:', err); });
  sessions.delete(sessionId);
  console.log(`[MCP] Session ${sessionId} terminated`);
});

export default router;
