import { calculateLevel } from './levelUtils';

/**
 * Pet unlock configuration: maps user level to pet IDs that unlock at that level
 */
export const PET_UNLOCKS_BY_LEVEL: Record<number, string[]> = {
  1: ['pet_smurf'],      // Level 1: Smurf
  3: ['pet_pebbles'],    // Level 3: Pebbles
  5: ['pet_chedrick'],   // Level 5: Chedrick
  7: ['pet_gooner'],     // Level 7: Gooner
  9: ['pet_kitty'],      // Level 9: Kitty
};

/**
 * Get all pets that should be unlocked up to a given level
 */
export function getPetsUnlockedUpToLevel(level: number): string[] {
  const unlockedPets: string[] = [];
  
  for (let lvl = 1; lvl <= level; lvl++) {
    const petsAtLevel = PET_UNLOCKS_BY_LEVEL[lvl];
    if (petsAtLevel) {
      unlockedPets.push(...petsAtLevel);
    }
  }
  
  return unlockedPets;
}

