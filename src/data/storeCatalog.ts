import catalogData from './storeCatalog.json';

export type StoreCategory = 'Pet' | 'Hat' | 'Collar' | 'Gadget';

export interface StoreCatalogEntry {
  id: string;
  name: string;
  category: StoreCategory;
  priceCoins: number;
  imageKey: string;
  description: string;
  featured?: boolean;
}

// Data is stored in storeCatalog.json - edit that file to update items
export const storeCatalog: StoreCatalogEntry[] = catalogData as StoreCatalogEntry[];

export const storeCatalogById = storeCatalog.reduce<Record<string, StoreCatalogEntry>>(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {}
);

export default storeCatalog;
