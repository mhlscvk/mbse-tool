import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// Graceful shutdown — drain database connections with a timeout
const SHUTDOWN_TIMEOUT_MS = 10_000;

const shutdown = async (signal: string) => {
  console.log(`[DB] Received ${signal}, disconnecting...`);
  const timer = setTimeout(() => {
    console.error('[DB] Shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  try {
    await prisma.$disconnect();
  } catch (err) {
    console.error('[DB] Disconnect error:', err);
  } finally {
    clearTimeout(timer);
    process.exit(0);
  }
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
