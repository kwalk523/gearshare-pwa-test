import { useState } from 'react';
import { Tag, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PromoCodeInputProps {
  rentalAmount: number;
  userId: string;
  onApply: (discountAmount: number, code: string) => void;
}

// Deprecated: PromoCodeInput is no longer used.
export default function PromoCodeInput() { return null; }
