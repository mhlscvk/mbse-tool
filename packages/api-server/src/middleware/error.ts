import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';

export function errorHandler(
  err: Error,
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

  // AppError: typed errors thrown by services and route helpers
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: err.code,
      message: err.message,
      statusCode: err.status,
    });
    return;
  }

  // Unknown errors: never leak internal details
  const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500;

  if (statusCode >= 500) {
    console.error('[API Error]', err);
    res.status(statusCode).json({
      error: 'Error',
      message: 'Internal server error',
      statusCode,
    });
  } else {
    res.status(statusCode).json({
      error: err.name ?? 'Error',
      message: err.message,
      statusCode,
    });
  }
}
