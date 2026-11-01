import { GOOGLE_OAUTH_CLIENT_ID } from "./config.js";
import {
  getProfile,
  saveProfile,
  getResume,
  saveResume,
  clearResume,
  getAuth,
  saveAuth,
  clearAuth,
  getSentLog,
  prependSent,
  defaultProfile,
} from "./lib/storage.js";
import { buildBody, buildSubject, isValidEmail } from "./lib/template.js";
import { demoSend, sendGmail } from "./lib/gmail.js";

const MAX_RESUME_BYTES = 8 * 1024 * 1024;

const main = document.getElementById("main");
const banner = document.getElementById("banner");
const accountBtn = document.getElementById("account-btn");
const tabs = {
  compose: document.getElementById("tab-compose"),
  profile: document.getElementById("tab-profile"),
  log: document.getElementById("tab-log"),
};

const jobDraft = {
  to: "",
  title: "",
  company: "",
  note: "",
};

let view = "compose";
let preview = null;
let sending = false;
let formError = "";
let sendError = "";
let connectError = "";
let sentResult = null;
let hasClientId = Boolean(GOOGLE_OAUTH_CLIENT_ID);

init();

function init() {
  bindChrome();
  tabs.compose.addEventListener("click", () => setView("compose"));
  tabs.profile.addEventListener("click", () => setView("profile"));
  tabs.log.addEventListener("click", () => setView("log"));
  accountBtn.addEventListener("click", onAccountClick);
  render();
}

function bindChrome() {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") render();
  });
}

async function loadState() {
  const [auth, profile, resume, sentLog] = await Promise.all([
    getAuth(),
    getProfile(),
    getResume(),
    getSentLog(),
  ]);
  return { auth, profile, resume, sentLog };
}

function setView(next) {
  view = next;
  preview = null;
  formError = "";
  sendError = "";
  connectError = "";
  sentResult = null;
  render();
}

function setTab(name) {
  for (const [key, el] of Object.entries(tabs)) {
    const active = key === name;
    el.classList.toggle("is-active", active);
    el.setAttribute("aria-selected", active ? "true" : "false");
  }
}

async function render() {
  const state = await loadState();
  updateChrome(state);

  if (!state.auth) {
    setTab("compose");
    main.replaceChildren(connectView());
    return;
  }

  setTab(view);

  if (view === "profile") {
    main.replaceChildren(profileView(state));
    return;
  }
  if (view === "log") {
    main.replaceChildren(logView(state));
    return;
  }
  if (sentResult) {
    main.replaceChildren(successView(state, sentResult));
    return;
  }
  if (sendError) {
    main.replaceChildren(failedView(sendError));
    return;
  }
  if (preview) {
    main.replaceChildren(previewView(state, preview));
    return;
  }
  main.replaceChildren(composeView(state));
}

function updateChrome(state) {
  if (state.auth) {
    accountBtn.hidden = false;
    accountBtn.textContent = state.auth.email;
    accountBtn.title = "Disconnect";
  } else {
    accountBtn.hidden = true;
  }

  const demo = state.auth?.mode === "demo";
  const missingOauth = !hasClientId;
  if (demo || missingOauth) {
    banner.hidden = false;
    if (missingOauth) {
      banner.textContent =
        "Demo send is on. Emails stay in this browser. Add a Google OAuth client ID in config.js to send through Gmail.";
      return;
    }
    banner.textContent = "Demo account. Nothing is sent to Gmail.";
    return;
  }
  banner.hidden = true;
}

function connectView() {
  const wrap = el("section", "hero card");
  wrap.append(
    el("h1", "", "Connect Gmail to send"),
    el(
      "p",
      "lede",
      "FastReply sends from one Gmail account with your resume attached. Paste the recruiter email from the job post — we do not scrape LinkedIn."
    )
  );

  const actions = el("div", "stack");
  if (hasClientId) {
    const connect = button("Connect Gmail", "primary", connectGmail);
    actions.append(connect);
  } else {
    actions.append(
      el(
        "p",
        "hint",
        "No Google OAuth client ID is configured, so Gmail Connect is unavailable in this build."
      )
    );
  }

  const demo = button("Use demo send", hasClientId ? "ghost" : "primary", useDemo);
  demo.title = "Local preview. No email is delivered.";
  actions.append(demo);
  wrap.append(actions);
  if (connectError) {
    const alert = el("p", "status status-err");
    alert.setAttribute("role", "alert");
    alert.textContent = connectError;
    wrap.append(alert);
  }
  return wrap;
}

