import type { PetCatalogEntry } from './petCatalog';

export type LegendarySpecies =
  | 'dragon'
  | 'phoenix'
  | 'griffin'
  | 'unicorn'
  | 'kraken'
  | 'kitsune'
  | 'sphinx'
  | 'pegasus'
  | 'leviathan'
  | 'wyvern';

export const petCatalogLegendary: Array<Omit<PetCatalogEntry, 'species' | 'rarity' | 'priceCoins'> & {
  species: LegendarySpecies;
  rarity: 'legendary';
  priceCoins: 2500;
}> = [
  {
    id: 'pet_aurorion',
    name: 'Aurorion',
    species: 'dragon',
    rarity: 'legendary',
    priceCoins: 2500,
    imageKey: 'aurorion',
    description: 'A cosmic dragon whose scales shimmer with every milestone you conquer.',
  },
  {
    id: 'pet_solflare',
    name: 'Solflare',
    species: 'phoenix',
    rarity: 'legendary',
    priceCoins: 2500,
    imageKey: 'solflare',
    description: 'This reborn phoenix ignites renewed motivation with every focused session.',
  },
  {
    id: 'pet_starlance',
    name: 'Starlance',
    species: 'griffin',
    rarity: 'legendary',
    priceCoins: 2500,
    imageKey: 'starlance',
    description: 'A regal griffin who guards your goals and soars when you stay on track.',
  },
  {
    id: 'pet_luminelle',
    name: 'Luminelle',
    species: 'unicorn',
    rarity: 'legendary',
    priceCoins: 2500,
    imageKey: 'luminelle',
    description: 'A radiant unicorn whose aura keeps distractions at bay.',
  },
  {
    id: 'pet_tidalwyrm',
    name: 'Tidalwyrm',
    species: 'kraken',
    rarity: 'legendary',
    priceCoins: 2500,
    imageKey: 'tidalwyrm',
    description: 'A deep-sea guardian that summons waves of focus to carry you forward.',
  },
  {
    id: 'pet_embertail',
    name: 'Embertail',
    species: 'kitsune',
    rarity: 'legendary',
    priceCoins: 2500,
    imageKey: 'embertail',
    description: 'A nine-tailed fox spirit that sparks creativity with each of its flames.',
  },
  {
    id: 'pet_oraclesphinx',
    name: 'Oracle Sphinx',
    species: 'sphinx',
    rarity: 'legendary',
    priceCoins: 2500,
    imageKey: 'oraclesphinx',
    description: 'An enigmatic sphinx who whispers riddles that sharpen your focus.',
  },
  {
    id: 'pet_celestia',
    name: 'Celestia',
    species: 'pegasus',
    rarity: 'legendary',
    priceCoins: 2500,
    imageKey: 'celestia',
    description: 'This winged steed lifts your momentum, galloping toward streaks of success.',
  },
  {
    id: 'pet_maelstrom',
    name: 'Maelstrom',
    species: 'leviathan',
    rarity: 'legendary',
    priceCoins: 2500,
    imageKey: 'maelstrom',
    description: 'A legendary leviathan whose tidal power keeps your daily goals in motion.',
  },
  {
    id: 'pet_stormwing',
    name: 'Stormwing',
    species: 'wyvern',
    rarity: 'legendary',
    priceCoins: 2500,
    imageKey: 'stormwing',
    description: 'A tempestuous wyvern unleashing surges of energy through every focus session.',
  },
];

export default petCatalogLegendary;
