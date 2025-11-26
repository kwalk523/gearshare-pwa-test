import { useState, useEffect } from 'react';
import { supabase, GearListing, Profile } from '../lib/supabase';
import { Upload, X, Lightbulb, TrendingUp } from 'lucide-react';
import { findEquipmentByModel, validatePricing, calculateDeposit } from '../lib/pricingCalculator';
import { type EquipmentPricing } from '../data/equipmentPricing';
import PricingGuide from './PricingGuide';

type AddGearProps = {
  currentUser: Profile; // logged-in user
  onAdd?: (newGear: GearListing) => void; // optional callback after adding
};

const categories = ['Cameras', 'Lighting', 'Tripods', 'Drones', 'Audio', 'Gaming', 'Other'];
const conditions: GearListing['condition'][] = ['excellent', 'good', 'fair'];

export default function AddGear({ currentUser, onAdd }: AddGearProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [dailyRate, setDailyRate] = useState<number>(0);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [condition, setCondition] = useState<GearListing['condition']>('excellent');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPricingGuide, setShowPricingGuide] = useState(false);
  const [detectedEquipment, setDetectedEquipment] = useState<EquipmentPricing | null>(null);
  const [pricingValidation, setPricingValidation] = useState<{ isValid: boolean; suggestion?: { min: number; max: number }; reason?: string } | null>(null);
  const [purchasePrice, setPurchasePrice] = useState(0);

  // Auto-detect equipment and suggest pricing
  useEffect(() => {
    if (title.length > 3) {
      console.log('🔍 Checking for equipment in title:', title);
      const equipment = findEquipmentByModel(title, description);
      console.log('📦 Equipment detected:', equipment);
      setDetectedEquipment(equipment);
      
      if (equipment) {
        console.log('✅ Setting suggestions for:', equipment.model);
        // Auto-suggest category
        const categoryMapping = {
          'cameras': 'Cameras',
          'action-cameras': 'Cameras',
          'microphones': 'Audio',
          'audio': 'Audio',
          'lighting': 'Lighting'
        } as const;
        const suggestedCategory = categoryMapping[equipment.category] || 'Other';
        if (categories.includes(suggestedCategory)) {
          setCategory(suggestedCategory);
        }
        
        // Suggest deposit based on equipment
        if (depositAmount === 0) {
          setDepositAmount(equipment.depositAmount);
        }
        
        // Suggest purchase price for validation
        if (purchasePrice === 0) {
          setPurchasePrice(equipment.purchasePrice);
        }
      }
    } else {
      setDetectedEquipment(null);
    }
  }, [title, description, depositAmount, purchasePrice]);

  // Validate pricing when daily rate changes
  useEffect(() => {
    if (dailyRate > 0) {
      const validation = validatePricing(
        dailyRate, 
        detectedEquipment?.id, 
        purchasePrice > 0 ? purchasePrice : undefined
      );
      setPricingValidation(validation);
      
      // Auto-calculate deposit if not set and we have purchase price
      if (depositAmount === 0 && purchasePrice > 0 && !detectedEquipment) {
        setDepositAmount(calculateDeposit(purchasePrice));
      }
    } else {
      setPricingValidation(null);
    }
  }, [dailyRate, detectedEquipment, purchasePrice, depositAmount]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    setError('');
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview('');
  };

  const handlePricingSuggestion = (suggestedRate: { min: number; max: number }) => {
    setDailyRate(Math.round((suggestedRate.min + suggestedRate.max) / 2));
    setShowPricingGuide(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Basic validation
    if (!title || !description || !category || !location || dailyRate < 0 || depositAmount < 0) {
      setError('Please fill out all required fields correctly.');
      setLoading(false);
      return;
    }

    try {
      let imageUrl: string | null = null;

      // Upload image if provided
      if (imageFile) {
        const fileName = `${currentUser.id}/${Date.now()}-${imageFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('gear-listings')
          .upload(fileName, imageFile);

        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);

        // Get public URL
        const { data } = supabase.storage
          .from('gear-listings')
          .getPublicUrl(fileName);

        imageUrl = data?.publicUrl || null;
      }

      const { data, error: supabaseError } = await supabase
        .from('gear_listings')
        .insert({
          owner_id: currentUser.id,
          title,
          description,
          category,
          daily_rate: dailyRate,
          deposit_amount: depositAmount,
          condition,
          image_url: imageUrl,
          location,
          is_available: true,
          purchase_price: purchasePrice > 0 ? purchasePrice : null,
          equipment_model: detectedEquipment?.id || null,
          price_validated: pricingValidation?.isValid || false,
          suggested_daily_rate: pricingValidation?.suggestion ? 
            Math.round((pricingValidation.suggestion.min + pricingValidation.suggestion.max) / 2) : 
            null,
        })
        .select()
        .single();

      if (supabaseError) throw supabaseError;

      // Call optional callback
      if (onAdd && data) onAdd(data);

      // Reset form
      setTitle('');
      setDescription('');
      setCategory(categories[0]);
      setDailyRate(0);
      setDepositAmount(0);
      setCondition('excellent');
      clearImage();
      setLocation('');
      setPurchasePrice(0);
      setDetectedEquipment(null);
      setPricingValidation(null);
      setShowPricingGuide(false);

      alert('Gear added successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add gear.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Add New Gear</h2>

      {error && <p className="text-red-500 mb-2">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-medium mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            required
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block font-medium mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block font-medium mb-1">Condition</label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as GearListing['condition'])}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              {conditions.map((cond) => (
                <option key={cond} value={cond}>
                  {cond.charAt(0).toUpperCase() + cond.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Equipment Detection Alert */}
        {detectedEquipment && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-emerald-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-emerald-800 mb-1">
                  Equipment Detected: {detectedEquipment.model}
                </h4>
                <p className="text-sm text-emerald-700 mb-2">
                  We found pricing data for this equipment. Suggested daily rate: ${detectedEquipment.dailyRate.min}-${detectedEquipment.dailyRate.max}
                </p>
                <button
                  type="button"
                  onClick={() => handlePricingSuggestion(detectedEquipment.dailyRate)}
                  className="px-3 py-1 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700 transition-colors"
                >
                  Use Suggested Pricing
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Purchase Price (for pricing validation) */}
        <div>
          <label className="block font-medium mb-1">Purchase Price (optional)</label>
          <input
            type="number"
            min={0}
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(Number(e.target.value))}
            placeholder="Equipment purchase price for pricing guidance"
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          />
          <p className="text-xs text-gray-500 mt-1">
            Used for pricing validation and deposit calculation
          </p>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block font-medium mb-1">Daily Rate ($)</label>
            <div className="relative">
              <input
                type="number"
                min={0}
                value={dailyRate}
                onChange={(e) => setDailyRate(Number(e.target.value))}
                className={`w-full border rounded-lg px-3 py-2 ${
                  pricingValidation && !pricingValidation.isValid
                    ? 'border-yellow-400 bg-yellow-50'
                    : 'border-gray-300'
                }`}
                required
              />
              <button
                type="button"
                onClick={() => setShowPricingGuide(!showPricingGuide)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-emerald-600"
                title="View pricing guide"
              >
                <TrendingUp className="w-4 h-4" />
              </button>
            </div>
            {pricingValidation && !pricingValidation.isValid && (
              <div className="mt-1 text-sm text-yellow-600">
                <p>{pricingValidation.reason}</p>
                {pricingValidation.suggestion && (
                  <p className="text-emerald-600">
                    Suggested: ${pricingValidation.suggestion.min}-${pricingValidation.suggestion.max}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex-1">
            <label className="block font-medium mb-1">Deposit ($)</label>
            <input
              type="number"
              min={0}
              value={depositAmount}
              onChange={(e) => setDepositAmount(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            />
          </div>
        </div>

        <div>
          <label className="block font-medium mb-1">Location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Image (optional)</label>
          {imagePreview ? (
            <div className="relative">
              <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover rounded-lg mb-2" />
              <button
                type="button"
                onClick={clearImage}
                className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
              >
                <X className="w-4 h-4" />
              </button>
              <p className="text-sm text-gray-600">{imageFile?.name}</p>
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-emerald-500 transition">
              <label className="cursor-pointer flex flex-col items-center gap-2">
                <Upload className="w-6 h-6 text-gray-400" />
                <span className="text-sm text-gray-600">Click to upload image (max 5MB)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            </div>
          )}
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>

        {/* Pricing Guide Modal */}
        {showPricingGuide && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold">Equipment Pricing Guide</h3>
                  <button
                    onClick={() => setShowPricingGuide(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <PricingGuide 
                  onSelectPricing={handlePricingSuggestion}
                  className="border-0 shadow-none p-0 bg-transparent"
                />
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-600 text-white py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
        >
          {loading ? 'Adding...' : 'Add Gear'}
        </button>
      </form>
    </div>
  );
}
