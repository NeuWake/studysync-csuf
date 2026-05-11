import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body = {
  // Drive API path beginning with "/drive/v3/...". e.g. "/drive/v3/files?q=..."
  path: string;
  method?: string;
  // Pass-through body for POST/PUT
  body?: unknown;
};

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description || json.error || "refresh failed");
  return json as { access_token: string; expires_in: number; scope?: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const body = await req.json() as Body;
    if (!body.path || !body.path.startsWith("/")) {
      return new Response(JSON.stringify({ error: "Invalid path" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: tokenRow, error: tokenErr } = await admin
      .from("user_google_tokens")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", userId)
      .eq("provider", "google")
      .maybeSingle();

    if (tokenErr) throw tokenErr;
    if (!tokenRow) {
      return new Response(JSON.stringify({ error: "not_connected" }), {
        status: 412, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accessToken = tokenRow.access_token as string | null;
    const expired = !tokenRow.expires_at || new Date(tokenRow.expires_at as string).getTime() < Date.now() + 30_000;
    if (expired || !accessToken) {
      const refreshed = await refreshAccessToken(tokenRow.refresh_token as string);
      accessToken = refreshed.access_token;
      await admin.from("user_google_tokens").update({
        access_token: accessToken,
        expires_at: new Date(Date.now() + (refreshed.expires_in - 30) * 1000).toISOString(),
      }).eq("user_id", userId).eq("provider", "google");
    }

    const driveUrl = `https://www.googleapis.com${body.path}`;
    const driveRes = await fetch(driveUrl, {
      method: body.method || "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body.body ? { "Content-Type": "application/json" } : {}),
      },
      body: body.body ? JSON.stringify(body.body) : undefined,
    });

    const text = await driveRes.text();
    return new Response(text, {
      status: driveRes.status,
      headers: { ...corsHeaders, "Content-Type": driveRes.headers.get("Content-Type") || "application/json" },
    });
  } catch (e) {
    console.error("proxy error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
