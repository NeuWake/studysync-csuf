// =============================================================================
// Google OAuth — paste YOUR own Web Client ID here.
// =============================================================================
// 1. Go to https://console.cloud.google.com/apis/credentials
// 2. Create credentials → OAuth client ID → Web application
// 3. Authorized JavaScript origins: add this app's origin(s)
//      e.g. http://localhost:8080, https://studysync-csuf.lovable.app, etc.
// 4. Enable the "Google Drive API" in your Google Cloud project.
// 5. Paste the Client ID below. (Client SECRET is NOT needed — never put it in
//    frontend code. The Drive token is requested in-browser via Google
//    Identity Services and lives only in memory.)
// =============================================================================
export const GOOGLE_OAUTH_CLIENT_ID = "149607452746-nn5vil19i9jb3rmkn4ij4o15amr2hi1k.apps.googleusercontent.com";

export const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
