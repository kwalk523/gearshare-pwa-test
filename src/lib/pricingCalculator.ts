/**
 * Pricing Calculator Utilities for GearShare Platform
 * Handles rental pricing, insurance, deposits, and platform fees
 */

import { EQUIPMENT_PRICING, INSURANCE_RATES, DURATION_DISCOUNTS, type EquipmentPricing, type PriceRange } from '../data/equipmentPricing';

export type RentalDuration = '1-day' | '3-day' | '7-day' | '14-day';

export interface PricingCalculation {
  basePrice: PriceRange;
  discountedPrice: PriceRange;
  insuranceCost: number;
  depositAmount: number;
  platformFee: PriceRange;
  totalCost: PriceRange; // Including insurance if selected
  savings: PriceRange; // Amount saved with bulk discount
}

export interface RentalPricingOptions {
  equipmentId?: string;
  purchasePrice?: number;
  duration: RentalDuration;
  includeInsurance: boolean;
  customDailyRate?: PriceRange;
}

/**
 * Calculate comprehensive pricing for a rental
 */
export function calculateRentalPricing(options: RentalPricingOptions): PricingCalculation {
  const { equipmentId, purchasePrice, duration, includeInsurance, customDailyRate } = options;
  
  let equipment: EquipmentPricing | null = null;
  if (equipmentId) {
    equipment = EQUIPMENT_PRICING.find(e => e.id === equipmentId) || null;
  }
  
  // Get base pricing
  let basePrice: PriceRange;
  let insuranceCost = 0;
  let depositAmount = 0;
  
  if (equipment) {
    basePrice = equipment.pricing[duration];
    insuranceCost = equipment.insurance[duration];
    depositAmount = equipment.depositAmount;
  } else if (customDailyRate && purchasePrice) {
    // Calculate from custom inputs
    const days = getDaysFromDuration(duration);
    basePrice = {
      min: customDailyRate.min * days,
      max: customDailyRate.max * days
    };
    insuranceCost = Math.round(purchasePrice * INSURANCE_RATES[duration]);
    depositAmount = Math.round(purchasePrice * 0.5); // 50% deposit
  } else {
    throw new Error('Either equipmentId or both purchasePrice and customDailyRate must be provided');
  }
  
  // Apply duration discount
  const discount = DURATION_DISCOUNTS[duration];
  const discountedPrice: PriceRange = {
    min: Math.round(basePrice.min * (1 - discount)),
    max: Math.round(basePrice.max * (1 - discount))
  };
  
  // Calculate savings
  const savings: PriceRange = {
    min: basePrice.min - discountedPrice.min,
    max: basePrice.max - discountedPrice.max
  };
  
  // Calculate platform fee (assume 10-15% of rental price)
  const platformFee: PriceRange = {
    min: Math.round(discountedPrice.min * 0.1),
    max: Math.round(discountedPrice.max * 0.15)
  };
  
  // Calculate total cost
  const insuranceAmount = includeInsurance ? insuranceCost : 0;
  const totalCost: PriceRange = {
    min: discountedPrice.min + platformFee.min + insuranceAmount,
    max: discountedPrice.max + platformFee.max + insuranceAmount
  };
  
  return {
    basePrice,
    discountedPrice,
    insuranceCost,
    depositAmount: includeInsurance ? 0 : depositAmount, // No deposit if insured
    platformFee,
    totalCost,
    savings
  };
}

/**
 * Find equipment pricing by model detection
 */
export function findEquipmentByModel(title: string, description?: string): EquipmentPricing | null {
  const searchText = `${title} ${description || ''}`.toLowerCase();
  
  return EQUIPMENT_PRICING.find(equipment => {
    return equipment.keywords.some(keyword => 
      searchText.includes(keyword.toLowerCase())
    );
  }) || null;
}

/**
 * Get suggested pricing range for equipment
 */
export function getSuggestedPricing(equipmentId: string, duration: RentalDuration): PriceRange | null {
  const equipment = EQUIPMENT_PRICING.find(e => e.id === equipmentId);
  if (!equipment) return null;
  
  return equipment.pricing[duration];
}

/**
 * Calculate insurance cost for custom equipment
 */
export function calculateInsurance(purchasePrice: number, duration: RentalDuration): number {
  return Math.round(purchasePrice * INSURANCE_RATES[duration]);
}

/**
 * Calculate deposit amount for custom equipment
 */
export function calculateDeposit(purchasePrice: number): number {
  return Math.round(purchasePrice * 0.5); // 50% of purchase price
}

/**
 * Validate deposit amount against equipment value
 */
export function validateDeposit(depositAmount: number, equipmentId?: string, purchasePrice?: number): {
  isValid: boolean;
  suggestion?: number;
  reason?: string;
} {
  let expectedDeposit = 0;
  
  if (equipmentId) {
    const equipment = EQUIPMENT_PRICING.find(e => e.id === equipmentId);
    if (equipment) {
      expectedDeposit = equipment.depositAmount;
    }
  } else if (purchasePrice) {
    expectedDeposit = Math.round(purchasePrice * 0.5); // 50% of purchase price
  }
  
  if (expectedDeposit > 0) {
    // Allow 20% variance in deposit amounts
    if (depositAmount < expectedDeposit * 0.8) {
      return {
        isValid: false,
        suggestion: expectedDeposit,
        reason: 'Deposit is lower than recommended for this equipment value'
      };
    }
    if (depositAmount > expectedDeposit * 1.5) {
      return {
        isValid: false,
        suggestion: expectedDeposit,
        reason: 'Deposit is higher than necessary - may discourage renters'
      };
    }
  }
  
  return { isValid: true };
}

