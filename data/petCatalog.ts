export type PetSpecies =
  | 'cat'
  | 'dog'
  | 'bird'
  | 'rabbit'
  | 'phoenix'
  | 'griffin'
  | 'dragon'
  | 'unicorn'
  | 'kitsune'
  | 'pegasus'
  | 'leviathan'
  | 'wyvern';
export type PetRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface PetCatalogEntry {
  id: string;
  name: string;
  species: PetSpecies;
  rarity: PetRarity;
  priceCoins: number;
  imageKey: string;
  description: string;
}

export const petCatalog: PetCatalogEntry[] = [
  // Common (6)
  {
    id: 'pet_skye',
    name: 'Skye',
    species: 'cat',
    rarity: 'common',
    priceCoins: 360,
    imageKey: 'skye',
    description:
      'An adventurous feline who keeps you focused with calm encouragement.',
  },
  {
    id: 'pet_lancelot',
    name: 'Lancelot',
    species: 'dog',
    rarity: 'common',
    priceCoins: 360,
    imageKey: 'lancelot',
    description:
      'A loyal pup who celebrates every milestone with boundless energy.',
  },
  {
    id: 'pet_pepper',
    name: 'Pepper',
    species: 'rabbit',
    rarity: 'common',
    priceCoins: 360,
    imageKey: 'pepper',
    description:
      'A sprightly rabbit who nudges you toward steady daily habits.',
  },
  {
    id: 'pet_wren',
    name: 'Wren',
    species: 'bird',
    rarity: 'common',
    priceCoins: 360,
    imageKey: 'wren',
    description:
      'Chirps cheerful reminders to stretch and sip water between tasks.',
  },
  {
    id: 'pet_ember',
    name: 'Ember',
    species: 'cat',
    rarity: 'common',
    priceCoins: 360,
    imageKey: 'ember',
    description:
      'Keeps your keyboard warm and sparks motivation when energy dips.',
  },
  {
    id: 'pet_rufus',
    name: 'Rufus',
    species: 'dog',
    rarity: 'common',
    priceCoins: 360,
    imageKey: 'rufus',
    description:
      'A dependable companion who loves celebrating a completed checklist.',
  },

  // Rare (4)
  {
    id: 'pet_harper',
    name: 'Harper',
    species: 'bird',
    rarity: 'rare',
    priceCoins: 720,
    imageKey: 'harper',
    description:
      'Glides overhead and keeps distractions grounded while you focus.',
  },
  {
    id: 'pet_willow',
    name: 'Willow',
    species: 'rabbit',
    rarity: 'rare',
    priceCoins: 720,
    imageKey: 'willow',
    description:
      'Finds the calmest nook in the room and invites you to settle in.',
  },
  {
    id: 'pet_talon',
    name: 'Talon',
    species: 'bird',
    rarity: 'rare',
    priceCoins: 720,
    imageKey: 'talon',
    description:
      'Cuts through procrastination with a single swift sweep of his wings.',
  },
  {
    id: 'pet_onyx',
    name: 'Onyx',
    species: 'dog',
    rarity: 'rare',
    priceCoins: 720,
    imageKey: 'onyx',
    description:
      'Stands guard over your schedule and howls in victory when you ship.',
  },

  // Epic (2)
  {
    id: 'pet_nova',
    name: 'Nova',
    species: 'cat',
    rarity: 'epic',
    priceCoins: 1440,
    imageKey: 'nova',
    description:
      'Charts constellations of goals and purrs when you reach for the stars.',
  },
  {
    id: 'pet_sylvie',
    name: 'Sylvie',
    species: 'rabbit',
    rarity: 'epic',
    priceCoins: 1440,
    imageKey: 'sylvie',
    description:
      'Weaves threads of focus into a tapestry of deep work sessions.',
  },

  // Legendary (8)
  {
    id: 'pet_aurora',
    name: 'Aurora',
    species: 'phoenix',
    rarity: 'legendary',
    priceCoins: 3240,
    imageKey: 'aurora',
    description:
      'Rises blazing from your breaks and fills every session with renewal.',
  },
  {
    id: 'pet_zephyr',
    name: 'Zephyr',
    species: 'griffin',
    rarity: 'legendary',
    priceCoins: 3240,
    imageKey: 'zephyr',
    description:
      'Soars between tasks ensuring nothing interrupts your momentum.',
  },
  {
    id: 'pet_mistral',
    name: 'Mistral',
    species: 'dragon',
    rarity: 'legendary',
    priceCoins: 3240,
    imageKey: 'mistral',
    description:
      'Breathes fire on procrastination until only focused flow remains.',
  },
  {
    id: 'pet_lumina',
    name: 'Lumina',
    species: 'unicorn',
    rarity: 'legendary',
    priceCoins: 3240,
    imageKey: 'lumina',
    description:
      'Illuminates the path to your most ambitious dreams with a radiant horn.',
  },
  {
    id: 'pet_kitsune',
    name: 'Kitsune',
    species: 'kitsune',
    rarity: 'legendary',
    priceCoins: 3240,
    imageKey: 'kitsune',
    description:
      'Shifts shape to match your energy and keeps curiosity blazing.',
  },
  {
    id: 'pet_stormwing',
    name: 'Stormwing',
    species: 'pegasus',
    rarity: 'legendary',
    priceCoins: 3240,
    imageKey: 'stormwing',
    description:
      'Gallops across the clouds, carrying your ambitions beyond the horizon.',
  },
  {
    id: 'pet_tidebreaker',
    name: 'Tidebreaker',
    species: 'leviathan',
    rarity: 'legendary',
    priceCoins: 3240,
    imageKey: 'tidebreaker',
    description:
      'Rises from quiet depths to wash away distractions in a single wave.',
  },
  {
    id: 'pet_nightshade',
    name: 'Nightshade',
    species: 'wyvern',
    rarity: 'legendary',
    priceCoins: 3240,
    imageKey: 'nightshade',
    description:
      'Glides through twilight hours whispering secrets of relentless focus.',
  },
];

export const petCatalogById = petCatalog.reduce<Record<string, PetCatalogEntry>>(
  (acc, pet) => {
    acc[pet.id] = pet;
    return acc;
  },
  {},
);

export default petCatalog;
