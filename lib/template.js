export function fillTokens(text, vars) {
  return text
    .replaceAll("{role}", vars.role || "")
    .replaceAll("{company}", vars.company || "")
    .replaceAll("{name}", vars.name || "");
}

export function buildSubject(profile, job) {
  return fillTokens(profile.templateSubject, {
    role: job.title,
    company: job.company,
    name: profile.fromName,
  }).trim();
}

export function buildBody(profile, job) {
  let body = fillTokens(profile.templateBody, {
    role: job.title,
    company: job.company,
    name: profile.fromName,
  }).trimEnd();

  if (job.note?.trim()) {
    body += `\n\n${job.note.trim()}`;
  }

  const extras = [];
  if (profile.phone?.trim()) extras.push(profile.phone.trim());
  if (profile.linkedinUrl?.trim()) extras.push(profile.linkedinUrl.trim());
  if (extras.length > 0) {
    body += `\n${extras.join("\n")}`;
  }

  return body.trim();
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
