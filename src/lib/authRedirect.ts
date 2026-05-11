// Allowed origins for auth redirect URLs (must be absolute https URLs).
// Add custom domains here as the project grows.
export const ALLOWED_REDIRECT_ORIGINS: readonly string[] = [
  "https://studysync-csuf.lovable.app",
  "https://id-preview--118dca0e-d885-4178-94af-588c4e6d86ae.lovable.app",
];

// Hostname suffixes that are always allowed (covers preview/sandbox subdomains).
const ALLOWED_HOST_SUFFIXES: readonly string[] = [".lovable.app", ".lovable.dev"];

const FALLBACK_ORIGIN = ALLOWED_REDIRECT_ORIGINS[0];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_REDIRECT_ORIGINS.includes(origin)) return true;
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== "https:") return false;
    return ALLOWED_HOST_SUFFIXES.some((s) => hostname === s.slice(1) || hostname.endsWith(s));
  } catch {
    return false;
  }
}

/**
 * Build a safe absolute https redirect URL for Supabase auth flows.
 * Falls back to the canonical published origin if the current window.origin
 * is not on the allowed list (e.g. http://, localhost, or unknown host).
 *
 * @throws if the resulting URL is not absolute https or its origin is not allowed.
 */
export function buildAuthRedirectUrl(path: string): string {
  if (!path.startsWith("/")) {
    throw new Error(`Auth redirect path must start with "/" (got: ${path})`);
  }

  const currentOrigin =
    typeof window !== "undefined" ? window.location.origin : FALLBACK_ORIGIN;

  // Normalize http -> https on the same host, then validate.
  const httpsOrigin = currentOrigin.replace(/^http:\/\//, "https://");
  const origin = isAllowedOrigin(httpsOrigin) ? httpsOrigin : FALLBACK_ORIGIN;

  const url = `${origin}${path}`;

  // Final guard: must be absolute https + allowed origin.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid redirect URL: ${url}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`Auth redirect must use https (got: ${parsed.protocol})`);
  }
  if (!isAllowedOrigin(parsed.origin)) {
    throw new Error(`Auth redirect origin not allowed: ${parsed.origin}`);
  }

  return parsed.toString();
}
