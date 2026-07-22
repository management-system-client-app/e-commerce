import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

// health check route
app.get('/', (req: Request, res: Response) => {
  res.send('E-commerce Backend is running!');
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