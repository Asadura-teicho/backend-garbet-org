/**
 * Error Handling Middleware
 * Provides consistent error responses across the application
 * Works in both development and production environments
 */

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Custom Error Class for API errors
 */
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Create standardized error response
 */
const createErrorResponse = (err, req) => {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational !== false;

  // Base error response
  const errorResponse = {
    success: false,
    status: err.status || 'error',
    message: isDevelopment || isOperational 
      ? err.message 
      : 'An unexpected error occurred. Please try again later.',
  };

  // Add error details in development
  if (isDevelopment) {
    errorResponse.error = {
      message: err.message,
      stack: err.stack,
      name: err.name,
    };

    // Add request details
    if (req) {
      errorResponse.request = {
        method: req.method,
        url: req.originalUrl,
        body: req.body,
        query: req.query,
        params: req.params,
      };
    }
  }

  // Add validation errors if present
  if (err.name === 'ValidationError' && err.errors) {
    errorResponse.errors = Object.keys(err.errors).map(key => ({
      field: key,
      message: err.errors[key].message,
    }));
  }

  // Add MongoDB duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    errorResponse.message = `${field} already exists. Please use a different value.`;
    errorResponse.statusCode = 409;
  }

  // Add MongoDB cast error
  if (err.name === 'CastError') {
    errorResponse.message = `Invalid ${err.path || 'ID'}. Please provide a valid value.`;
    errorResponse.statusCode = 400;
  }

  return {
    ...errorResponse,
    statusCode: errorResponse.statusCode || statusCode,
  };
};

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log error
  console.error('Error:', {
    message: err.message,
    stack: isDevelopment ? err.stack : undefined,
    statusCode: err.statusCode || 500,
    url: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // Create error response
  const errorResponse = createErrorResponse(err, req);

  // Send error response
  res.status(errorResponse.statusCode).json(errorResponse);
};

/**
 * Handle 404 Not Found
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError(
    `Route ${req.originalUrl} not found`,
    404
  );
  next(error);
};

/**
 * Handle async errors
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Handle unhandled promise rejections
 */
const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION! Shutting down...');
    console.error('Error:', err);
    // Close server gracefully
    process.exit(1);
  });
};

/**
 * Handle uncaught exceptions
 */
const handleUncaughtException = () => {
  process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION! Shutting down...');
    console.error('Error:', err);
    // Close server gracefully
    process.exit(1);
  });
};

module.exports = {
  AppError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  handleUnhandledRejection,
  handleUncaughtException,
};

