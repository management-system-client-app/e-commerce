import dotenv from 'dotenv';
import app from './app';

dotenv.config();   // loads variables from .env file

const PORT = process.env.PORT || 5000;

// server starting code wrapped in try-catch
try {
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`http://localhost:${PORT}`);   // clickable link in terminal
  });

  // handles errors during server startup (e.g. port already in use)
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Close the other process or change PORT in .env`);
    } else {
      console.error('Server failed to start:', error.message);
    }
    process.exit(1);
  });

} catch (error) {
  console.error('Something went wrong while starting the server:', error);
  process.exit(1);
}

// catches errors that happen anywhere else in the app but aren't handled
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});

// catches synchronous errors that crash the app unexpectedly
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});