import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

// simple request logger — shows method, URL and time for every incoming request
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// health check route (useful for deployment platforms to check if server is alive)
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

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ message: 'Route not found' });
});

// global error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({
    message: 'Something went wrong on the server',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

export default app;