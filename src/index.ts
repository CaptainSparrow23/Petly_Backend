import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import focusRoutes from './routes/focus/focus';
import accountRoutes from './routes/account/account';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/focus', focusRoutes);
app.use('/api/account', accountRoutes);

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'Petly Backend is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Petly Backend server is running on port ${PORT}`);
});

export default app;