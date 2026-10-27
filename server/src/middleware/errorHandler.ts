import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { sendError } from '../utils/apiResponse.js';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('[Error caught by global handler]:', err);

  // 1. Zod Validation Error
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    sendError(res, 'Validation failed for request data', 422, 'VALIDATION_ERROR', formattedErrors);
    return;
  }

  // 2. Mongoose Duplicate Key Error
  if (err.code === 11000) {
    const keys = Object.keys(err.keyValue || {});
    const field = keys[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : '';
    sendError(
      res,
      `A record with this ${field} ("${value}") already exists.`,
      409,
      'DUPLICATE_ENTRY',
      { field, value }
    );
    return;
  }

  // 3. Mongoose Cast Error (Invalid ObjectId)
  if (err.name === 'CastError') {
    sendError(res, `Invalid ID format for ${err.path}: ${err.value}`, 400, 'INVALID_ID');
    return;
  }

  // 4. Custom App Error with status code
  if (err.statusCode && typeof err.statusCode === 'number') {
    sendError(res, err.message || 'Operation failed', err.statusCode, err.code || 'APP_ERROR');
    return;
  }

  // 5. Default Internal Server Error
  sendError(
    res,
    process.env.NODE_ENV === 'production'
      ? 'An unexpected internal server error occurred.'
      : err.message || 'Internal Server Error',
    500,
    'INTERNAL_SERVER_ERROR'
  );
};
