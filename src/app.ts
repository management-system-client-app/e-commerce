import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import AppError from './utils/AppError';
import logger from './config/logger';

const app = express();

// security-related HTTP headers
app.use(helmet());

// allows frontend (different origin) to call this API
app.use(cors());

// compresses response bodies (gzip) for faster transfer
app.use(compression());

// parses cookies into req.cookies
app.use(cookieParser());

// parses incoming JSON request body, with a size limit for safety
app.use(express.json({ limit: '10kb' }));

// pipes morgan's HTTP request logs into winston instead of console directly
const morganStream = {
  write: (message: string) => logger.info(message.trim()),
};

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev', { stream: morganStream }));
} else {
  app.use(morgan('combined', { stream: morganStream }));
}

// health check routes — used to confirm the server is alive
app.get('/', (req: Request, res: Response) => {
  res.send('E-commerce Backend is running!');
});

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ===== API v1 routes =====
// all actual API endpoints will be added here, versioned under /api/v1
const apiV1 = express.Router();

// test routes for each error type (remove these later once real routes are built)
apiV1.get('/test-error/bad-request', (req, res, next) => {
  next(AppError.badRequest('Invalid input provided'));
});

apiV1.get('/test-error/unauthorized', (req, res, next) => {
  next(AppError.unauthorized('Please log in first'));
});

apiV1.get('/test-error/forbidden', (req, res, next) => {
  next(AppError.forbidden('You are not allowed to do this'));
});

apiV1.get('/test-error/not-found', (req, res, next) => {
  next(AppError.notFound('Product not found'));
});

apiV1.get('/test-error/conflict', (req, res, next) => {
  next(AppError.conflict('Email already registered'));
});

apiV1.get('/test-error/validation', (req, res, next) => {
  next(AppError.validationError('Email format is invalid'));
});

// mount the v1 router — all its routes become accessible under /api/v1
app.use('/api/v1', apiV1);

// 404 handler — runs when no route above matches the request
app.use((req: Request, res: Response, next: NextFunction) => {
  next(AppError.notFound(`Route not found: ${req.originalUrl}`));
});

// global error handler — must always be the last middleware in the chain
app.use((err: AppError, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Something went wrong on the server';

  logger.error(message, { stack: err.stack, path: req.originalUrl });

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),   // hide stack trace in production
  });
});

export default app;