import { env } from './config/env';   // also validates required env variables on import
import app from './app';

const PORT = env.PORT;

// wrapped in try-catch to catch synchronous errors during startup
try {
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`http://localhost:${PORT}`);
  });

  // handles errors that occur asynchronously during server startup (e.g. port in use)
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Close the other process or change PORT in .env`);
    } else {
      console.error('Server failed to start:', error.message);
    }
    process.exit(1);
  });

  // gracefully closes the server on shutdown signals (e.g. Ctrl+C, deployment restart)
  const shutdown = (signal: string) => {
    console.log(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

} catch (error) {
  console.error('Something went wrong while starting the server:', error);
  process.exit(1);
}

// catches promise rejections that weren't handled anywhere else
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});

// catches unexpected synchronous crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});