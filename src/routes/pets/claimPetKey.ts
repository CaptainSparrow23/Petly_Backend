import { Router, Request, Response } from 'express';
import admin from 'firebase-admin';
import { db } from '../../firebase';

const router = Router();

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = typeof value === 'string' ? Number(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const PET_FRIENDSHIP_MAX_LEVEL = 10;

const xpNeededForNext = (currentLevel: number) => 5 * currentLevel * (currentLevel + 9);

const computeFriendshipLevel = (totalXP: number, maxLevel: number) => {
  let level = 1;
  let remainingXP = Math.max(0, totalXP);
  while (level < maxLevel) {
    const needed = xpNeededForNext(level);
    if (remainingXP < needed) break;
    remainingXP -= needed;
    level += 1;
  }
  return level;
};

type ClaimOutcome =
  | { ok: true; alreadyClaimed: boolean; petKey: number; level10KeyClaimedAt: string | null }
  | { ok: false; status: number; error: string };

router.post('/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const petIdRaw = (req.body as any)?.petId;

  if (!userId) {
    return res.status(400).json({ success: false, error: 'Missing required parameter: userId' });
  }

  if (typeof petIdRaw !== 'string' || petIdRaw.trim() === '') {
    return res.status(400).json({ success: false, error: 'Invalid petId provided' });
  }

  const petId = petIdRaw.trim();

  try {
    const userRef = db.collection('users').doc(userId);
    const friendshipRef = userRef.collection('petFriendships').doc(petId);

    const outcome = await db.runTransaction<ClaimOutcome>(async (tx) => {
      const [userSnap, friendshipSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(friendshipRef),
      ]);

      if (!userSnap.exists) {
        return { ok: false, status: 404, error: 'User not found' };
      }

      if (!friendshipSnap.exists) {
        return { ok: false, status: 404, error: 'Pet friendship not found' };
      }

      const friendshipData = friendshipSnap.data() ?? {};
      const totalXP = toNumber((friendshipData as any).totalXP, 0);
      const level = computeFriendshipLevel(totalXP, PET_FRIENDSHIP_MAX_LEVEL);

      if (level < PET_FRIENDSHIP_MAX_LEVEL) {
        return {
          ok: false,
          status: 400,
          error: 'Friendship level is not high enough to claim this reward',
        };
      }

      const claimedAtRaw = (friendshipData as any).level10KeyClaimedAt as unknown;
      const claimedAtIso =
        claimedAtRaw && typeof (claimedAtRaw as any)?.toDate === 'function'
          ? ((claimedAtRaw as admin.firestore.Timestamp).toDate().toISOString() ?? null)
          : typeof claimedAtRaw === 'string'
            ? claimedAtRaw
            : null;

      const userData = userSnap.data() ?? {};
      const currentPetKey = toNumber((userData as any).petKey, 1);

      if (claimedAtIso) {
        return {
          ok: true,
          alreadyClaimed: true,
          petKey: currentPetKey,
          level10KeyClaimedAt: claimedAtIso,
        };
      }

      const nextPetKey = currentPetKey + 1;
      const claimStamp = admin.firestore.Timestamp.now();
      const claimIso = claimStamp.toDate().toISOString();

      tx.set(userRef, { petKey: nextPetKey }, { merge: true });
      tx.set(friendshipRef, { level10KeyClaimedAt: claimStamp }, { merge: true });

      return {
        ok: true,
        alreadyClaimed: false,
        petKey: nextPetKey,
        level10KeyClaimedAt: claimIso,
      };
    });

    if (!outcome.ok) {
      return res.status(outcome.status).json({ success: false, error: outcome.error });
    }

    return res.status(200).json({
      success: true,
      message: outcome.alreadyClaimed ? 'Pet key already claimed' : 'Pet key claimed successfully',
      data: {
        petKey: outcome.petKey,
        level10KeyClaimedAt: outcome.level10KeyClaimedAt,
      },
    });
  } catch (error) {
    console.error('❌ Error claiming pet key:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to claim pet key',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

