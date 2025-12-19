import { Router, Request, Response } from 'express';
import { featuredSets } from '../../data/featuredSets';
import { storeCatalog } from '../../data/storeCatalog';

const router = Router();

// GET /api/store/featured - Get all featured sets with resolved item details
router.get('/featured', (_req: Request, res: Response) => {
  try {
    // Resolve item details for each set
    const setsWithItems = featuredSets.map((set) => {
      const items = set.itemIds
        .map((itemId) => storeCatalog.find((item) => item.id === itemId))
        .filter(Boolean);

      return {
        id: set.id,
        title: set.title,
        description: set.description,
        artKey: set.artKey,
        items,
      };
    });

    res.status(200).json({
      success: true,
      data: setsWithItems,
      message: 'Featured sets retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching featured sets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured sets',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/store/featured/:setId - Get a specific featured set
router.get('/featured/:setId', (req: Request, res: Response) => {
  try {
    const { setId } = req.params;
    const set = featuredSets.find((s) => s.id === setId);

    if (!set) {
      res.status(404).json({
        success: false,
        message: 'Featured set not found',
      });
      return;
    }

    const items = set.itemIds
      .map((itemId) => storeCatalog.find((item) => item.id === itemId))
      .filter(Boolean);

    res.status(200).json({
      success: true,
      data: {
        id: set.id,
        title: set.title,
        description: set.description,
        artKey: set.artKey,
        items,
      },
      message: 'Featured set retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching featured set:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured set',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
