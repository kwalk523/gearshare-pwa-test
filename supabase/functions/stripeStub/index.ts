import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// NOTE: This is a stubbed Stripe integration. It does NOT call Stripe.
// Replace logic with real Stripe SDK calls once STRIPE_SECRET_KEY is available.
// Expected environment variables (add in dashboard later):
//   STRIPE_SECRET_KEY - real secret key
//   STRIPE_WEBHOOK_SECRET - webhook signing secret
// For now we simulate a payment intent lifecycle.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only handle POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    // Parse body once
    let body: any;
    try {
      body = await req.json();
    } catch (parseErr) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const { action, amount, currency = "usd", rental_id, payment_intent_id } = body;
    
    if (!action) {
      return new Response(JSON.stringify({ error: "Missing action parameter" }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    switch (action) {
      case "create-payment-intent": {
        if (typeof amount !== "number" || amount <= 0) {
          return new Response(JSON.stringify({ error: "Invalid amount - must be positive number" }), { 
            status: 400, 
            headers: corsHeaders 
          });
        }
        const intentId = crypto.randomUUID();
        const clientSecret = `pi_test_${intentId}_secret_${crypto.randomUUID()}`;
        return new Response(
          JSON.stringify({
            id: intentId,
            object: "payment_intent",
            client_secret: clientSecret,
            amount,
            currency,
            rental_id,
            status: "requires_confirmation",
            created: Date.now(),
          }),
          { status: 200, headers: corsHeaders },
        );
      }

      case "confirm-payment-intent": {
        if (!payment_intent_id) {
          return new Response(JSON.stringify({ error: "Missing payment_intent_id parameter" }), { 
            status: 400, 
            headers: corsHeaders 
          });
        }
        // Simulate confirmation success
        return new Response(
          JSON.stringify({ id: payment_intent_id, status: "succeeded" }),
          { status: 200, headers: corsHeaders },
        );
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { 
          status: 400, 
          headers: corsHeaders 
        });
    }
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error),
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: corsHeaders },
    );
  }
});
