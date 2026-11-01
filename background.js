import { GOOGLE_OAUTH_CLIENT_ID, GMAIL_SCOPES } from "./config.js";
import { fetchGmailAddress } from "./lib/gmail.js";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

async function handleMessage(message) {
  if (message.type === "GET_OAUTH_STATUS") {
    return {
      ok: true,
      hasClientId: Boolean(GOOGLE_OAUTH_CLIENT_ID),
    };
  }

  if (message.type === "CONNECT_GMAIL") {
    const token = await getAccessToken(true);
    const email = await fetchGmailAddress(token);
    return { ok: true, email, accessToken: token };
  }

  if (message.type === "REFRESH_TOKEN") {
    const token = await getAccessToken(false);
    return { ok: true, accessToken: token };
  }

  return { ok: false, error: "Unknown message" };
}

function getAccessToken(interactive) {
  if (!GOOGLE_OAUTH_CLIENT_ID) {
    return Promise.reject(
      new Error("No Google OAuth client ID. Add it in config.js, or use Demo send.")
    );
  }

  const redirectUrl = chrome.identity.getRedirectURL();
  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth" +
    `?client_id=${encodeURIComponent(GOOGLE_OAUTH_CLIENT_ID)}` +
    "&response_type=token" +
    `&redirect_uri=${encodeURIComponent(redirectUrl)}` +
    `&scope=${encodeURIComponent(GMAIL_SCOPES)}` +
    "&prompt=consent";

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive }, (responseUrl) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!responseUrl) {
        reject(new Error("Google sign-in was cancelled."));
        return;
      }
      const token = new URL(responseUrl.replace("#", "?")).searchParams.get("access_token");
      if (!token) {
        reject(new Error("Google did not return an access token."));
        return;
      }
      resolve(token);
    });
  });
}
