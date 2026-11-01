import { DEMO_FAIL_TO } from "../config.js";

function utf8Bytes(text) {
  return new TextEncoder().encode(text);
}

function bytesToBinaryString(bytes) {
  const chunk = 0x8000;
  let out = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return out;
}

function base64UrlEncodeBytes(bytes) {
  return btoa(bytesToBinaryString(bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function encodeHeaderValue(value) {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  const b64 = btoa(bytesToBinaryString(utf8Bytes(value)));
  return `=?UTF-8?B?${b64}?=`;
}

function wrap76(b64) {
  return b64.replace(/(.{76})/g, "$1\r\n");
}

function formatFrom(name, email) {
  if (!name) return email;
  const safe = encodeHeaderValue(name);
  return `${safe} <${email}>`;
}

export function buildMimeMessage({ fromName, fromEmail, to, subject, body, resume }) {
  const boundary = `fastreply_${crypto.randomUUID().replaceAll("-", "")}`;
  const pdfB64 = resume.dataBase64.replace(/\s/g, "");
  const filename = resume.fileName.replaceAll('"', "");

  const parts = [
    `From: ${formatFrom(fromName, fromEmail)}`,
    `To: ${to}`,
    `Subject: ${encodeHeaderValue(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(btoa(bytesToBinaryString(utf8Bytes(body)))),
    `--${boundary}`,
    "Content-Type: application/pdf",
    `Content-Disposition: attachment; filename="${filename}"`,
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(pdfB64),
    `--${boundary}--`,
    "",
  ];

  return base64UrlEncodeBytes(utf8Bytes(parts.join("\r\n")));
}

export async function sendGmail({ accessToken, fromName, fromEmail, to, subject, body, resume }) {
  const raw = buildMimeMessage({
    fromName,
    fromEmail,
    to,
    subject,
    body,
    resume,
  });

  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(gmailErrorMessage(response.status, errText));
  }

  return response.json();
}

function gmailErrorMessage(status, body) {
  if (status === 401) return "Gmail session expired. Connect again, then retry.";
  if (status === 403) return "Gmail refused send. Check OAuth scopes and Gmail API access.";
  if (status >= 500) return "Gmail is unavailable. Try again in a moment.";
  return `Send failed (${status}). ${body.slice(0, 180)}`;
}

export async function fetchGmailAddress(accessToken) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error("Could not read the Gmail address for this account.");
  }
  const data = await response.json();
  return data.email;
}

export async function demoSend({ to }) {
  await new Promise((resolve) => setTimeout(resolve, 450));
  if (to.trim().toLowerCase() === DEMO_FAIL_TO) {
    throw new Error("Demo send failed. Use a real address, or connect Gmail.");
  }
  return { id: `demo-${Date.now()}` };
}
