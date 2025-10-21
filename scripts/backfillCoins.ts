import { db } from "../src/firebase";

const DEFAULT_COINS = 100;

const backfillCoins = async () => {
  console.log("🔄 Backfilling coins for users...");

  const snapshot = await db.collection("users").get();
  if (snapshot.empty) {
    console.log("No users found.");
    return;
  }

  const batch = db.batch();
  let updatedCount = 0;

  snapshot.forEach((doc) => {
    const data = doc.data();
    if (typeof data?.coins !== "number") {
      batch.update(doc.ref, { coins: DEFAULT_COINS });
      updatedCount += 1;
    }
  });

  if (updatedCount === 0) {
    console.log("✅ All users already have coins set. No updates needed.");
    return;
  }

  await batch.commit();
  console.log(`✅ Coins backfilled for ${updatedCount} user(s).`);
};

backfillCoins()
  .catch((error) => {
    console.error("❌ Error backfilling coins:", error);
  })
  .finally(() => {
    process.exit(0);
  });

