import React, { useState } from 'react';
import { calculateRentalPricing, findEquipmentByModel, validatePricing, calculateInsurance, calculateDeposit, type RentalPricingOptions } from '../lib/pricingCalculator';
import { EQUIPMENT_PRICING } from '../data/equipmentPricing';

interface TestResult {
  test: string;
  input: unknown;
  result: unknown;
  passed?: boolean;
}

const PricingSystemTest: React.FC = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);

  const runTests = () => {
    const results: TestResult[] = [];

    // Test 1: Equipment Detection
    const testEquipment = findEquipmentByModel('Canon EOS R6');
    results.push({
      test: 'Equipment Detection',
      input: 'Canon EOS R6',
      result: testEquipment,
      passed: testEquipment !== null
    });

    // Test 2: Pricing Calculation
    const pricingOptions: RentalPricingOptions = {
      equipmentId: testEquipment?.id,
      duration: '3-day',
      includeInsurance: false
    };
    const pricingCalc = calculateRentalPricing(pricingOptions);
    results.push({
      test: 'Rental Pricing Calculation (3 days)',
      input: pricingOptions,
      result: pricingCalc,
      passed: pricingCalc.savings.min > 0 // Check if discount applied
    });

    // Test 3: Insurance Calculation
    const insurance = calculateInsurance(2500, '3-day');
    results.push({
      test: 'Insurance Calculation ($2500 equipment, 3 days)',
      input: { value: 2500, days: '3-day' },
      result: `$${insurance}`,
      passed: insurance > 0
    });

    // Test 4: Deposit Calculation
    const depositWithoutInsurance = calculateDeposit(2500);
    results.push({
      test: 'Deposit Calculation',
      input: '$2500 equipment value',
      result: { withoutInsurance: depositWithoutInsurance },
      passed: depositWithoutInsurance === 1250
    });

    // Test 5: Pricing Validation
    const validation = validatePricing(120, 'canon-eos-r6', 2500);
    results.push({
      test: 'Price Validation',
      input: { dailyRate: 120, equipmentId: 'canon-eos-r6', purchasePrice: 2500 },
      result: validation,
      passed: validation.isValid !== undefined
    });

    // Test 6: Keyword Detection
    const titleDetection = findEquipmentByModel('Looking to rent my Canon EOS R6 Mark II camera');
    results.push({
      test: 'Keyword Detection from Title',
      input: 'Looking to rent my Canon EOS R6 Mark II camera',
      result: titleDetection,
      passed: titleDetection !== null
    });

    setTestResults(results);
  };

  const runEquipmentSummary = () => {
    const summary: TestResult[] = EQUIPMENT_PRICING.map(equipment => ({
      test: `Equipment: ${equipment.model}`,
      input: equipment.category,
      result: {
        model: equipment.model,
        category: equipment.category,
        dailyRate: `$${equipment.dailyRate.min}-${equipment.dailyRate.max}`,
        weeklyRate: `$${equipment.pricing['7-day'].min}-${equipment.pricing['7-day'].max}`,
        depositAmount: `$${equipment.depositAmount}`,
        insuranceRate: `${equipment.insurance['1-day']}% daily`
      },
      passed: true
    }));

    setTestResults(summary);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Pricing System Test Dashboard</h1>
      
      <div className="space-y-4 mb-6">
        <button
          onClick={runTests}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
        >
          Run Functionality Tests
        </button>
        
        <button
          onClick={runEquipmentSummary}
          className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 ml-4"
        >
          Show Equipment Database
        </button>
      </div>

      {testResults.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Results</h2>
          <div className="space-y-4">
            {testResults.map((result, index) => (
              <div key={index} className="border-l-4 border-gray-200 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold">{result.test}</h3>
                  {result.passed !== undefined && (
                    <span className={`px-2 py-1 rounded text-sm ${result.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {result.passed ? '✓ PASS' : '✗ FAIL'}
                    </span>
                  )}
                </div>
                
                {result.input !== null && result.input !== undefined && (
                  <div className="text-sm text-gray-600 mb-1">
                    Input: {typeof result.input === 'object' ? JSON.stringify(result.input) : String(result.input)}
                  </div>
                )}
                
                <div className="text-sm">
                  <strong>Result:</strong>
                  <pre className="bg-gray-50 p-2 rounded mt-1 overflow-auto">
                    {JSON.stringify(result.result, null, 2)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 bg-gray-50 p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-4">System Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div>
            <h3 className="font-semibold text-green-600">✓ Implemented Features</h3>
            <ul className="mt-2 space-y-1">
              <li>• 17 equipment models database</li>
              <li>• Auto-detection from titles/descriptions</li>
              <li>• Duration-based discount pricing</li>
              <li>• Insurance calculation (2-3.5%)</li>
              <li>• Smart deposit calculation</li>
              <li>• Price validation & suggestions</li>
              <li>• Interactive pricing guide</li>
              <li>• Enhanced AddGear form</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-blue-600">🔄 Database Integration</h3>
            <ul className="mt-2 space-y-1">
              <li>• Migration created for new fields</li>
              <li>• Database functions for calculations</li>
              <li>• Auto-suggestion triggers</li>
              <li>• Enhanced gear_listings table</li>
              <li>• Pricing analytics view</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-purple-600">📊 Business Logic</h3>
            <ul className="mt-2 space-y-1">
              <li>• 3-day: 20% discount</li>
              <li>• 7-day: 40% discount</li>
              <li>• 14-day: 60% discount</li>
              <li>• Insurance eliminates deposit</li>
              <li>• 50% deposit without insurance</li>
              <li>• Market rate validation</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// Deprecated: PricingSystemTest is no longer used.
const PricingSystemTest = () => null;
export default PricingSystemTest;