import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: process.env.VERCEL
    ? [new winston.transports.Console()]
    : [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
      ],
});

const devConsoleFormat = winston.format.printf((info) => {
  const { level, message, stack, timestamp: _timestamp, ...meta } = info;
  const details = Object.entries(meta)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(' ');

  const lines = [`${level}: ${message}${details ? `  ${details}` : ''}`];

  if (typeof stack === 'string' && stack.length > 0) {
    lines.push(stack);
  }

  return lines.join('\n');
});

// Console prints a real stack, so file:line paths are clickable in the terminal.
if (process.env.NODE_ENV === 'development') {
  logger.add(
    new winston.transports.Console({
      level: "error",
      format: winston.format.combine(
        winston.format.colorize(),
        devConsoleFormat
      ),
    })
  );
}

export default logger;