import { Router, Request, Response } from 'express';
import { petCatalog } from '../../data/petCatalog';

const router = Router();

router.get('/catalog', (_req: Request, res: Response) => {
  try {
    res.status(200).json({
      success: true,
      data: petCatalog,
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
