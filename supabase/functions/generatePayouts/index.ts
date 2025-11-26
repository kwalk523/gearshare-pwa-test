import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Automated Payout Generation
// This Edge Function is designed to be invoked on a schedule (e.g., weekly via Supabase cron or external scheduler).
// It finds all owners with pending earnings above a threshold and creates payout records for them.

const PAYOUT_THRESHOLD = 25; // Minimum dollar amount required to generate a payout
const PLATFORM_FEE_RATE = 0.10; // 10% platform fee

serve(async (req) => {
  try {
    // Authenticate with service role key (only allow internal/scheduled calls)
    const supabaseServiceRole = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Optional: Validate request authorization (e.g., secret token in header for cron jobs)
    const authHeader = req.headers.get("Authorization");
    const expectedToken = Deno.env.get("CRON_SECRET_TOKEN");
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // Find all distinct owners who have completed rentals
    const { data: owners, error: ownerError } = await supabaseServiceRole
      .from("rental_requests")
      .select("gear_owner_id")
      .eq("status", "completed")
      .not("gear_owner_id", "is", null);

    if (ownerError) throw ownerError;

    const uniqueOwnerIds = [...new Set(owners?.map((r: any) => r.gear_owner_id) || [])];
    const results: Array<{ owner_id: string; pending: number; payout_id?: string; skipped?: string }> = [];

    for (const ownerId of uniqueOwnerIds) {
      // Check pending earnings
      const { data: pendingAmount, error: pendingError } = await supabaseServiceRole.rpc(
        "calculate_pending_earnings",
        { p_owner_id: ownerId }
      );

      if (pendingError) {
        results.push({ owner_id: ownerId, pending: 0, skipped: pendingError.message });
        continue;
      }

      const pending = Number(pendingAmount || 0);
      if (pending < PAYOUT_THRESHOLD) {
        results.push({ owner_id: ownerId, pending, skipped: "Below threshold" });
        continue;
      }

      // Create payout
      const { data: payoutId, error: payoutError } = await supabaseServiceRole.rpc("create_payout", {
        p_owner_id: ownerId,
        p_fee_rate: PLATFORM_FEE_RATE,
      });

      if (payoutError) {
        results.push({ owner_id: ownerId, pending, skipped: payoutError.message });
      } else {
        results.push({ owner_id: ownerId, pending, payout_id: payoutId });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: uniqueOwnerIds.length,
        results,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
