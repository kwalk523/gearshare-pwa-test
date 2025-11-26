import { supabase } from './supabase';

export type PaymentIntentStub = {
  id: string;
  client_secret: string;
  amount: number;
  currency: string;
  rental_id?: string;
  status: string; // requires_confirmation | succeeded
};

// MOCK IMPLEMENTATION - Bypasses Edge Function to avoid 500 errors
export async function createPaymentIntent(amount: number, rentalId?: string, currency: string = 'usd'): Promise<PaymentIntentStub> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return {
    id: `pi_mock_${Math.random().toString(36).substring(7)}`,
    client_secret: `secret_mock_${Math.random().toString(36).substring(7)}`,
    amount,
    currency,
    rental_id: rentalId,
    status: 'requires_confirmation'
  };
}

export async function confirmPaymentIntent(paymentIntentId: string): Promise<{ id: string; status: string; }> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  return {
    id: paymentIntentId,
    status: 'succeeded'
  };
}

// Convenience: simulate full flow
export async function simulateImmediatePayment(amount: number, rentalId?: string): Promise<{ intent: PaymentIntentStub; confirmation: { id: string; status: string; } }> {
  const intent = await createPaymentIntent(amount, rentalId);
  const confirmation = await confirmPaymentIntent(intent.id);
  return { intent: { ...intent, status: confirmation.status }, confirmation };
}
