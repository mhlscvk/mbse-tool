import { Router, type IRouter } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { prisma } from '../db.js';

const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));

const router: IRouter = Router();
const startTime = Date.now();

// GET /health — lightweight liveness check (no auth, no rate limit)
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'api-server',
    version: pkg.version,
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
  });
});

// GET /ready — deep readiness check with dependency verification
router.get('/ready', async (_req, res) => {
  const checks: Record<string, 'ok' | 'fail'> = {};

  // Check PostgreSQL connectivity
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    checks.database = 'ok';
  } catch (err) {
    checks.database = 'fail';
    console.error('[Health] Database check failed:', (err as Error).message);
  }

  const allOk = Object.values(checks).every(v => v === 'ok');
  const status = allOk ? 'ok' : 'degraded';

  res.status(allOk ? 200 : 503).json({ status, checks });
});

export default router;
