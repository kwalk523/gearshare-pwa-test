/**
 * Pricing Guide Component - Helps users set competitive rental prices
 * Shows market rates, duration discounts, and insurance information
 */

import { useState, useMemo } from 'react';
import { Info, TrendingUp, Shield, DollarSign } from 'lucide-react';
import { EQUIPMENT_PRICING, CATEGORIES } from '../data/equipmentPricing';
import { 
  calculateRentalPricing, 
  formatPriceRange, 
  getDurationOptions,
  type RentalDuration 
} from '../lib/pricingCalculator';

interface PricingGuideProps {
  onSelectPricing?: (dailyRate: { min: number; max: number }) => void;
  className?: string;
}

export default function PricingGuide({ onSelectPricing, className = '' }: PricingGuideProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('cameras');
  const [selectedDuration, setSelectedDuration] = useState<RentalDuration>('1-day');
  const [showInsurance, setShowInsurance] = useState(false);

  const categoryEquipment = useMemo(() => {
    return EQUIPMENT_PRICING.filter(e => e.category === selectedCategory);
  }, [selectedCategory]);

  const durationOptions = getDurationOptions();

  return (
    <div className={`bg-surface border border-thematic rounded-xl p-6 ${className}`}>
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp className="w-6 h-6 text-emerald-600" />
        <div>
          <h3 className="text-xl font-semibold">Pricing Guide</h3>
          <p className="text-sm text-muted">Market rates for equipment rental</p>
        </div>
      </div>

      {/* Category Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Equipment Category</label>
        <select 
          value={selectedCategory} 
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full border border-thematic rounded-lg px-3 py-2 bg-elevated focus:ring-2 focus:ring-emerald-500"
        >
          {CATEGORIES.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* Duration Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Rental Duration</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {durationOptions.map(option => (
            <button
              key={option.value}
              onClick={() => setSelectedDuration(option.value)}
              className={`p-3 rounded-lg border transition-colors text-sm ${
                selectedDuration === option.value
                  ? 'border-emerald-600 bg-emerald-600/10 text-emerald-600'
                  : 'border-thematic bg-elevated hover:bg-emerald-600/5'
              }`}
            >
              <div className="font-medium">{option.label}</div>
              {option.discount > 0 && (
                <div className="text-xs text-emerald-600 font-medium">
                  {option.discount}% off
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Insurance Toggle */}
      <div className="mb-6 p-4 bg-elevated rounded-lg border border-thematic">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-500 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Include Insurance Rates</span>
              <button
                onClick={() => setShowInsurance(!showInsurance)}
                className={`px-3 py-1 rounded-md text-sm transition-colors ${
                  showInsurance 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-blue-600/10 text-blue-600 hover:bg-blue-600/20'
                }`}
              >
                {showInsurance ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-sm text-muted">
              Insurance protects against damage and theft. Rates: 2.0-3.5% of equipment value.
            </p>
          </div>
        </div>
      </div>

      {/* Equipment Pricing Table */}
      <div className="space-y-4">
        <h4 className="font-semibold flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          Market Rates - {CATEGORIES.find(c => c.value === selectedCategory)?.label}
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-thematic">
                <th className="text-left py-2 font-medium">Model</th>
                <th className="text-right py-2 font-medium">Value</th>
                <th className="text-right py-2 font-medium">Rental Rate</th>
                {showInsurance && (
                  <th className="text-right py-2 font-medium">Insurance</th>
                )}
                <th className="text-right py-2 font-medium">Deposit</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {categoryEquipment.map((equipment) => {
                const pricing = calculateRentalPricing({
                  equipmentId: equipment.id,
                  duration: selectedDuration,
                  includeInsurance: showInsurance
                });

                return (
                  <tr key={equipment.id} className="border-b border-thematic/50 hover:bg-elevated/50">
                    <td className="py-3">
                      <div className="font-medium">{equipment.model}</div>
                    </td>
                    <td className="text-right py-3 text-muted">
                      ${equipment.purchasePrice}
                    </td>
                    <td className="text-right py-3">
                      <div className="font-medium text-emerald-600">
                        {formatPriceRange(pricing.discountedPrice)}
                      </div>
                      {pricing.savings.min > 0 && (
                        <div className="text-xs text-emerald-600">
                          Save {formatPriceRange(pricing.savings)}
                        </div>
                      )}
                    </td>
                    {showInsurance && (
                      <td className="text-right py-3 text-blue-600">
                        ${pricing.insuranceCost}
                      </td>
                    )}
                    <td className="text-right py-3 text-muted">
                      ${pricing.depositAmount}
                    </td>
                    <td className="py-3">
                      {onSelectPricing && (
                        <button
                          onClick={() => onSelectPricing(equipment.dailyRate)}
                          className="px-3 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 transition-colors"
                        >
                          Use
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pricing Tips */}
      <div className="mt-6 p-4 bg-blue-600/5 border border-blue-600/20 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h5 className="font-medium text-blue-600 mb-2">Pricing Tips</h5>
            <ul className="text-sm text-muted space-y-1">
              <li>• Longer rentals get automatic bulk discounts (up to 60% off)</li>
              <li>• Insurance reduces deposit requirements to $0</li>
              <li>• Price competitively within the suggested range</li>
              <li>• Consider equipment condition when setting rates</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}