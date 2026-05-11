import { supabase } from "@/integrations/supabase/client";

export const GOOGLE_DRIVE_CONNECT_PARAM = "connect_google_drive";

export function isEmbeddedPreview() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function getStandaloneConnectUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set(GOOGLE_DRIVE_CONNECT_PARAM, "1");
  return url.toString();
}

export function getCleanReturnUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete(GOOGLE_DRIVE_CONNECT_PARAM);
  return url.toString();
}

export async function getGoogleDriveAuthUrl(returnTo = getCleanReturnUrl()) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Please sign in before connecting Google Drive.");

  const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-oauth-start`);
  url.searchParams.set("return_to", returnTo);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const json = await res.json();
  if (!res.ok || !json.url) throw new Error(json.error || "Failed to start Google sign-in");
  return json.url as string;
}