function composeView(state) {
  const root = document.createDocumentFragment();

  if (!state.resume) {
    root.append(missingResumeCard());
  }

  const form = el("form", "stack card");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    openPreview(state);
  });

  form.append(el("h2", "", "This job"));
  form.append(
    field("to", "To", "email", jobDraft.to, "recruiter@company.com", true),
    field("title", "Job title", "text", jobDraft.title, "Backend engineer", true),
    field("company", "Company", "text", jobDraft.company, "Acme", true),
    field("note", "Optional note", "text", jobDraft.note, "Referral from Priya, or a one-line hook")
  );

  const submit = button("Preview", "primary");
  submit.disabled = !state.resume || !state.profile.fromName;
  form.append(submit);

  if (!state.profile.fromName) {
    form.append(el("p", "hint", "Add your name in Profile before sending."));
  }
  if (formError) {
    const alert = el("p", "status status-err");
    alert.setAttribute("role", "alert");
    alert.textContent = formError;
    form.append(alert);
  }

  root.append(form);
  return root;
}

function missingResumeCard() {
  const card = el("section", "card status status-err");
  card.setAttribute("role", "status");
  card.append(
    el("h2", "", "Resume PDF required"),
    el("p", "", "Upload one PDF in Profile. FastReply will not send without an attachment.")
  );
  const go = button("Open profile", "ghost", () => setView("profile"));
  card.append(go);
  return card;
}

function previewView(state, data) {
  const root = el("section", "stack");
  const card = el("section", "card");
  card.append(el("h2", "", "Preview"));

  const dl = el("dl", "preview");
  addPreview(dl, "To", data.to);
  addPreview(dl, "Subject", data.subject);
  addPreview(dl, "Body", data.body);
  addPreview(dl, "Attachment", data.resumeName);
  card.append(dl);
  root.append(card);

  const actions = el("div", "row");
  const sendBtn = button(sending ? "Sending…" : "Send", "primary", () => doSend(state, data));
  sendBtn.disabled = sending;
  const back = button("Edit", "ghost", () => {
    preview = null;
    render();
  });
  actions.append(sendBtn, back);
  root.append(actions);
  return root;
}

function successView(state, result) {
  const card = el("section", "card stack");
  const status = el("p", "status status-ok");
  status.setAttribute("role", "status");
  status.textContent = `Sent ${formatWhen(result.sentAt)}`;
  card.append(
    status,
    el("h2", "", "On its way"),
    el("p", "lede", `${result.title} at ${result.company} → ${result.to}`)
  );
  const next = button("Send another", "primary", () => {
    jobDraft.to = "";
    jobDraft.title = "";
    jobDraft.company = "";
    jobDraft.note = "";
    sentResult = null;
    preview = null;
    render();
  });
  card.append(next);
  return card;
}

function failedView(message) {
  const card = el("section", "card stack");
  const status = el("p", "status status-err");
  status.setAttribute("role", "alert");
  status.textContent = message;
  card.append(status, el("h2", "", "Send failed"));
  const row = el("div", "row");
  row.append(
    button("Back to preview", "primary", () => {
      sendError = "";
      render();
    }),
    button("Edit job", "ghost", () => {
      sendError = "";
      preview = null;
      render();
    })
  );
  card.append(row);
  return card;
}

