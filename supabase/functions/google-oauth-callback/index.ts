import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// This endpoint is hit by Google's redirect (top-level browser nav).
// It must NOT require a JWT, and it must redirect the browser back to the app.

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const html = (msg: string, redirect?: string) => new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Google Drive</title>
${redirect ? `<meta http-equiv="refresh" content="1;url=${redirect}">` : ""}
<style>body{font-family:system-ui;padding:40px;text-align:center;color:#334}</style>
</head><body><h2>${msg}</h2>${redirect ? `<p>Redirecting…</p>` : ""}</body></html>`,
    { headers: { "Content-Type": "text/html" } },
  );

  try {
    if (errorParam) return html(`Google sign-in cancelled: ${errorParam}`);
    if (!code || !stateRaw) return html("Missing code or state.");

    let state: { uid: string; r?: string };
    try { state = JSON.parse(atob(stateRaw)); } catch { return html("Invalid state."); }
    if (!state.uid) return html("Invalid state: no user.");

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-oauth-callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: redirectUri, grant_type: "authorization_code",
      }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("token exchange failed", tokenJson);
      return html(`Token exchange failed: ${tokenJson.error_description || tokenJson.error || "unknown"}`);
    }

    const { access_token, refresh_token, expires_in, scope } = tokenJson as {
      access_token: string; refresh_token?: string; expires_in: number; scope: string;
    };

    if (!refresh_token) {
      console.warn("No refresh_token returned (user may have already granted before).");
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const expiresAt = new Date(Date.now() + (expires_in - 30) * 1000).toISOString();

    // Upsert; if no new refresh_token returned, keep existing one.
    const existing = refresh_token ? null : await admin
      .from("user_google_tokens")
      .select("refresh_token")
      .eq("user_id", state.uid)
      .eq("provider", "google")
      .maybeSingle();

    const finalRefresh = refresh_token || existing?.data?.refresh_token;
    if (!finalRefresh) {
      return html("Google did not return a refresh token. Please remove app access at myaccount.google.com/permissions and retry.");
    }

    const { error: upsertErr } = await admin
      .from("user_google_tokens")
      .upsert({
        user_id: state.uid,
        provider: "google",
        access_token,
        refresh_token: finalRefresh,
        expires_at: expiresAt,
        scope,
      }, { onConflict: "user_id,provider" });

    if (upsertErr) {
      console.error("upsert failed", upsertErr);
      return html(`Storage failed: ${upsertErr.message}`);
    }

    const fallback = "https://studysync-csuf.lovable.app";
    const redirect = state.r && /^https?:\/\//.test(state.r) ? state.r : fallback;
    return html("Connected to Google Drive!", redirect);
  } catch (e) {
    console.error(e);
    return html(`Error: ${(e as Error).message}`);
  }
});
