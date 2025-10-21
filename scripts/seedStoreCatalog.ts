// scripts/seedStoreCatalog.ts
import { db } from '../src/firebase';
import { petCatalog } from '../data/petCatalog';
import { petCatalogLegendary } from '../data/petCatalogLegendary';

async function seedStoreCatalog() {
  console.log(`🛍️ Seeding ${petCatalog.length} pets…`);

  const batch = db.batch();

  petCatalog.forEach((pet) => {
    const docRef = db.collection('store').doc('catalog').collection('pets').doc(pet.id);
    batch.set(docRef, {
      ...pet,
      updatedAt: new Date().toISOString(),
    });
  });

  petCatalogLegendary.forEach((pet) => {
    const docRef = db
      .collection('store')
      .doc('catalog')
      .collection('legendaryPets')
      .doc(pet.id);
    batch.set(docRef, {
      ...pet,
      rarity: 'legendary',
      updatedAt: new Date().toISOString(),
    });
  });

  await batch.commit();
  console.log('✅ Store catalog seeded successfully');
  console.log(`🗡️ Legendary catalog seeded with ${petCatalogLegendary.length} pets`);
}

seedStoreCatalog()
  .catch((err) => {
    console.error('❌ Failed to seed catalog', err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