function profileView(state) {
  const form = el("form", "stack card");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    persistProfile(form);
  });

  form.append(el("h2", "", "Saved once"));
  form.append(
    field("fromName", "From name", "text", state.profile.fromName, "Your name", true),
    field("linkedinUrl", "LinkedIn URL", "url", state.profile.linkedinUrl, "https://linkedin.com/in/you"),
    field("phone", "Phone", "tel", state.profile.phone, "+91 …")
  );

  const fileBlock = el("div", "field");
  fileBlock.append(el("span", "", "Resume PDF"));
  const fileBox = el("div", "file");
  const fileInput = document.createElement("input");
  fileInput.id = "resume";
  fileInput.className = "hidden-file";
  fileInput.type = "file";
  fileInput.accept = "application/pdf,.pdf";
  fileInput.addEventListener("change", () => onResumeFile(fileInput));

  const pick = button(state.resume ? "Replace PDF" : "Upload PDF", "ghost", () =>
    fileInput.click()
  );
  fileBox.append(fileInput, pick);

  if (state.resume) {
    fileBox.append(el("p", "hint", state.resume.fileName));
    const remove = button("Remove resume", "linkish", async () => {
      await clearResume();
      await render();
    });
    fileBox.append(remove);
  } else {
    fileBox.append(el("p", "hint", "One PDF, used on every send."));
  }
  fileBlock.append(fileBox);
  form.append(fileBlock);

  form.append(
    labeledTextarea(
      "templateSubject",
      "Subject template",
      state.profile.templateSubject,
      "{role}, {company}, {name}"
    ),
    labeledTextarea(
      "templateBody",
      "Body template",
      state.profile.templateBody,
      "Tokens: {role}, {company}, {name}"
    )
  );

  form.append(button("Save profile", "primary"));
  form.append(
    el("p", "hint", "Phone and LinkedIn, if saved, are appended under the template when you send.")
  );
  if (formError) {
    const alert = el("p", "status status-err");
    alert.setAttribute("role", "alert");
    alert.textContent = formError;
    form.append(alert);
  }
  return form;
}

function logView(state) {
  const wrap = el("section", "stack");
  wrap.append(el("h2", "", "Sent from this browser"));

  if (state.sentLog.length === 0) {
    wrap.append(el("p", "empty", "Nothing sent yet. A local log appears here after the first send."));
    return wrap;
  }

  const list = el("ul", "log");
  for (const item of state.sentLog) {
    const li = document.createElement("li");
    li.append(
      el("strong", "", `${item.title} · ${item.company}`),
      el("span", "", item.to),
      el("span", "", formatWhen(item.sentAt))
    );
    list.append(li);
  }
  wrap.append(list);
  return wrap;
}

function openPreview(state) {
  jobDraft.to = valueOf("to");
  jobDraft.title = valueOf("title");
  jobDraft.company = valueOf("company");
  jobDraft.note = valueOf("note");

  if (!isValidEmail(jobDraft.to)) {
    formError = "That To address does not look like an email.";
    preview = null;
    render();
    return;
  }
  if (!jobDraft.title.trim() || !jobDraft.company.trim()) {
    formError = "Job title and company are required.";
    preview = null;
    render();
    return;
  }
  if (!state.profile.fromName.trim()) {
    formError = "Add your name in Profile.";
    preview = null;
    render();
    return;
  }
  if (!state.resume) {
    formError = "Upload a resume PDF before sending.";
    preview = null;
    render();
    return;
  }

  formError = "";
  preview = {
    to: jobDraft.to.trim(),
    title: jobDraft.title.trim(),
    company: jobDraft.company.trim(),
    note: jobDraft.note.trim(),
    subject: buildSubject(state.profile, {
      title: jobDraft.title.trim(),
      company: jobDraft.company.trim(),
    }),
    body: buildBody(state.profile, {
      title: jobDraft.title.trim(),
      company: jobDraft.company.trim(),
      note: jobDraft.note,
    }),
    resumeName: state.resume.fileName,
  };
  render();
}

async function doSend(state, data) {
  if (sending) return;
  sending = true;
  sendError = "";
  await render();

  try {
    if (state.auth.mode === "gmail") {
      await sendGmail({
        accessToken: await ensureToken(state.auth),
        fromName: state.profile.fromName,
        fromEmail: state.auth.email,
        to: data.to,
        subject: data.subject,
        body: data.body,
        resume: state.resume,
      });
    } else {
      await demoSend({ to: data.to });
    }

    const sentAt = new Date().toISOString();
    const entry = {
      id: crypto.randomUUID(),
      to: data.to,
      title: data.title,
      company: data.company,
      sentAt,
    };
    await prependSent(entry);
    sentResult = entry;
    preview = null;
  } catch (error) {
    sendError = error.message || "Send failed.";
  } finally {
    sending = false;
    await render();
  }
}

