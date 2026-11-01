const KEYS = {
  profile: "fastreply.profile",
  resume: "fastreply.resume",
  auth: "fastreply.auth",
  sentLog: "fastreply.sentLog",
};

const DEFAULT_SUBJECT = "Application for {role} at {company}";

const DEFAULT_BODY = `Hi,

I'm {name}. I'm applying for the {role} role at {company}.

Please find my resume attached.

Thank you,
{name}`;

export function defaultProfile() {
  return {
    fromName: "",
    linkedinUrl: "",
    phone: "",
    templateSubject: DEFAULT_SUBJECT,
    templateBody: DEFAULT_BODY,
  };
}

function area() {
  if (globalThis.chrome?.storage?.local) {
    return chrome.storage.local;
  }
  return localStorageArea();
}

function localStorageArea() {
  return {
    async get(keys) {
      const out = {};
      const list = Array.isArray(keys) ? keys : [keys];
      for (const key of list) {
        const raw = localStorage.getItem(key);
        out[key] = raw ? JSON.parse(raw) : undefined;
      }
      return out;
    },
    async set(items) {
      for (const [key, value] of Object.entries(items)) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    },
    async remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const key of list) localStorage.removeItem(key);
    },
  };
}

export async function getProfile() {
  const data = await area().get(KEYS.profile);
  return { ...defaultProfile(), ...(data[KEYS.profile] || {}) };
}

export async function saveProfile(profile) {
  await area().set({ [KEYS.profile]: profile });
}

export async function getResume() {
  const data = await area().get(KEYS.resume);
  return data[KEYS.resume] || null;
}

export async function saveResume(resume) {
  await area().set({ [KEYS.resume]: resume });
}

export async function clearResume() {
  await area().remove(KEYS.resume);
}

export async function getAuth() {
  const data = await area().get(KEYS.auth);
  return data[KEYS.auth] || null;
}

export async function saveAuth(auth) {
  await area().set({ [KEYS.auth]: auth });
}

export async function clearAuth() {
  await area().remove(KEYS.auth);
}

export async function getSentLog() {
  const data = await area().get(KEYS.sentLog);
  return data[KEYS.sentLog] || [];
}

export async function prependSent(entry) {
  const log = await getSentLog();
  log.unshift(entry);
  await area().set({ [KEYS.sentLog]: log.slice(0, 200) });
  return log;
}
