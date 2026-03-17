import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode ?? 500;
  const isDev = process.env.NODE_ENV !== 'production';

  // Never leak Prisma/DB internals or stack traces in production
  let message: string;
  if (statusCode === 500) {
    console.error('[API Error]', err);
    message = isDev ? err.message : 'Internal server error';
  } else if (err.name === 'ZodError') {
    message = 'Validation failed';
  } else {
    message = isDev ? err.message : 'Request failed';
  }

  res.status(statusCode).json({
    error: err.name === 'ZodError' ? 'ValidationError' : (err.name ?? 'Error'),
    message,
    statusCode,
  });
}
