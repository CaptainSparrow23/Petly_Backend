import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Welcome to Petly Backend API!',
    status: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Basic pets endpoint
app.get('/api/pets', (req: Request, res: Response) => {
  res.json({
    message: 'Pets endpoint',
    pets: [
      { id: 1, name: 'Buddy', type: 'dog', breed: 'Golden Retriever' },
      { id: 2, name: 'Whiskers', type: 'cat', breed: 'Persian' },
      { id: 3, name: 'Charlie', type: 'bird', breed: 'Parrot' }
    ]
  });
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Error handling middleware
app.use((error: any, req: Request, res: Response, next: any) => {
  console.error('Error:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Something went wrong!'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Petly Backend server is running on port ${PORT}`);
  console.log(`📱 API available at: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
});

export default app;