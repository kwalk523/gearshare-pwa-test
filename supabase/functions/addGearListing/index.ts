import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Supabase client with auth propagated from request header
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: {
            Authorization: req.headers.get("Authorization") ?? "",
          },
        },
      },
    );

    // Parse JSON body containing gear info + images as base64 strings
    const { gearData, images } = await req.json();

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // Insert gear listing with authenticated user ID
    const { data: insertedGear, error: insertError } = await supabase
      .from("gear_listings")
      .insert([{ ...gearData, owner_id: user.id, created_at: new Date().toISOString() }])
      .select("id")
      .single();

    if (insertError || !insertedGear) {
      return new Response(JSON.stringify({ error: insertError?.message || "Failed to insert listing" }), { status: 400, headers: corsHeaders });
    }

    const listingId = insertedGear.id;
    const bucket = "gear-images";

    // Upload images to storage and prepare insert data for gear_images table
    const imageRecords = [];
    for (const { fileName, base64Data, contentType } of images) {
      const imageBuffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const path = `${listingId}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, imageBuffer, {
        cacheControl: "3600",
        upsert: true,
        contentType,
      });

      if (uploadError) {
        return new Response(JSON.stringify({ error: uploadError.message }), { status: 400, headers: corsHeaders });
      }

      const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path);
      imageRecords.push({ listing_id: listingId, image_url: publicUrlData.publicUrl });
    }

    // Insert image metadata rows atomically
    const { error: imagesInsertError } = await supabase.from("gear_images").insert(imageRecords);
    if (imagesInsertError) {
      return new Response(JSON.stringify({ error: imagesInsertError.message }), { status: 400, headers: corsHeaders });
    }

    // Update gear_listings main image_url with first image URL
    if (imageRecords.length > 0) {
      await supabase.from("gear_listings").update({ image_url: imageRecords[0].image_url }).eq("id", listingId);
    }

    return new Response(JSON.stringify({ success: true, listingId }), { status: 200, headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500, headers: corsHeaders });
  }
});
