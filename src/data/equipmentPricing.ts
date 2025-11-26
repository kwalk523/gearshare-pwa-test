/**
 * GearShare Equipment Pricing Database
 * Based on market research and competitive analysis for 2025
 * Used for pricing suggestions, insurance calculations, and deposit requirements
 */

export interface PriceRange {
  min: number;
  max: number;
}

export interface EquipmentPricing {
  id: string;
  model: string;
  category: 'cameras' | 'action-cameras' | 'microphones' | 'audio' | 'lighting';
  purchasePrice: number;
  dailyRate: PriceRange;
  pricing: {
    '1-day': PriceRange;
    '3-day': PriceRange;
    '7-day': PriceRange;
    '14-day': PriceRange;
  };
  insurance: {
    '1-day': number;
    '3-day': number;
    '7-day': number;
    '14-day': number;
  };
  depositAmount: number;
  keywords: string[]; // For model detection
}

export interface InsuranceRates {
  '1-day': number;   // 2.0%
  '3-day': number;   // 2.5%
  '7-day': number;   // 3.0%
  '14-day': number;  // 3.5%
}

export const INSURANCE_RATES: InsuranceRates = {
  '1-day': 0.02,
  '3-day': 0.025,
  '7-day': 0.03,
  '14-day': 0.035
};

export const DURATION_DISCOUNTS = {
  '1-day': 0,     // No discount
  '3-day': 0.20,  // 20% off total
  '7-day': 0.40,  // 40% off total
  '14-day': 0.60  // 60% off total
};

