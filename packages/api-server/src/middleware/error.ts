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
  let errorType: string;

  if (statusCode === 500) {
    console.error('[API Error]', err);
    message = isDev ? err.message : 'Internal server error';
    errorType = isDev ? (err.name ?? 'Error') : 'Error';
  } else if (err.name === 'ZodError') {
    message = 'Validation failed';
    errorType = 'ValidationError';
  } else {
    message = isDev ? err.message : 'Request failed';
    errorType = isDev ? (err.name ?? 'Error') : 'Error';
  }

  res.status(statusCode).json({
    error: errorType,
    message,
    statusCode,
  });
}
