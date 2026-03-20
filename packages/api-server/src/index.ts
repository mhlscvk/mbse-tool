import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { RATE_LIMIT } from './config/constants.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import fileRoutes from './routes/files.js';
import mcpRoutes from './routes/mcp.js';
import mcpTokenRoutes from './routes/mcp-tokens.js';
import aiChatRoutes from './routes/ai-chat.js';
import aiKeysRoutes from './routes/ai-keys.js';
import adminRoutes from './routes/admin.js';
import bugReportRoutes from './routes/bug-reports.js';
import { errorHandler } from './middleware/error.js';

const PORT = parseInt(process.env.PORT ?? '3003', 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map(o => o.trim())
  .filter(o => /^https?:\/\//.test(o));

// Startup validation: catch misconfigured dotenv (wrong cwd, missing .env)
if (process.env.NODE_ENV === 'production' && ALLOWED_ORIGINS.every(o => o.includes('localhost'))) {
  console.error('[API] FATAL: ALLOWED_ORIGINS contains only localhost in production.');
  console.error('[API] This usually means .env was not loaded — check PM2 cwd or dotenv path.');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('[API] FATAL: JWT_SECRET is not set in production.');
  process.exit(1);
}
if (process.env.AI_ENCRYPTION_KEY && process.env.AI_ENCRYPTION_KEY.length !== 64) {
  console.error('[API] FATAL: AI_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

console.log(`[API] ALLOWED_ORIGINS: ${ALLOWED_ORIGINS.join(', ')}`);

const app = express();

// Trust proxy: required behind Nginx reverse proxy so that:
// - req.ip reflects real client IP (not 127.0.0.1)
// - express-rate-limit keys on actual client IPs
// - x-forwarded-proto is trusted for HTTPS enforcement
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://accounts.google.com'],
      connectSrc: ["'self'", ...ALLOWED_ORIGINS, ...ALLOWED_ORIGINS.map(o => o.replace(/^http/, 'ws'))],
      imgSrc: ["'self'", 'data:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      frameSrc: ["'self'", 'https://accounts.google.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
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

// Rate limiters (values from config/constants.ts)
const limiterOpts = { standardHeaders: true, legacyHeaders: false } as const;

const authLimiter = rateLimit({
  ...RATE_LIMIT.auth, ...limiterOpts,
  message: { error: 'TooManyRequests', message: 'Too many attempts, try again later', statusCode: 429 },
});

const registerLimiter = rateLimit({
  ...RATE_LIMIT.register, ...limiterOpts,
  message: { error: 'TooManyRequests', message: 'Too many registrations, try again later', statusCode: 429 },
});

const apiLimiter = rateLimit({ ...RATE_LIMIT.api, ...limiterOpts });

const aiChatLimiter = rateLimit({
  ...RATE_LIMIT.aiChat, ...limiterOpts,
  message: { error: 'TooManyRequests', message: 'AI chat rate limit — try again shortly', statusCode: 429 },
});

const mcpLimiter = rateLimit({ ...RATE_LIMIT.mcp, ...limiterOpts });

// Default JSON body parser (skip /mcp — the MCP SDK reads the raw body itself)
app.use((req, res, next) => {
  if (req.path.startsWith('/mcp')) return next();
  express.json({ limit: '100kb' })(req, res, next);
});

// CSRF protection: state-changing requests must include Content-Type: application/json.
// Browsers enforce CORS preflight for non-simple content types, preventing
// cross-origin form submissions (which use application/x-www-form-urlencoded).
// This is a standard CSRF mitigation for JSON APIs.
app.use((req, res, next) => {
  if (req.path.startsWith('/mcp')) return next(); // MCP has its own auth
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const ct = req.headers['content-type'] ?? '';
    // Allow requests with no body (DELETE) or JSON content type
    if (req.method === 'DELETE' && !ct) return next();
    if (!ct.includes('application/json') && !ct.includes('text/event-stream')) {
      res.status(415).json({ error: 'Unsupported Media Type', message: 'Content-Type must be application/json' });
      return;
    }
  }
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'api-server', port: PORT });
});

// Auth routes with rate limiting
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth/google', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
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
app.use('/api/admin', apiLimiter, adminRoutes);
app.use('/api/bug-reports', apiLimiter, express.json({ limit: '8mb' }), bugReportRoutes);

// MCP endpoint — Streamable HTTP transport for AI client integrations
// MCP clients (Claude Desktop, Cursor, etc.) are desktop apps, not browsers.
// Still restrict CORS to known origins + allow non-browser clients (no Origin header).
app.use('/mcp', cors({
  origin: (origin, callback) => {
    // Desktop apps (Claude, Cursor) send no Origin header — allow those
    if (!origin) return callback(null, true);
    // Browser requests must come from allowed origins
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error('CORS not allowed'));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'Mcp-Session-Id'],
  exposedHeaders: ['Mcp-Session-Id'],
}), mcpLimiter, mcpRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[API] Server running on http://localhost:${PORT}`);
});
