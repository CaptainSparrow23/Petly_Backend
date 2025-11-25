import { Router, Request, Response } from 'express';
import { storeCatalog } from '../../data/storeCatalog';

const router = Router();

router.get('/catalog', (_req: Request, res: Response) => {
  try {
    res.status(200).json({
      success: true,
      data: storeCatalog,
      message: 'Store catalog retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching store catalog:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch store catalog',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