function sendToBackground(message) {
  if (!globalThis.chrome?.runtime?.id) {
    return Promise.reject(
      new Error("Open FastReply as an unpacked Chrome extension to connect Gmail.")
    );
  }
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Chrome background did not respond.")), 8000);
  });
  return Promise.race([chrome.runtime.sendMessage(message), timeout]);
}

async function ensureToken(auth) {
  if (auth.accessToken) return auth.accessToken;
  const response = await sendToBackground({ type: "REFRESH_TOKEN" });
  if (!response?.ok) throw new Error(response?.error || "Reconnect Gmail.");
  await saveAuth({ ...auth, accessToken: response.accessToken, mode: "gmail" });
  return response.accessToken;
}

async function connectGmail() {
  try {
    const response = await sendToBackground({ type: "CONNECT_GMAIL" });
    if (!response?.ok) throw new Error(response?.error || "Could not connect Gmail.");
    await saveAuth({
      mode: "gmail",
      email: response.email,
      accessToken: response.accessToken,
    });
    connectError = "";
    view = "compose";
    await render();
  } catch (error) {
    connectError = error.message;
    await render();
  }
}

async function useDemo() {
  await saveAuth({
    mode: "demo",
    email: "demo@fastreply.local",
  });
  view = "compose";
  await render();
}

async function onAccountClick() {
  await clearAuth();
  preview = null;
  sentResult = null;
  formError = "";
  sendError = "";
  connectError = "";
  view = "compose";
  await render();
}

async function persistProfile(form) {
  const profile = {
    ...defaultProfile(),
    fromName: form.fromName.value.trim(),
    linkedinUrl: form.linkedinUrl.value.trim(),
    phone: form.phone.value.trim(),
    templateSubject: form.templateSubject.value,
    templateBody: form.templateBody.value,
  };
  await saveProfile(profile);
  view = "compose";
  await render();
}

async function persistOpenProfileForm(form) {
  if (!form?.fromName) return;
  await saveProfile({
    ...defaultProfile(),
    fromName: form.fromName.value.trim(),
    linkedinUrl: form.linkedinUrl.value.trim(),
    phone: form.phone.value.trim(),
    templateSubject: form.templateSubject.value,
    templateBody: form.templateBody.value,
  });
}

async function onResumeFile(input) {
  const file = input.files?.[0];
  if (!file) return;
  view = "profile";
  await persistOpenProfileForm(input.closest("form"));
  if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    formError = "Resume must be a PDF.";
    await render();
    return;
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    formError = "Resume must be a PDF.";
    await render();
    return;
  }
  if (file.size > MAX_RESUME_BYTES) {
    formError = "Resume is too large. Use a PDF under 8 MB.";
    await render();
    return;
  }
  try {
    const dataBase64 = await fileToBase64(file);
    await saveResume({
      fileName: file.name,
      mimeType: "application/pdf",
      dataBase64,
    });
    formError = "";
  } catch (error) {
    formError = error.message || "Could not save that PDF.";
  }
  await render();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that PDF."));
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");
      resolve(result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

function field(id, label, type, value, placeholder, required) {
  const wrap = el("label", "field");
  wrap.setAttribute("for", id);
  wrap.append(el("span", "", label));
  const input = document.createElement("input");
  input.id = id;
  input.name = id;
  input.type = type;
  input.value = value || "";
  if (placeholder) input.placeholder = placeholder;
  if (required) input.required = true;
  wrap.append(input);
  return wrap;
}

function labeledTextarea(id, label, value, hint) {
  const wrap = el("label", "field");
  wrap.append(el("span", "", label));
  const area = document.createElement("textarea");
  area.id = id;
  area.name = id;
  area.value = value || "";
  wrap.append(area);
  if (hint) wrap.append(el("p", "hint", hint));
  return wrap;
}

function addPreview(dl, label, value) {
  dl.append(el("dt", "", label), el("dd", "", value));
}

function button(label, className, onClick) {
  const btn = document.createElement("button");
  btn.className = className;
  btn.textContent = label;
  if (onClick) {
    btn.type = "button";
    btn.addEventListener("click", onClick);
  }
  return btn;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function valueOf(id) {
  return document.getElementById(id)?.value || "";
}

function formatWhen(iso) {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
