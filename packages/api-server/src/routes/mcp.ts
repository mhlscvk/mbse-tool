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
/** Per-user session count — avoids O(n) scan on every POST. */
const userSessionCounts = new Map<string, number>();

function trackSession(sessionId: string, session: McpSession) {
  sessions.set(sessionId, session);
  userSessionCounts.set(session.userId, (userSessionCounts.get(session.userId) ?? 0) + 1);
}

function untrackSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;
  sessions.delete(sessionId);
  const count = (userSessionCounts.get(session.userId) ?? 1) - 1;
  if (count <= 0) userSessionCounts.delete(session.userId);
  else userSessionCounts.set(session.userId, count);
}

// Clean up stale sessions every 30 minutes (sessions older than 24h)
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      session.server.close().catch((err) => { console.error('[MCP] close error:', err); });
      untrackSession(id);
    }
  }
}, 30 * 60 * 1000);

// ─── Auth helper ──────────────────────────────────────────────────────────────
// Supports both JWT (Bearer <jwt>) and MCP tokens (Bearer mcp_...).
// Returns userId or null.

async function extractUser(req: Request): Promise<{ userId: string; userRole?: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);

  // MCP access token (long-lived, stored in DB)
  if (token.startsWith('mcp_')) {
    const record = await prisma.mcpToken.findUnique({
      where: { token },
      include: { user: { select: { role: true } } },
    });
    if (!record || record.revoked) return null;
    if (record.expiresAt && record.expiresAt < new Date()) return null;

    // Update lastUsed (fire-and-forget)
    prisma.mcpToken.update({
      where: { id: record.id },
      data: { lastUsed: new Date() },
    }).catch((err) => { console.error('[MCP] lastUsed update failed:', err); });

    return { userId: record.userId, userRole: record.user.role };
  }

  // JWT (short-lived session token)
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as { userId: string; role?: string };
    return { userId: payload.userId, userRole: payload.role };
  } catch {
    return null;
  }
}

// ─── POST /mcp — handle MCP JSON-RPC requests ────────────────────────────────

router.post('/', async (req: Request, res: Response) => {
  const auth = await extractUser(req);
  if (!auth) {
    res.status(401).json({ error: 'Unauthorized', message: 'Valid Bearer token required' });
    return;
  }
  const { userId, userRole } = auth;

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

  const userSessionCount = userSessionCounts.get(userId) ?? 0;
  if (userSessionCount >= MAX_SESSIONS_PER_USER) {
    // Evict oldest session for this user
    let oldestId: string | null = null;
    let oldestTime = Infinity;
    for (const [id, s] of sessions) {
      if (s.userId === userId && s.createdAt < oldestTime) {
        oldestId = id;
        oldestTime = s.createdAt;
      }
    }
    if (oldestId) {
      sessions.get(oldestId)!.server.close().catch((err) => { console.error('[MCP] close error:', err); });
      untrackSession(oldestId);
    }
  }

  // New session — create transport + server
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  const server = createMcpServer(userId, userRole);

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
  const sessionData = { transport, server, userId, createdAt: Date.now() };
  trackSession(placeholderId, sessionData);

  await transport.handleRequest(req, res);

  // Replace placeholder with real session ID
  untrackSession(placeholderId);
  if (transport.sessionId) {
    trackSession(transport.sessionId, sessionData);
    console.log(`[MCP] New session ${transport.sessionId} for user ${userId}`);
  } else {
    // No session ID → server not needed, clean up
    server.close().catch((err) => { console.error('[MCP] close error:', err); });
  }
});

// ─── GET /mcp — SSE endpoint for server-to-client notifications ───────────────

router.get('/', async (req: Request, res: Response) => {
  const auth = await extractUser(req); const userId = auth?.userId;
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
  const auth = await extractUser(req); const userId = auth?.userId;
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
  untrackSession(sessionId);
  console.log(`[MCP] Session ${sessionId} terminated`);
});

export default router;