export const EQUIPMENT_PRICING: EquipmentPricing[] = [
  // Cameras
  {
    id: 'canon-eos-r6',
    model: 'Canon EOS R6',
    category: 'cameras',
    purchasePrice: 1500,
    dailyRate: { min: 45, max: 90 },
    pricing: {
      '1-day': { min: 45, max: 90 },
      '3-day': { min: 108, max: 216 },
      '7-day': { min: 189, max: 378 },
      '14-day': { min: 252, max: 504 }
    },
    insurance: {
      '1-day': 30,
      '3-day': 38,
      '7-day': 45,
      '14-day': 53
    },
    depositAmount: 750,
    keywords: ['canon', 'eos', 'r6', 'canon r6', 'eos r6']
  },
  {
    id: 'nikon-z6-ii',
    model: 'Nikon Z6 II',
    category: 'cameras',
    purchasePrice: 1300,
    dailyRate: { min: 39, max: 78 },
    pricing: {
      '1-day': { min: 39, max: 78 },
      '3-day': { min: 94, max: 187 },
      '7-day': { min: 164, max: 328 },
      '14-day': { min: 218, max: 437 }
    },
    insurance: {
      '1-day': 26,
      '3-day': 32,
      '7-day': 39,
      '14-day': 46
    },
    depositAmount: 650,
    keywords: ['nikon', 'z6', 'z6ii', 'z6 ii', 'nikon z6']
  },
  {
    id: 'sony-a7-iii',
    model: 'Sony A7 III',
    category: 'cameras',
    purchasePrice: 1200,
    dailyRate: { min: 36, max: 72 },
    pricing: {
      '1-day': { min: 36, max: 72 },
      '3-day': { min: 86, max: 173 },
      '7-day': { min: 151, max: 302 },
      '14-day': { min: 202, max: 403 }
    },
    insurance: {
      '1-day': 24,
      '3-day': 30,
      '7-day': 36,
      '14-day': 42
    },
    depositAmount: 600,
    keywords: ['sony', 'a7', 'a7iii', 'a7 iii', 'alpha 7', 'sony a7']
  },
  {
    id: 'fujifilm-x-t4',
    model: 'Fujifilm X-T4',
    category: 'cameras',
    purchasePrice: 900,
    dailyRate: { min: 27, max: 54 },
    pricing: {
      '1-day': { min: 27, max: 54 },
      '3-day': { min: 65, max: 130 },
      '7-day': { min: 113, max: 227 },
      '14-day': { min: 151, max: 302 }
    },
    insurance: {
      '1-day': 18,
      '3-day': 22,
      '7-day': 27,
      '14-day': 32
    },
    depositAmount: 450,
    keywords: ['fujifilm', 'fuji', 'xt4', 'x-t4', 'x t4']
  },

  // Action Cameras
  {
    id: 'gopro-hero11-black',
    model: 'GoPro Hero11 Black',
    category: 'action-cameras',
    purchasePrice: 250,
    dailyRate: { min: 8, max: 15 },
    pricing: {
      '1-day': { min: 8, max: 15 },
      '3-day': { min: 19, max: 36 },
      '7-day': { min: 34, max: 63 },
      '14-day': { min: 45, max: 84 }
    },
    insurance: {
      '1-day': 5,
      '3-day': 6,
      '7-day': 8,
      '14-day': 9
    },
    depositAmount: 125,
    keywords: ['gopro', 'hero11', 'hero 11', 'go pro', 'action camera']
  },
  {
    id: 'gopro-hero12-black',
    model: 'GoPro Hero12 Black',
    category: 'action-cameras',
    purchasePrice: 300,
    dailyRate: { min: 9, max: 18 },
    pricing: {
      '1-day': { min: 9, max: 18 },
      '3-day': { min: 22, max: 43 },
      '7-day': { min: 38, max: 76 },
      '14-day': { min: 50, max: 101 }
    },
    insurance: {
      '1-day': 6,
      '3-day': 8,
      '7-day': 9,
      '14-day': 11
    },
    depositAmount: 150,
    keywords: ['gopro', 'hero12', 'hero 12', 'go pro']
  },
  {
    id: 'gopro-hero13-black',
    model: 'GoPro Hero13 Black',
    category: 'action-cameras',
    purchasePrice: 330,
    dailyRate: { min: 10, max: 20 },
    pricing: {
      '1-day': { min: 10, max: 20 },
      '3-day': { min: 24, max: 48 },
      '7-day': { min: 42, max: 84 },
      '14-day': { min: 56, max: 112 }
    },
    insurance: {
      '1-day': 7,
      '3-day': 8,
      '7-day': 10,
      '14-day': 12
    },
    depositAmount: 165,
    keywords: ['gopro', 'hero13', 'hero 13', 'go pro']
  },
  {
    id: 'insta360-x3',
    model: 'Insta360 X3',
    category: 'action-cameras',
    purchasePrice: 350,
    dailyRate: { min: 10, max: 21 },
    pricing: {
      '1-day': { min: 10, max: 21 },
      '3-day': { min: 24, max: 50 },
      '7-day': { min: 42, max: 88 },
      '14-day': { min: 56, max: 118 }
    },
    insurance: {
      '1-day': 7,
      '3-day': 9,
      '7-day': 10,
      '14-day': 12
    },
    depositAmount: 175,
    keywords: ['insta360', 'insta 360', 'x3', '360 camera']
  },
  {
    id: 'insta360-x4',
    model: 'Insta360 X4',
    category: 'action-cameras',
    purchasePrice: 440,
    dailyRate: { min: 13, max: 26 },
    pricing: {
      '1-day': { min: 13, max: 26 },
      '3-day': { min: 31, max: 62 },
      '7-day': { min: 55, max: 109 },
      '14-day': { min: 73, max: 146 }
    },
    insurance: {
      '1-day': 9,
      '3-day': 11,
      '7-day': 13,
      '14-day': 15
    },
    depositAmount: 220,
    keywords: ['insta360', 'insta 360', 'x4', '360 camera']
  },
  {
    id: 'insta360-x5',
    model: 'Insta360 X5',
    category: 'action-cameras',
    purchasePrice: 715,
    dailyRate: { min: 21, max: 43 },
    pricing: {
      '1-day': { min: 21, max: 43 },
      '3-day': { min: 50, max: 103 },
      '7-day': { min: 88, max: 181 },
      '14-day': { min: 118, max: 241 }
    },
    insurance: {
      '1-day': 14,
      '3-day': 18,
      '7-day': 21,
      '14-day': 25
    },
    depositAmount: 358,
    keywords: ['insta360', 'insta 360', 'x5', '360 camera']
  },

  // Microphones
  {
    id: 'shure-sm7db',
    model: 'Shure SM7dB',
    category: 'microphones',
    purchasePrice: 500,
    dailyRate: { min: 15, max: 30 },
    pricing: {
      '1-day': { min: 15, max: 30 },
      '3-day': { min: 36, max: 72 },
      '7-day': { min: 63, max: 126 },
      '14-day': { min: 84, max: 168 }
    },
    insurance: {
      '1-day': 10,
      '3-day': 12,
      '7-day': 15,
      '14-day': 18
    },
    depositAmount: 250,
    keywords: ['shure', 'sm7db', 'sm7', 'microphone', 'mic']
  },
  {
    id: 'blue-yeti-nano',
    model: 'Blue Yeti Nano',
    category: 'microphones',
    purchasePrice: 100,
    dailyRate: { min: 3, max: 6 },
    pricing: {
      '1-day': { min: 3, max: 6 },
      '3-day': { min: 7, max: 14 },
      '7-day': { min: 13, max: 25 },
      '14-day': { min: 17, max: 34 }
    },
    insurance: {
      '1-day': 2,
      '3-day': 2,
      '7-day': 3,
      '14-day': 4
    },
    depositAmount: 50,
    keywords: ['blue', 'yeti', 'nano', 'usb microphone', 'microphone']
  },
  {
    id: 'rode-wireless-go-gen3',
    model: 'Rode Wireless Go Gen 3',
    category: 'microphones',
    purchasePrice: 300,
    dailyRate: { min: 9, max: 18 },
    pricing: {
      '1-day': { min: 9, max: 18 },
      '3-day': { min: 22, max: 43 },
      '7-day': { min: 38, max: 76 },
      '14-day': { min: 50, max: 101 }
    },
    insurance: {
      '1-day': 6,
      '3-day': 8,
      '7-day': 9,
      '14-day': 11
    },
    depositAmount: 150,
    keywords: ['rode', 'wireless', 'go', 'gen3', 'gen 3', 'lavalier', 'lav mic']
  },

  // Audio Equipment
  {
    id: 'focusrite-scarlett-2i2',
    model: 'Focusrite Scarlett 2i2 Studio Bundle',
    category: 'audio',
    purchasePrice: 250,
    dailyRate: { min: 8, max: 15 },
    pricing: {
      '1-day': { min: 8, max: 15 },
      '3-day': { min: 19, max: 36 },
      '7-day': { min: 34, max: 63 },
      '14-day': { min: 45, max: 84 }
    },
    insurance: {
      '1-day': 5,
      '3-day': 6,
      '7-day': 8,
      '14-day': 9
    },
    depositAmount: 125,
    keywords: ['focusrite', 'scarlett', '2i2', 'audio interface', 'studio bundle']
  },
  {
    id: 'zoom-h5-recorder',
    model: 'Zoom H5 Handy Recorder',
    category: 'audio',
    purchasePrice: 300,
    dailyRate: { min: 9, max: 18 },
    pricing: {
      '1-day': { min: 9, max: 18 },
      '3-day': { min: 22, max: 43 },
      '7-day': { min: 38, max: 76 },
      '14-day': { min: 50, max: 101 }
    },
    insurance: {
      '1-day': 6,
      '3-day': 8,
      '7-day': 9,
      '14-day': 11
    },
    depositAmount: 150,
    keywords: ['zoom', 'h5', 'handy', 'recorder', 'audio recorder', 'field recorder']
  },

  // Lighting Equipment
  {
    id: 'hobolite-mini-20w',
    model: 'Hobolite Mini 20W LED',
    category: 'lighting',
    purchasePrice: 299,
    dailyRate: { min: 9, max: 18 },
    pricing: {
      '1-day': { min: 9, max: 18 },
      '3-day': { min: 22, max: 43 },
      '7-day': { min: 38, max: 76 },
      '14-day': { min: 50, max: 101 }
    },
    insurance: {
      '1-day': 6,
      '3-day': 7,
      '7-day': 9,
      '14-day': 10
    },
    depositAmount: 150,
    keywords: ['hobolite', 'mini', '20w', 'led', 'light', 'lighting', 'portable light']
  },
  {
    id: 'max-80w-portable-led',
    model: 'Max 80W Portable LED',
    category: 'lighting',
    purchasePrice: 699,
    dailyRate: { min: 21, max: 42 },
    pricing: {
      '1-day': { min: 21, max: 42 },
      '3-day': { min: 50, max: 101 },
      '7-day': { min: 88, max: 176 },
      '14-day': { min: 118, max: 235 }
    },
    insurance: {
      '1-day': 14,
      '3-day': 17,
      '7-day': 21,
      '14-day': 24
    },
    depositAmount: 350,
    keywords: ['max', '80w', 'portable', 'led', 'light', 'lighting', 'studio light']
  }
];

export const CATEGORIES = [
  { value: 'cameras', label: 'Cameras' },
  { value: 'action-cameras', label: 'Action Cameras' },
  { value: 'microphones', label: 'Microphones' },
  { value: 'audio', label: 'Audio Equipment' },
  { value: 'lighting', label: 'Lighting Equipment' }
] as const;