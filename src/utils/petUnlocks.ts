import { calculateLevel } from './levelUtils';

/**
 * Pet unlock configuration: maps user level to pet IDs that unlock at that level
 */
export const PET_UNLOCKS_BY_LEVEL: Record<number, string[]> = {
  2: ['pet_smurf'],      // Level 2: Smurf (after tutorial)
  4: ['pet_chedrick'],   // Level 4: Chedrick
  6: ['pet_gooner'],     // Level 6: Gooner
  8: ['pet_pebbles'],    // Level 8: Pebbles
  10: ['pet_kitty'],     // Level 10: Kitty
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

