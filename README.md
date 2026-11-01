# FastReply

Chrome side panel that sends your resume from a job tab without opening Gmail.

You see an email-apply post, toggle the extension, paste the recruiter address, preview, send. FastReply does **not** scrape LinkedIn.

## Load unpacked in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder (the one that contains `manifest.json`).
4. Pin FastReply. Open any tab, click the toolbar icon (or **Alt+Shift+F**) to open the side panel on the right.

There is no Google OAuth client in this repo, so the panel uses **Demo send**: the full compose → preview → send → local log flow works, and nothing is delivered to Gmail.

## First send (demo)

1. Click **Use demo send**.
2. Open **Profile**: from name, one resume PDF, optional LinkedIn URL / phone, subject + body template (`{role}`, `{company}`, `{name}`).
3. Open **Compose**: paste **To**, job title, company, optional one-line note.
4. **Preview** (To, subject, body, attachment name), then **Send**.
5. Check **Sent** for email, title, company, and date.

To exercise the send-failed state in demo mode, use To address `fail@example.com`.

Click the account chip (top right) to disconnect.

## Plug in real Gmail send

Demo mode is the default so the extension is usable unpacked with no secrets. To send through Gmail:

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project, enable **Gmail API**, and configure the OAuth consent screen.
2. Create an OAuth client ID. Prefer type **Chrome extension** with this extension’s ID from `chrome://extensions`. For a **Web** client, add the authorized redirect URI:
   `https://<EXTENSION_ID>.chromiumapp.org/`
3. Paste the client ID into `GOOGLE_OAUTH_CLIENT_ID` in `config.js`.
4. Reload the unpacked extension. **Connect Gmail** appears. FastReply requests `gmail.send` and the account email only. No password is stored; the access token lives in `chrome.storage.local` until you disconnect.

Send uses `users.messages.send` with a MIME `multipart/mixed` payload (plain-text body + the saved PDF).

Chrome Web Store review treats Gmail send as a sensitive scope. Keep the listed scopes unchanged and explain the attach-and-send flow in the listing when you publish.

## What v1 does not include

Desktop app, Outlook, multiple Gmail accounts, AI-written copy, ATS/kanban, or board-specific parsers.

## Preview this UI without Chrome

From this folder:

```bash
python3 -m http.server 43147
```

Open `http://127.0.0.1:43147/preview.html`. Storage falls back to `localStorage`. Gmail Connect still needs the unpacked extension plus a client ID.
