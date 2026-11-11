const MAX_AUDIT = 200;
const recent = [];
let authFailures = 0;

export function auditPrivileged({ uid, action, allowed, detail }) {
  const entry = { uid: uid || null, action, allowed: Boolean(allowed), detail: detail || null, at: new Date().toISOString() };
  recent.push(entry);
  if (recent.length > MAX_AUDIT) recent.shift();
  if (!allowed) authFailures += 1;
  console.info(`[audit] ${entry.at} uid=${entry.uid || '-'} action=${action} allowed=${entry.allowed}${detail ? ` ${detail}` : ''}`);
}

export function noteAuthFailure(uid, action) {
  auditPrivileged({ uid, action, allowed: false });
}

export function auditSnapshot() {
  return { authFailures, recent: recent.slice(-50) };
}
