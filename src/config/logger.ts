import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // errors go into this file
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // all logs (info, warn, error) go into this file
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// also log to console in development, in a readable colored format
if (process.env.NODE_ENV === 'development') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

export default logger;