/**
 * Adjust pricing based on gear condition
 */
export function adjustPricingForCondition(basePrice: PriceRange, condition: 'excellent' | 'good' | 'fair'): PriceRange {
  const multipliers = {
    excellent: 1.0,   // Full price
    good: 0.85,       // 15% reduction
    fair: 0.7         // 30% reduction
  };
  
  const multiplier = multipliers[condition];
  
  return {
    min: Math.round(basePrice.min * multiplier),
    max: Math.round(basePrice.max * multiplier)
  };
}

/**
 * Get condition-adjusted equipment pricing
 */
export function getConditionAdjustedPricing(equipmentId: string, condition: 'excellent' | 'good' | 'fair'): {
  dailyRate: PriceRange;
  depositAmount: number;
} | null {
  const equipment = EQUIPMENT_PRICING.find(e => e.id === equipmentId);
  if (!equipment) return null;
  
  const adjustedDailyRate = adjustPricingForCondition(equipment.dailyRate, condition);
  
  // Deposit stays the same regardless of condition (based on replacement value)
  return {
    dailyRate: adjustedDailyRate,
    depositAmount: equipment.depositAmount
  };
}
/**
 * Validate if pricing is within reasonable range
 */
export function validatePricing(dailyRate: number, equipmentId?: string, purchasePrice?: number, condition?: 'excellent' | 'good' | 'fair'): {
  isValid: boolean;
  suggestion?: PriceRange;
  reason?: string;
} {
  if (equipmentId) {
    const equipment = EQUIPMENT_PRICING.find(e => e.id === equipmentId);
    if (equipment) {
      let suggested = equipment.dailyRate;
      
      // Adjust suggestions based on condition
      if (condition && condition !== 'excellent') {
        suggested = adjustPricingForCondition(suggested, condition);
      }
      
      // More strict validation - warn if outside reasonable range
      if (dailyRate < suggested.min * 0.7) {
        return {
          isValid: false,
          suggestion: suggested,
          reason: `Price is below market rate for ${condition || 'this'} condition - consider increasing`
        };
      }
      if (dailyRate > suggested.max * 1.3) {
        return {
          isValid: false,
          suggestion: suggested,
          reason: `Price is above market rate for ${condition || 'this'} condition - may reduce bookings`
        };
      }
      if (dailyRate > suggested.max * 1.1) {
        return {
          isValid: false,
          suggestion: suggested,
          reason: `Price is higher than recommended for ${condition || 'this'} condition - consider lowering`
        };
      }
      if (dailyRate < suggested.min * 0.9) {
        return {
          isValid: false,
          suggestion: suggested,
          reason: `Price is lower than recommended for ${condition || 'this'} condition - you could charge more`
        };
      }
    }
  } else if (purchasePrice) {
    // General validation: 2-6% of purchase price per day
    let minRate = purchasePrice * 0.02;
    let maxRate = purchasePrice * 0.06;
    
    // Adjust for condition if provided
    if (condition && condition !== 'excellent') {
      const multipliers = { excellent: 1.0, good: 0.85, fair: 0.7 };
      const multiplier = multipliers[condition];
      minRate *= multiplier;
      maxRate *= multiplier;
    }
    
    if (dailyRate < minRate) {
      return {
        isValid: false,
        suggestion: { min: Math.round(minRate), max: Math.round(maxRate) },
        reason: `Price may be too low for equipment value in ${condition || 'this'} condition`
      };
    }
    if (dailyRate > maxRate) {
      return {
        isValid: false,
        suggestion: { min: Math.round(minRate), max: Math.round(maxRate) },
        reason: `Price may be too high for equipment value in ${condition || 'this'} condition`
      };
    }
  }
  
  return { isValid: true };
}

/**
 * Get all equipment in a category
 */
export function getEquipmentByCategory(category: string): EquipmentPricing[] {
  return EQUIPMENT_PRICING.filter(e => e.category === category);
}

/**
 * Convert duration string to number of days
 */
export function getDaysFromDuration(duration: RentalDuration): number {
  switch (duration) {
    case '1-day': return 1;
    case '3-day': return 3;
    case '7-day': return 7;
    case '14-day': return 14;
    default: return 1;
  }
}

/**
 * Get duration options with labels and discounts
 */
export function getDurationOptions() {
  return [
    { value: '1-day', label: '1 Day', days: 1, discount: 0 },
    { value: '3-day', label: '3 Days', days: 3, discount: 20 },
    { value: '7-day', label: '7 Days', days: 7, discount: 40 },
    { value: '14-day', label: '14 Days', days: 14, discount: 60 }
  ] as const;
}

/**
 * Format price range as string
 */
export function formatPriceRange(range: PriceRange, prefix = '$'): string {
  if (range.min === range.max) {
    return `${prefix}${range.min}`;
  }
  return `${prefix}${range.min}–${prefix}${range.max}`;
}

/**
 * Format duration for display
 */
export function formatDuration(duration: RentalDuration): string {
  const options = getDurationOptions();
  const option = options.find(o => o.value === duration);
  return option?.label || duration;
}

/**
 * Get recommended equipment based on category and price range
 */
export function getRecommendedEquipment(category: string, maxBudget?: number): EquipmentPricing[] {
  let equipment = getEquipmentByCategory(category);
  
  if (maxBudget) {
    equipment = equipment.filter(e => e.dailyRate.min <= maxBudget);
  }
  
  // Sort by popularity (lower purchase price = more accessible)
  return equipment.sort((a, b) => a.purchasePrice - b.purchasePrice);
}