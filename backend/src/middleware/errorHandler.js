import { logger } from '../utils/logger.js';

export class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Log error
  if (statusCode >= 500) {
    logger.error('Server error', {
      error: message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip
    });
  } else {
    logger.warn('Client error', {
      error: message,
      path: req.path,
      method: req.method,
      statusCode
    });
  }

  // Send error response
  res.status(statusCode).json({
    error: {
      message,
      statusCode,
      timestamp: err.timestamp || new Date().toISOString(),
      path: req.path,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

// Async handler wrapper
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
