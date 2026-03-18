import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import fileRoutes from './routes/files.js';
import mcpRoutes from './routes/mcp.js';
import mcpTokenRoutes from './routes/mcp-tokens.js';
import aiChatRoutes from './routes/ai-chat.js';
import aiKeysRoutes from './routes/ai-keys.js';
import { errorHandler } from './middleware/error.js';

const PORT = parseInt(process.env.PORT ?? '3003', 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map(o => o.trim())
  .filter(o => /^https?:\/\//.test(o));

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // CSP handled by Nginx/Cloudflare for the SPA
  crossOriginEmbedderPolicy: false,
}));

// HTTPS enforcement in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.get('x-forwarded-proto') !== 'https') {
      return res.redirect('https://' + req.get('host') + req.url);
    }
    next();
  });
}

// CORS
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Mcp-Session-Id', 'X-AI-Api-Key'],
  exposedHeaders: ['Mcp-Session-Id'],
}));

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'TooManyRequests', message: 'Too many attempts, try again later', statusCode: 429 },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'TooManyRequests', message: 'Too many registrations, try again later', statusCode: 429 },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const aiChatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20,
  message: { error: 'TooManyRequests', message: 'AI chat rate limit — try again shortly', statusCode: 429 },
  standardHeaders: true,
  legacyHeaders: false,
});

const mcpLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200, // MCP clients make many small requests
  standardHeaders: true,
  legacyHeaders: false,
});

// Default JSON body parser (skip /mcp — the MCP SDK reads the raw body itself)
app.use((req, res, next) => {
  if (req.path.startsWith('/mcp')) return next();
  express.json({ limit: '100kb' })(req, res, next);
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'api-server', port: PORT });
});

// Auth routes with rate limiting
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth/google', authLimiter);
app.use('/api/auth', authRoutes);

// API routes with general rate limiting
app.use('/api/projects', apiLimiter);
// File routes need larger payload for SysML content
app.use('/api/projects/:projectId/files', express.json({ limit: '10mb' }));
app.use('/api/projects', projectRoutes);
app.use('/api/projects/:projectId/files', fileRoutes);
app.use('/api/mcp-tokens', apiLimiter, mcpTokenRoutes);
app.use('/api/ai', aiChatLimiter, express.json({ limit: '2mb' }), aiChatRoutes);
app.use('/api/ai/keys', apiLimiter, aiKeysRoutes);

// MCP endpoint — Streamable HTTP transport for AI client integrations
// MCP clients (Claude Desktop, Cursor, etc.) are desktop apps, not browsers.
app.use('/mcp', cors(), mcpLimiter, mcpRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[API] Server running on http://localhost:${PORT}`);
});
