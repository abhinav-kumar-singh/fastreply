/**
 * Google OAuth client ID for Gmail send.
 * Leave empty to use the local demo send path (no email leaves the browser).
 *
 * Create a client in Google Cloud Console:
 * 1. Enable the Gmail API.
 * 2. Create an OAuth client. Chrome extension type is best; otherwise Web.
 * 3. Authorized redirect URI: https://<YOUR_EXTENSION_ID>.chromiumapp.org/
 *    Find the ID at chrome://extensions with Developer mode on.
 * 4. Paste the client ID below (…apps.googleusercontent.com).
 */
export const GOOGLE_OAUTH_CLIENT_ID = "";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export const DEMO_FAIL_TO = "fail@example.com";
