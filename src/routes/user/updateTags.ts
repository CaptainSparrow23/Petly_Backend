import { Router, Request, Response } from 'express';
import { db } from '../../firebase';

const router = Router();

/**
 * PUT /api/user/tags/:userId
 * Update user's tag list
 */
router.put('/tags/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { tagList } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameter: userId',
    });
  }

  if (!tagList || !Array.isArray(tagList)) {
    return res.status(400).json({
      success: false,
      error: 'tagList is required and must be an array',
    });
  }

  // Validate tag structure
  for (const tag of tagList) {
    if (!tag.id || !tag.label || !tag.color || !tag.activity) {
      return res.status(400).json({
        success: false,
        error: 'Each tag must have id, label, color, and activity fields',
      });
    }
    if (tag.activity !== 'Focus' && tag.activity !== 'Rest') {
      return res.status(400).json({
        success: false,
        error: 'Tag activity must be either "Focus" or "Rest"',
      });
    }
  }

  try {
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    await userDocRef.update({
      tagList: tagList,
    });

    console.log(`✅ Updated tags for user ${userId}: ${tagList.length} tags`);

    res.status(200).json({
      success: true,
      message: 'Tags updated successfully',
      data: {
        tagList: tagList,
      },
    });
  } catch (error) {
    console.error('❌ Error updating tags:', error);

    if (error && typeof error === 'object' && 'code' in error && error.code === 5) {
      return res.status(500).json({
        success: false,
        error: 'Firestore database not found',
        message: 'Please create a Firestore database in your Firebase console first',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update tags',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
