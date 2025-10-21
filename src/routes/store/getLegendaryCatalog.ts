import { Router, Request, Response } from 'express';
import { db } from '../../firebase';

const router = Router();

router.get('/legendary', async (_req: Request, res: Response) => {
  try {
    const snapshot = await db
      .collection('store')
      .doc('catalog')
      .collection('legendaryPets')
      .get();

    const pets = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    res.status(200).json({
      success: true,
      data: pets,
      message: 'Legendary catalog retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching legendary catalog:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch legendary catalog',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
