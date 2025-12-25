import admin from 'firebase-admin';

export async function ensurePetFriendshipDoc(
  userRef: FirebaseFirestore.DocumentReference,
  petId: string,
  createdAt?: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp
): Promise<void> {
  const friendshipRef = userRef.collection('petFriendships').doc(petId);
  const snap = await friendshipRef.get();

  const createdAtValue = createdAt ?? admin.firestore.FieldValue.serverTimestamp();

  if (snap.exists) {
    const data = snap.data();
    if (data?.createdAt == null) {
      await friendshipRef.set({ createdAt: createdAtValue }, { merge: true });
    }
    return;
  }

  await friendshipRef.set(
    {
      totalXP: 0,
      totalFocusSeconds: 0,
      createdAt: createdAtValue,
    },
    { merge: true }
  );
}
