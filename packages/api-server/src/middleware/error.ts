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
  // Zod validation errors should always be 400, not 500
  if (err.name === 'ZodError') {
    res.status(400).json({
      error: 'ValidationError',
      message: 'Validation failed',
      statusCode: 400,
    });
    return;
  }

  const statusCode = err.statusCode ?? 500;

  // Never leak internal details (Prisma queries, file paths, stack traces)
  // even in development — treat error responses as untrusted output
  let message: string;
  let errorType: string;

  if (statusCode >= 500) {
    console.error('[API Error]', err);
    message = 'Internal server error';
    errorType = 'Error';
  } else {
    message = err.message;
    errorType = err.name ?? 'Error';
  }

  res.status(statusCode).json({
    error: errorType,
    message,
    statusCode,
  });
}
