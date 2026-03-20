import type { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const NotFound = (what: string) => new AppError(404, 'Not Found', `${what} not found`);
export const Forbidden = (msg = 'System projects are read-only') => new AppError(403, 'Forbidden', msg);
export const BadRequest = (msg: string) => new AppError(400, 'Bad Request', msg);
export const PayloadTooLarge = (msg: string) => new AppError(413, 'Payload Too Large', msg);

/** Wraps an async route handler — eliminates try/catch in every route. */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
