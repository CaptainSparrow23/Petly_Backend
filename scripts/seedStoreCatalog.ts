// scripts/seedStoreCatalog.ts
import type { firestore } from 'firebase-admin';
import { db } from '../src/firebase';
import { petCatalog } from '../data/petCatalog';

async function seedStoreCatalog() {
  const petsCollection = db.collection('store').doc('catalog').collection('pets');

  console.log('🧹 Clearing existing store catalog…');
  const existingSnapshot = await petsCollection.get();

  if (!existingSnapshot.empty) {
    let deleteBatch = db.batch();
    let opCount = 0;
    const deleteCommits: Promise<firestore.WriteResult[]>[] = [];

    existingSnapshot.forEach((doc) => {
      deleteBatch.delete(doc.ref);
      opCount += 1;

      if (opCount === 450) {
        deleteCommits.push(deleteBatch.commit());
        deleteBatch = db.batch();
        opCount = 0;
      }
    });

    if (opCount > 0) {
      deleteCommits.push(deleteBatch.commit());
    }

    await Promise.all(deleteCommits);
  }
  console.log(`🗑️ Removed ${existingSnapshot.size} existing pets`);

  console.log(`🛍️ Seeding ${petCatalog.length} pets…`);
  let batch = db.batch();
  let counter = 0;
  const seedCommits: Promise<firestore.WriteResult[]>[] = [];

  petCatalog.forEach((pet) => {
    const docRef = petsCollection.doc(pet.id);
    batch.set(docRef, {
      ...pet,
      updatedAt: new Date().toISOString(),
    });
    counter += 1;

    if (counter === 450) {
      seedCommits.push(batch.commit());
      batch = db.batch();
      counter = 0;
    }
  });

  if (counter > 0) {
    seedCommits.push(batch.commit());
  }

  await Promise.all(seedCommits);

  console.log('✅ Store catalog seeded successfully');
}

seedStoreCatalog()
  .catch((err) => {
    console.error('❌ Failed to seed catalog', err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
