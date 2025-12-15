import admin from "firebase-admin";
import { calculateLevel } from "./levelUtils";

/**
 * Apply an XP increment to a user and compute old/new level.
 *
 * - Increments totalXP on the user document
 * - Returns { oldLevel, newLevel } so callers can decide what to do with level-ups
 * - Does NOT unlock pets or other rewards (those should be handled by explicit claim flows)
 */
export async function awardXpAndUpdateLevel(
  userRef: FirebaseFirestore.DocumentReference,
  xpAwarded: number
): Promise<{ oldLevel: number; newLevel: number }> {
  if (xpAwarded <= 0) {
    const snap = await userRef.get();
    const currentTotalXP =
      snap.exists && typeof snap.data()?.totalXP === "number"
        ? (snap.data()!.totalXP as number)
        : 0;
    const level = calculateLevel(currentTotalXP);
    return { oldLevel: level, newLevel: level };
  }

  const userDoc = await userRef.get();
  const currentTotalXP =
    userDoc.exists && typeof userDoc.data()?.totalXP === "number"
      ? (userDoc.data()!.totalXP as number)
      : 0;

  const newTotalXP = currentTotalXP + xpAwarded;
  const oldLevel = calculateLevel(currentTotalXP);
  const newLevel = calculateLevel(newTotalXP);

  await userRef.set(
    {
      totalXP: admin.firestore.FieldValue.increment(xpAwarded),
    },
    { merge: true }
  );

  return { oldLevel, newLevel };
}

