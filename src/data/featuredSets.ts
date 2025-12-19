import featuredSetsData from './featuredSets.json';

export interface FeaturedSet {
  id: string;
  title: string;
  description: string;
  artKey: string;
  itemIds: string[];
}

export const featuredSets: FeaturedSet[] = featuredSetsData;
