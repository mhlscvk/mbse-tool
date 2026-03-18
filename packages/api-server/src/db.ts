import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// Graceful shutdown — drain database connections
const shutdown = async () => {
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
