export type StoreCategory = 'Pet' | 'Hat' | 'Collar' | 'Gadget';

export interface StoreCatalogEntry {
  id: string;
  name: string;
  category: StoreCategory;
  priceCoins: number;
  imageKey: string;
  description: string;
}

export const storeCatalog: StoreCatalogEntry[] = [
  // Pets
  {
    id: 'pet_smurf',
    name: 'Smurf',
    category: 'Pet',
    priceCoins: 360,
    imageKey: 'smurf',
    description: 'A bright blue buddy who cheers when you keep momentum.',
  },
  {
    id: 'pet_chedrick',
    name: 'Chedrick',
    category: 'Pet',
    priceCoins: 360,
    imageKey: 'chedrick',
    description: 'A laid-back friend who reminds you to pace your focus.',
  },
  {
    id: 'pet_pebbles',
    name: 'Pebbles',
    category: 'Pet',
    priceCoins: 420,
    imageKey: 'pebbles',
    description: 'Collects little wins and stacks them into big progress.',
  },
  {
    id: 'pet_gooner',
    name: 'Gooner',
    category: 'Pet',
    priceCoins: 480,
    imageKey: 'gooner',
    description: 'Hypes you up before deadlines and celebrates the finish.',
  },

  // Hats
  {
    id: 'hat_sunrise_cap',
    name: 'Sunrise Cap',
    category: 'Hat',
    priceCoins: 240,
    imageKey: 'hat_sunrise_cap',
    description: 'Soft brim, warm tones—perfect for morning focus sprints.',
  },
  {
    id: 'hat_mellow_beret',
    name: 'Mellow Beret',
    category: 'Hat',
    priceCoins: 260,
    imageKey: 'hat_mellow_beret',
    description: 'Adds calm confidence and a touch of creative flair.',
  },
  {
    id: 'hat_starlight_visor',
    name: 'Starlight Visor',
    category: 'Hat',
    priceCoins: 280,
    imageKey: 'hat_starlight_visor',
    description: 'Keeps distractions shaded while your ideas shine.',
  },
  {
    id: 'hat_rally_band',
    name: 'Rally Band',
    category: 'Hat',
    priceCoins: 220,
    imageKey: 'hat_rally_band',
    description: 'Lightweight band that says “let’s get this done.”',
  },

  // Collars
  {
    id: 'collar_bluebell',
    name: 'Bluebell Collar',
    category: 'Collar',
    priceCoins: 200,
    imageKey: 'collar_bluebell',
    description: 'Cool-toned collar that hums with focus energy.',
  },
  {
    id: 'collar_sunbeam',
    name: 'Sunbeam Collar',
    category: 'Collar',
    priceCoins: 200,
    imageKey: 'collar_sunbeam',
    description: 'Bright accent that sparks motivation on tough days.',
  },
  {
    id: 'collar_cinder',
    name: 'Cinder Collar',
    category: 'Collar',
    priceCoins: 220,
    imageKey: 'collar_cinder',
    description: 'Sleek charcoal band for a serious, heads-down mood.',
  },
  {
    id: 'collar_meadow',
    name: 'Meadow Collar',
    category: 'Collar',
    priceCoins: 220,
    imageKey: 'collar_meadow',
    description: 'Soft greens that keep you grounded and steady.',
  },

  // Gadgets
  {
    id: 'gadget_focus_beacon',
    name: 'Focus Beacon',
    category: 'Gadget',
    priceCoins: 320,
    imageKey: 'gadget_focus_beacon',
    description: 'Glows gently when you’re in the zone to deter interruptions.',
  },
  {
    id: 'gadget_calm_aura',
    name: 'Calm Aura Patch',
    category: 'Gadget',
    priceCoins: 320,
    imageKey: 'gadget_calm_aura',
    description: 'Emits a soothing pulse to keep your sessions relaxed.',
  },
];

export const storeCatalogById = storeCatalog.reduce<
  Record<string, StoreCatalogEntry>
>((acc, item) => {
  acc[item.id] = item;
  return acc;
}, {});

export default storeCatalog;
